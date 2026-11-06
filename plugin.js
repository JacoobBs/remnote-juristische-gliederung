(function () {
  'use strict';
  const { calculateRanges, cssForLabels } = self.GutachtenNumbering;
  const STORAGE = 'gutachten-config-v2', STYLE = 'juristische-gliederung';
  let timer, interval, stopped = false, busy = false, pending = false, lastCSS = null;
  const listeners = [];
  const nonempty = text => (text || []).some(p => typeof p === 'string' ? !!p.trim() : p && (p.i !== 'm' || !!String(p.text || '').trim()));
  async function config(plugin) {
    const saved = await plugin.storage.getSynced(STORAGE);
    // Preserve old data, but never import whole-document/folder activation.
    const legacy = saved ? undefined : await plugin.storage.getSynced('gutachten-config-v1');
    return { schemaVersion: 2, markers: {}, paragraphs: legacy && legacy.paragraphs || {}, ...(saved || {}) };
  }
  async function baseFor(plugin, opened) {
    let cursor = opened, base = opened;
    const seen = new Set();
    while (cursor && !seen.has(cursor._id)) {
      seen.add(cursor._id); base = cursor;
      if (await cursor.isDocument() || await cursor.isFolder()) break;
      cursor = cursor.parent ? await plugin.rem.findOne(cursor.parent) : undefined;
    }
    return base;
  }
  async function currentPoint(plugin) {
    let rem = await plugin.focus.getFocusedRem();
    if (!rem) {
      const selection = await plugin.editor.getSelection();
      const id = selection && (selection.remId || selection.remIds && selection.remIds[0]);
      rem = id ? await plugin.rem.findOne(id) : undefined;
    }
    if (!rem || await rem.isDocument() || await rem.isFolder() || await rem.isCode() || await rem.isProperty()) return undefined;
    return rem;
  }
  async function buildLabels(plugin, base, cfg) {
    const all = [base, ...await base.getDescendants()];
    if (!all.some(rem => cfg.markers[rem._id] === 'start')) return new Map();
    const nodes = new Map();
    for (let i = 0; i < all.length; i += 16) {
      await Promise.all(all.slice(i, i + 16).map(async rem => {
        const [document, folder, code, property] = await Promise.all([rem.isDocument(), rem.isFolder(), rem.isCode(), rem.isProperty()]);
        nodes.set(rem._id, { children: rem.children || [], boundary: document || folder, skip: code || property, nonempty: nonempty(rem.text) });
      }));
    }
    return calculateRanges(nodes, base._id, cfg.markers, cfg.paragraphs);
  }
  async function refresh(plugin) {
    if (stopped) return;
    if (busy) { pending = true; return; }
    busy = true;
    try {
      const cfg = await config(plugin), labels = new Map(), bases = new Set();
      if (Object.values(cfg.markers).includes('start')) for (const id of await plugin.window.getOpenPaneRemIds()) {
        const opened = await plugin.rem.findOne(id);
        if (!opened || await opened.isFolder()) continue;
        const base = await baseFor(plugin, opened);
        if (bases.has(base._id)) continue;
        bases.add(base._id);
        for (const entry of await buildLabels(plugin, base, cfg)) labels.set(...entry);
      }
      const css = cssForLabels(labels);
      if (!stopped && css !== lastCSS) { await plugin.app.registerCSS(STYLE, css); lastCSS = css; }
    } catch (error) {
      console.error('Juristische Gliederung: Aktualisierung fehlgeschlagen', error);
      if (!stopped) { await plugin.app.registerCSS(STYLE, ''); lastCSS = ''; }
    } finally {
      busy = false;
      if (pending && !stopped) { pending = false; schedule(plugin); }
    }
  }
  function schedule(plugin) { clearTimeout(timer); timer = setTimeout(() => { void refresh(plugin); }, 450); }
  async function marker(plugin, mode) {
    const rem = await currentPoint(plugin);
    if (!rem) { await plugin.app.toast('Setze den Textcursor zuerst in den gewünschten Stichpunkt.'); return; }
    const cfg = await config(plugin);
    cfg.markers[rem._id] = mode;
    await plugin.storage.setSynced(STORAGE, cfg);
    await refresh(plugin);
    await plugin.app.toast(mode === 'start' ? 'Gutachten beginnt an diesem Punkt. Zum Beenden am ersten normalen Stichpunkt ausschalten.' : 'Ab diesem Punkt wieder normale Stichpunkte. Der Gutachtenteil davor bleibt erhalten.');
  }
  async function activate(plugin) {
    stopped = false;
    await plugin.app.registerCommand({
      id: 'gutachten-enable', name: 'Gutachten: ab hier einschalten', keywords: 'Jura starten Beginn Abschnitt Gliederung',
      description: 'Beginnt den Gutachtenstil am Stichpunkt mit Textcursor. Alles darüber bleibt unverändert.',
      action: () => marker(plugin, 'start')
    });
    await plugin.app.registerCommand({
      id: 'gutachten-disable', name: 'Gutachten: ab hier ausschalten', keywords: 'Jura stoppen Ende normale Stichpunkte',
      description: 'Ab dem Stichpunkt mit Textcursor wieder normale Stichpunkte. Das Gutachten davor bleibt erhalten.',
      action: () => marker(plugin, 'stop')
    });
    await plugin.app.registerCommand({
      id: 'gutachten-remove-marker', name: 'Gutachten: Grenze hier entfernen', keywords: 'Start Stopp rückgängig Abschnitt',
      description: 'Entfernt den Start oder Stopp am Stichpunkt mit Textcursor.',
      action: async () => {
        const rem = await currentPoint(plugin);
        if (!rem) return;
        const cfg = await config(plugin);
        delete cfg.markers[rem._id];
        await plugin.storage.setSynced(STORAGE, cfg); await refresh(plugin);
        await plugin.app.toast('Start-/Stopp-Grenze an diesem Punkt entfernt.');
      }
    });
    await plugin.app.registerCommand({
      id: 'gutachten-paragraph', name: 'Gutachten: Fließtext ein/aus', keywords: 'Absatz ohne Nummer',
      description: 'Schaltet im Gutachten die Nummer für den Absatz mit Textcursor aus oder wieder ein.',
      action: async () => {
        const rem = await currentPoint(plugin);
        if (!rem) { await plugin.app.toast('Setze den Textcursor zuerst in den gewünschten Absatz.'); return; }
        const cfg = await config(plugin);
        if (cfg.paragraphs[rem._id]) delete cfg.paragraphs[rem._id]; else cfg.paragraphs[rem._id] = true;
        await plugin.storage.setSynced(STORAGE, cfg); await refresh(plugin);
        await plugin.app.toast(cfg.paragraphs[rem._id] ? 'Absatz im Gutachten als Fließtext markiert.' : 'Absatz im Gutachten wird wieder nummeriert.');
      }
    });
    await plugin.app.registerCommand({id: 'gutachten-refresh', name: 'Gutachten: Nummerierung aktualisieren', action: () => refresh(plugin)});
    for (const event of ['GlobalRemChanged','EditorTextEdited','GlobalOpenRem','URLChange','CurrentWindowTreeChange','StorageSyncedChange']) {
      if (!rn.AppEvents[event]) continue;
      const fn = () => schedule(plugin);
      plugin.event.addListener(rn.AppEvents[event], undefined, fn); listeners.push([rn.AppEvents[event], fn]);
    }
    interval = setInterval(() => { void refresh(plugin); }, 8000);
    await refresh(plugin);
  }
  async function deactivate(plugin) {
    stopped = true; clearTimeout(timer); clearInterval(interval);
    for (const [event, fn] of listeners.splice(0)) plugin.event.removeListener(event, undefined, fn);
    lastCSS = null; await plugin.app.registerCSS(STYLE, '');
  }
  rn.declareIndexPlugin(async plugin => {
    try { await activate(plugin); }
    catch (error) {
      console.error('Juristische Gliederung: Start fehlgeschlagen', error);
      await plugin.app.toast('Juristische Gliederung konnte nicht starten: ' + String(error && error.message || error));
    }
  }, deactivate);
})();
