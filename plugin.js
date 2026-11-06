(function () {
  'use strict';
  const { calculate, cssForLabels } = self.GutachtenNumbering;
  const STORAGE = 'gutachten-config-v1';
  const STYLE = 'juristische-gliederung';
  let timer, interval, stopped = false, busy = false, pending = false;
  let lastCSS = '';
  const listeners = [];
  const nonempty = (text) => (text || []).some(part => typeof part === 'string' ? part.trim().length > 0 : part && (part.i !== 'm' || String(part.text || '').trim().length > 0));
  async function config(plugin) {
    const saved = await plugin.storage.getSynced(STORAGE);
    return { roots: {}, paragraphs: {}, ...(saved || {}) };
  }
  async function page(plugin) {
    const pane = await plugin.window.getFocusedPaneId();
    const id = await plugin.window.getOpenPaneRemId(pane);
    return id ? plugin.rem.findOne(id) : undefined;
  }
  async function baseFor(plugin, opened, roots) {
    // Keep full-document numbering when zooming into a paragraph.
    let cursor = opened, base = opened, foundBoundary = false, enabled = false;
    const seen = new Set();
    while (cursor && !seen.has(cursor._id)) {
      seen.add(cursor._id);
      if (!foundBoundary && (await cursor.isDocument() || await cursor.isFolder())) { base = cursor; foundBoundary = true; }
      if (roots[cursor._id]) { enabled = true; if (!foundBoundary) base = cursor; break; }
      cursor = cursor.parent ? await plugin.rem.findOne(cursor.parent) : undefined;
    }
    return enabled ? base : undefined;
  }
  async function buildLabels(plugin, base, paragraphs) {
    const all = [base, ...await base.getDescendants()];
    const nodes = new Map();
    // Limit concurrent SDK calls while still loading independent metadata in batches.
    for (let start = 0; start < all.length; start += 16) {
      await Promise.all(all.slice(start, start + 16).map(async rem => {
        const [document, folder, code, property] = await Promise.all([rem.isDocument(), rem.isFolder(), rem.isCode(), rem.isProperty()]);
        nodes.set(rem._id, { children: rem.children || [], boundary: document || folder, skip: code || property, nonempty: nonempty(rem.text) });
      }));
    }
    return calculate(nodes, base._id, paragraphs);
  }
  async function refresh(plugin) {
    if (stopped) return;
    if (busy) { pending = true; return; }
    busy = true;
    try {
      const cfg = await config(plugin);
      const labels = new Map(), bases = new Set();
      for (const id of await plugin.window.getOpenPaneRemIds()) {
        const opened = await plugin.rem.findOne(id);
        if (!opened) continue;
        // Folder views contain document names, not the outline of a Gutachten.
        if (await opened.isFolder()) continue;
        const base = await baseFor(plugin, opened, cfg.roots);
        if (!base || bases.has(base._id)) continue;
        bases.add(base._id);
        for (const entry of await buildLabels(plugin, base, cfg.paragraphs)) labels.set(...entry);
      }
      const css = cssForLabels(labels);
      if (!stopped && css !== lastCSS) { await plugin.app.registerCSS(STYLE, css); lastCSS = css; }
    } catch (error) {
      console.error('Juristische Gliederung: Aktualisierung fehlgeschlagen', error);
      // Do not leave potentially stale numbers on screen after an SDK error.
      if (!stopped) { await plugin.app.registerCSS(STYLE, ''); lastCSS = ''; }
    } finally {
      busy = false;
      if (pending && !stopped) { pending = false; schedule(plugin); }
    }
  }
  function schedule(plugin) {
    clearTimeout(timer);
    timer = setTimeout(() => { void refresh(plugin); }, 450);
  }
  async function activate(plugin) {
    stopped = false;
    await plugin.app.registerCommand({
      id: 'gutachten-enable', name: 'Gutachten: hier einschalten', keywords: 'Jura Gliederung Ordner A I Nummerierung',
      description: 'Aktiviert die juristische Gliederung für das geöffnete Dokument oder den geöffneten Ordner einschließlich seiner Dokumente.',
      action: async () => {
        const root = await page(plugin);
        if (!root) { await plugin.app.toast('Öffne zuerst ein Dokument oder einen Ordner.'); return; }
        const cfg = await config(plugin);
        cfg.roots[root._id] = true;
        await plugin.storage.setSynced(STORAGE, cfg);
        await refresh(plugin);
        await plugin.app.toast('Juristische Gliederung hier eingeschaltet: A. → I. → 1. → a) → aa) → (1)');
      }
    });
    await plugin.app.registerCommand({
      id: 'gutachten-disable', name: 'Gutachten: hier ausschalten', keywords: 'Jura Gliederung zurücksetzen',
      description: 'Entfernt die Aktivierung am geöffneten Dokument oder Ordner. Bei geerbter Aktivierung bitte den aktivierten Ordner öffnen.',
      action: async () => {
        const root = await page(plugin);
        if (!root) return;
        const cfg = await config(plugin);
        if (!cfg.roots[root._id]) { await plugin.app.toast('Hier gibt es keine eigene Aktivierung. Öffne gegebenenfalls den Ordner, in dem du sie eingeschaltet hast.'); return; }
        delete cfg.roots[root._id];
        await plugin.storage.setSynced(STORAGE, cfg);
        await refresh(plugin);
        await plugin.app.toast('Aktivierung hier entfernt.');
      }
    });
    await plugin.app.registerCommand({
      id: 'gutachten-paragraph', name: 'Gutachten: Fließtext ein/aus', keywords: 'Absatz ohne Nummer',
      description: 'Schaltet die Nummerierung für den Absatz mit dem Textcursor aus oder wieder ein.',
      action: async () => {
        const rem = await plugin.focus.getFocusedRem();
        if (!rem) { await plugin.app.toast('Setze den Textcursor zuerst in den gewünschten Absatz.'); return; }
        const cfg = await config(plugin);
        if (cfg.paragraphs[rem._id]) delete cfg.paragraphs[rem._id]; else cfg.paragraphs[rem._id] = true;
        await plugin.storage.setSynced(STORAGE, cfg);
        await refresh(plugin);
        await plugin.app.toast(cfg.paragraphs[rem._id] ? 'Absatz als Fließtext markiert.' : 'Absatz wird wieder nummeriert.');
      }
    });
    await plugin.app.registerCommand({id: 'gutachten-refresh', name: 'Gutachten: Nummerierung aktualisieren', action: () => refresh(plugin)});
    await plugin.app.toast('Juristische Gliederung 0.1.1 gestartet. Die Gutachten-Befehle sind jetzt verfügbar.');
    for (const event of ['GlobalRemChanged','EditorTextEdited','GlobalOpenRem','URLChange','CurrentWindowTreeChange','StorageSyncedChange']) {
      if (!rn.AppEvents[event]) continue;
      const fn = () => schedule(plugin);
      plugin.event.addListener(rn.AppEvents[event], undefined, fn);
      listeners.push([rn.AppEvents[event], fn]);
    }
    // A slow fallback catches changes not announced by older RemNote versions.
    interval = setInterval(() => { void refresh(plugin); }, 8000);
    await refresh(plugin);
  }
  async function deactivate(plugin) {
    stopped = true;
    clearTimeout(timer); clearInterval(interval);
    for (const [event, fn] of listeners.splice(0)) plugin.event.removeListener(event, undefined, fn);
    lastCSS = '';
    await plugin.app.registerCSS(STYLE, '');
  }
  rn.declareIndexPlugin(async plugin => {
    try { await activate(plugin); }
    catch (error) {
      console.error('Juristische Gliederung: Start fehlgeschlagen', error);
      await plugin.app.toast('Juristische Gliederung konnte nicht starten: ' + String(error && error.message || error));
    }
  }, deactivate);
})();
