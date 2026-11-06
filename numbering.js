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
  global.GutachtenNumbering = { alpha, roman, label, calculate, cssForLabels };
  if (typeof module === 'object' && module.exports) module.exports = global.GutachtenNumbering;
})(typeof self !== 'undefined' ? self : globalThis);
