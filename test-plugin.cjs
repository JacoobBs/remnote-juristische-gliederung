const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = __dirname;
const N = require(path.join(root, 'numbering.js'));

assert.deepEqual(Array.from({length:6}, (_, i) => N.label(i, 1)), ['A.','I.','1.','a)','aa)','(1)']);
assert.equal(N.label(1, 49), 'XLIX.');
assert.equal(N.label(0, 27), 'AA.');
assert.equal(N.label(4, 27), 'aaa)');

function rem(id, children=[], opts={}) {
  return { _id:id, children, parent:opts.parent || null, text:opts.empty ? [] : [id],
    isDocument:async()=>!!opts.doc, isFolder:async()=>!!opts.folder,
    isCode:async()=>!!opts.code, isProperty:async()=>!!opts.property,
    ...opts };
}
const data = new Map();
for (const item of [
  rem('folder',['doc1','doc2'],{folder:true}),
  rem('doc1',['A','prose','blank','B'],{doc:true,parent:'folder'}),
  rem('A',['I','II'],{parent:'doc1'}), rem('I',['one'],{parent:'A'}),
  rem('one',['a'],{parent:'I'}), rem('a',['aa'],{parent:'one'}),
  rem('aa',['bracket'],{parent:'a'}), rem('bracket',[],{parent:'aa'}),
  rem('II',[],{parent:'A'}), rem('prose',[],{parent:'doc1'}),
  rem('blank',[],{parent:'doc1',empty:true}), rem('B',[],{parent:'doc1'}),
  rem('doc2',['secondA'],{doc:true,parent:'folder'}),rem('secondA',[],{parent:'doc2'})
]) data.set(item._id, item);
for (const item of data.values()) item.getDescendants = async function () {
  const out = [];
  function visit(r) { for (const id of r.children) { const child=data.get(id); if(child) {out.push(child);visit(child);} } }
  visit(this); return out;
};
function nodes() {return new Map([...data].map(([id,r])=>[id,{children:r.children,nonempty:!!r.text.length,boundary:!!(r.doc||r.folder),skip:!!(r.code||r.property)}]));}
const labels = N.calculate(nodes(),'folder',{prose:true});
for (const [id,label] of Object.entries({A:'A.',I:'I.',II:'II.',one:'1.',a:'a)',aa:'aa)',bracket:'(1)',B:'B.',secondA:'A.',prose:''})) assert.equal(labels.get(id),label,id);
assert(!labels.has('blank'));
assert(!labels.has('doc1'));
// Reordering must update sibling numbers while preserving child-level resets.
data.get('A').children.reverse();
assert.equal(N.calculate(nodes(),'doc1',{prose:true}).get('I'),'II.');
data.get('A').children.reverse();
// Rows nested under empty or prose lines continue the surrounding counter
// instead of restarting it — no duplicate labels like two "A." in one list.
{
  const transparent = new Map([
    ['doc', {children:['x','blank','prose'], nonempty:true, boundary:true}],
    ['x', {children:[], nonempty:true}],
    ['blank', {children:['y'], nonempty:false}],
    ['y', {children:[], nonempty:true}],
    ['prose', {children:['z'], nonempty:true}],
    ['z', {children:[], nonempty:true}],
  ]);
  const continued = N.calculate(transparent,'doc',{prose:true});
  assert.equal(continued.get('x'),'A.');
  assert.equal(continued.get('y'),'B.');
  assert.equal(continued.get('prose'),'');
  assert.equal(continued.get('z'),'C.');
}

let activate, deactivate, store = {}, paneId = 'doc1', focusedId = 'prose';
const commands = new Map(), styles = new Map();
const plugin = {
  app:{waitForInitialSync:()=>new Promise(()=>{}),registerCommand:async c=>commands.set(c.id,c),registerCSS:async(id,css)=>styles.set(id,css),toast:async()=>{}},
  storage:{getSynced:async()=>structuredClone(store),setSynced:async(_,value)=>{store=structuredClone(value);}},
  window:{getFocusedPaneId:async()=>'pane',getOpenPaneRemId:async()=>paneId,getOpenPaneRemIds:async()=>[paneId]},
  rem:{findOne:async id=>data.get(id)},focus:{getFocusedRem:async()=>data.get(focusedId)},
  event:{addListener(){},removeListener(){}}
};
const context = {console,setTimeout,clearTimeout,setInterval,clearInterval,URL,URLSearchParams,TextEncoder,TextDecoder};
context.self=context;context.window=context;
vm.createContext(context);
for (const name of ['react.production.min.js','react-dom.production.min.js','sdk.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
const parsed = context.rn.parseManifest(JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')));
assert.equal(parsed.success,true,JSON.stringify(parsed));
// Exercise our integration against a mocked SDK, without a RemNote account.
context.rn = {AppEvents:{},declareIndexPlugin:(a,d)=>{activate=a;deactivate=d;}};
context.GutachtenNumbering=N;
vm.runInContext(fs.readFileSync(path.join(root,'plugin.js'),'utf8'),context);
(async()=>{
  try {
    await activate(plugin);
    assert.equal(styles.size,0); // untouched before opting in
    paneId='folder';
    await commands.get('gutachten-enable').action();
    assert(store.roots.folder);
    paneId='doc1';
    await commands.get('gutachten-refresh').action();
    assert(styles.get('juristische-gliederung').includes('content:"A."'));
    assert(!styles.get('juristische-gliederung').includes('secondA'));
    await commands.get('gutachten-paragraph').action();
    assert(store.paragraphs.prose);
    assert(styles.get('juristische-gliederung').includes('data-rem-id="B"] .rn-editor__rem__body__text::before {content:"B."'));
    // Zooming into I must keep its original document level (not restart at A).
    paneId='I';await commands.get('gutachten-refresh').action();
    assert(styles.get('juristische-gliederung').includes('data-rem-id="I"] .rn-editor__rem__body__text::before {content:"I."'));
    // Moving a row to another branch changes its label from II. to B.
    data.get('A').children=['I'];data.get('doc1').children=['A','II','prose','blank','B'];data.get('II').parent='doc1';
    await commands.get('gutachten-refresh').action();
    assert(styles.get('juristische-gliederung').includes('data-rem-id="II"] .rn-editor__rem__body__text::before {content:"B."'));
    // Disabling the source folder restores the regular display everywhere.
    paneId='folder';await commands.get('gutachten-disable').action();
    assert.equal(styles.get('juristische-gliederung'),'');
    console.log('PASS: six levels, sibling resets, reordering, folder inheritance, empty paragraphs, prose, zooming, moved rows, disabling, SDK manifest.');
  } finally {await deactivate(plugin);}
})().catch(error=>{console.error(error);process.exitCode=1;});
