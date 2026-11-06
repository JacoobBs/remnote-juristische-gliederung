(function (global) {
  'use strict';
  function alpha(n) {
    let out = '';
    while (n > 0) { n--; out = String.fromCharCode(97 + n % 26) + out; n = Math.floor(n / 26); }
    return out;
  }
  function roman(n) {
    let out = '';
    for (const [value, text] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
      while (n >= value) { out += text; n -= value; }
    }
    return out;
  }
  function label(depth, n) {
    switch (depth) {
      case 0: return alpha(n).toUpperCase() + '.';
      case 1: return roman(n) + '.';
      case 2: return n + '.';
      case 3: return alpha(n) + ')';
      case 4: { const a = String.fromCharCode(97 + (n - 1) % 26); return a.repeat(2 + Math.floor((n - 1) / 26)) + ')'; }
      case 5: return '(' + n + ')';
      default: return null;
    }
  }
  // Number semantic siblings, never mounted/visible DOM rows.
  function calculate(nodes, rootId, paragraphs = {}) {
    const labels = new Map();
    const visited = new Set([rootId]);
    // Empty rows and prose paragraphs are transparent: their children share
    // the surrounding counter instead of restarting it, so no label repeats.
    function visit(parentId, depth, counter) {
      const parent = nodes.get(parentId);
      if (!parent) return;
      for (const id of parent.children || []) {
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.get(id);
        if (!node) continue;
        if (node.boundary) { visit(id, 0, { n: 0 }); continue; }
        if (node.skip) continue;
        if (paragraphs[id]) { labels.set(id, ''); visit(id, depth, counter); continue; }
        if (!node.nonempty) { visit(id, depth, counter); continue; }
        const prefix = label(depth, ++counter.n);
        if (prefix !== null) labels.set(id, prefix);
        visit(id, depth + 1, { n: 0 });
      }
    }
    visit(rootId, 0, { n: 0 });
    return labels;
  }
  // Markers apply from their own row forward in document order. Each document
  // has its own state: a nested document never inherits the parent's mode.
  function calculateRanges(nodes, rootId, markers = {}, paragraphs = {}) {
    const labels = new Map(), visited = new Set();
    const fresh = () => ({ active: false, base: 0, counters: [] });
    function visit(id, depth, state) {
      if (visited.has(id)) return;
      visited.add(id);
      const node = nodes.get(id);
      if (!node || node.skip) return;
      if (node.boundary) {
        const inner = fresh();
        for (const child of node.children || []) visit(child, 0, inner);
        return;
      }
      if (markers[id] === 'start') { state.active = true; state.base = depth; state.counters = []; }
      if (markers[id] === 'stop') state.active = false;
      const transparent = paragraphs[id] || !node.nonempty;
      if (state.active) {
        if (paragraphs[id]) labels.set(id, '');
        else if (node.nonempty) {
          // Outdenting above the initial level keeps the top-level sequence.
          if (depth < state.base) { state.base = depth; state.counters.length = 1; }
          const level = depth - state.base;
          const n = (state.counters[level] || 0) + 1;
          state.counters[level] = n;
          state.counters.length = level + 1;
          const prefix = label(level, n);
          if (prefix !== null) labels.set(id, prefix);
        }
      }
      for (const child of node.children || []) visit(child, transparent ? depth : depth + 1, state);
    }
    visit(rootId, 0, fresh());
    return labels;
  }
  function cssForLabels(labels) {
    const rules = [];
    for (const [id, prefix] of labels) {
      // IDs originate in RemNote. Quote them as CSS strings as an extra safeguard.
      const quoted = '"' + String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r\f]/g, '') + '"';
      const row = '.rn-editor .rn-editor__rem[data-rem-id=' + quoted + ']';
      rules.push(row + ' .rn-bullet-container,' + row + ' .rn-list-number-wrapper,' + row + ' .rn-list-number {opacity:0 !important;}');
      if (prefix) {
        rules.push(row + ' .rn-editor__rem__body__text::before {content:' + JSON.stringify(prefix) + ';display:block;flex:0 0 auto;white-space:nowrap;margin-inline-end:0.5em;align-self:baseline;font:inherit;font-variant-numeric:tabular-nums;pointer-events:none;user-select:none;}');
      }
    }
    return rules.join('\n');
  }
  global.GutachtenNumbering = { alpha, roman, label, calculate, calculateRanges, cssForLabels };
  if (typeof module === 'object' && module.exports) module.exports = global.GutachtenNumbering;
})(typeof self !== 'undefined' ? self : globalThis);
