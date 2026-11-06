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

// Start and stop rows bound the range; unrelated rows remain native bullets.
{
  const simple = new Map([
    ['doc',{boundary:true,children:['before','start','next','stop','after','again','end']}],
    ['before',{nonempty:true,children:[]}],
    ['start',{nonempty:true,children:['nested']}],
    ['nested',{nonempty:true,children:[]}],
    ['next',{nonempty:true,children:[]}],
    ['stop',{nonempty:true,children:[]}],
    ['after',{nonempty:true,children:[]}],
    ['again',{nonempty:true,children:[]}],
    ['end',{nonempty:true,children:[]}],
  ]);
  assert.equal(N.calculateRanges(simple,'doc').size,0);
  const result=N.calculateRanges(simple,'doc',{start:'start',stop:'stop',again:'start',end:'stop'});
  assert.deepEqual([...result],[['start','A.'],['nested','I.'],['next','B.'],['again','A.']]);
  // A new sibling inserted before a stop is automatically part of the range.
  simple.get('doc').children.splice(3,0,'inserted');simple.set('inserted',{nonempty:true,children:[]});
  assert.equal(N.calculateRanges(simple,'doc',{start:'start',stop:'stop'}).get('inserted'),'C.');
  // Deleting a start restores ordinary bullets, even with a remaining stop.
  assert.equal(N.calculateRanges(simple,'doc',{stop:'stop'}).size,0);
  const transparent=new Map([
    ['doc',{boundary:true,children:['x','blank','prose','stop']}],
    ['x',{nonempty:true,children:[]}],['blank',{nonempty:false,children:['y']}],
    ['y',{nonempty:true,children:[]}],['prose',{nonempty:true,children:['z']}],
    ['z',{nonempty:true,children:[]}],['stop',{nonempty:true,children:[]}]
  ]);
  const continued=N.calculateRanges(transparent,'doc',{x:'start',stop:'stop'},{prose:true});
  assert.equal(continued.get('x'),'A.');assert.equal(continued.get('y'),'B.');assert.equal(continued.get('z'),'C.');
  // Nested documents are independent and do not end the enclosing range.
  simple.set('inner',{boundary:true,children:['innerRow']});simple.set('innerRow',{nonempty:true,children:[]});
  simple.get('start').children.push('inner');
  const nested=N.calculateRanges(simple,'doc',{start:'start',stop:'stop'});
  assert(!nested.has('innerRow'));assert.equal(nested.get('next'),'B.');
  // Starting inside a nested list does not change its parent or earlier rows.
  const inside=N.calculateRanges(simple,'doc',{nested:'start',stop:'stop'});
  assert(!inside.has('start'));assert.equal(inside.get('nested'),'A.');assert.equal(inside.get('next'),'B.');
  const typing=new Map([
    ['doc',{boundary:true,children:['before','emptyStart','typed','emptyStop','after']}],
    ['before',{nonempty:true,children:[]}],['emptyStart',{nonempty:false,children:[]}],
    ['typed',{nonempty:true,children:[]}],['emptyStop',{nonempty:false,children:[]}],
    ['after',{nonempty:true,children:[]}]
  ]);
  const mode=N.calculateRanges(typing,'doc',{emptyStart:'start',emptyStop:'stop'});
  assert.deepEqual([...mode],[['typed','A.']]);
  // Typing into the previously empty start row numbers it and advances the next.
  typing.get('emptyStart').nonempty=true;
  const filled=N.calculateRanges(typing,'doc',{emptyStart:'start',emptyStop:'stop'});
  assert.equal(filled.get('emptyStart'),'A.');assert.equal(filled.get('typed'),'B.');assert(!filled.has('after'));
}

let activate, deactivate, paneId='doc1', focusedId='A', selection;
const legacy={roots:{folder:true,doc1:true},paragraphs:{prose:true}};
const storage=new Map([['gutachten-config-v1',structuredClone(legacy)]]);
const commands=new Map(), styles=new Map(), toasts=[];
const plugin={
  app:{registerCommand:async c=>commands.set(c.id,c),registerCSS:async(id,css)=>styles.set(id,css),toast:async text=>toasts.push(text)},
  storage:{getSynced:async key=>structuredClone(storage.get(key)),setSynced:async(key,val)=>storage.set(key,structuredClone(val))},
  window:{getFocusedPaneId:async()=>'pane',getOpenPaneRemId:async()=>paneId,getOpenPaneRemIds:async()=>[paneId]},
  rem:{findOne:async id=>data.get(id)},focus:{getFocusedRem:async()=>data.get(focusedId)},
  editor:{getSelection:async()=>selection},event:{addListener(){},removeListener(){}}
};
const context={console,setTimeout,clearTimeout,setInterval,clearInterval,URL,URLSearchParams,TextEncoder,TextDecoder};
context.self=context;context.window=context;vm.createContext(context);
for (const name of ['react.production.min.js','react-dom.production.min.js','sdk.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
const parsed=context.rn.parseManifest(JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')));
assert.equal(parsed.success,true,JSON.stringify(parsed));
context.rn={AppEvents:{},declareIndexPlugin:(a,d)=>{activate=a;deactivate=d;}};
context.GutachtenNumbering=N;
vm.runInContext(fs.readFileSync(path.join(root,'plugin.js'),'utf8'),context);
const css=()=>styles.get('juristische-gliederung');
const prefix=(id,label)=>css().includes('data-rem-id="'+id+'"] .rn-editor__rem__body__text::before {content:'+JSON.stringify(label));
const contains=id=>css().includes('data-rem-id="'+id+'"]');
const command=id=>commands.get(id).action();
(async()=>{
 try {
  await activate(plugin);
  assert.equal(css(),''); // Legacy document/folder opt-in never numbers by default.
  assert.deepEqual(storage.get('gutachten-config-v1'),legacy);
  assert(!storage.has('gutachten-config-v2'));
  await command('gutachten-enable');
  assert.equal(storage.get('gutachten-config-v2').markers.A,'start');
  assert(prefix('A','A.'));assert(prefix('I','I.'));assert(prefix('one','1.'));
  assert(prefix('a','a)'));assert(prefix('aa','aa)'));assert(prefix('bracket','(1)'));
  focusedId='B';await command('gutachten-disable');
  assert(!contains('B'));assert(prefix('A','A.'));
  // New rows before, inside, and after the interval.
  for (const [id,parent] of [['before','doc1'],['inside','doc1'],['after','doc1']]) {
    const item=rem(id,[],{parent});item.getDescendants=async()=>[];data.set(id,item);
  }
  data.get('doc1').children=['before','A','inside','prose','blank','B','after'];
  await command('gutachten-refresh');
  assert(!contains('before'));assert(!contains('after'));assert(prefix('inside','B.'));
  paneId='I';await command('gutachten-refresh');assert(prefix('I','I.'));
  paneId='doc2';await command('gutachten-refresh');assert.equal(css(),'');
  focusedId='secondA';await command('gutachten-enable');assert(prefix('secondA','A.'));
  paneId='doc1';await command('gutachten-refresh');assert(!contains('secondA'));
  // A stop at an inner row ends formatting there and below in document order.
  focusedId='I';await command('gutachten-disable');
  assert(prefix('A','A.'));assert(!contains('I'));assert(!contains('II'));assert(!contains('inside'));
  await command('gutachten-remove-marker');assert(prefix('I','I.'));assert(prefix('inside','B.'));
  // Undo a boundary by starting at the same point; stop/start replaces, not duplicates.
  focusedId='B';await command('gutachten-enable');assert(prefix('B','A.'));assert(prefix('after','B.'));
  await command('gutachten-disable');assert(!contains('B'));assert(!contains('after'));
  // Prose retains its old opt-out within the new explicit range.
  focusedId='prose';await command('gutachten-paragraph');assert(prefix('prose','C.'));
  await command('gutachten-paragraph');assert(contains('prose'));assert(!prefix('prose','C.'));
  // A command on a title must never turn an entire document into a Gutachten.
  const saved=structuredClone(storage.get('gutachten-config-v2'));
  focusedId='doc1';await command('gutachten-enable');assert.deepEqual(storage.get('gutachten-config-v2'),saved);
  // SDK text selection can supply the target if there is no focused Rem.
  focusedId=undefined;selection={type:'Text',remId:'inside'};
  await command('gutachten-enable');assert(prefix('inside','A.'));
  selection=undefined;focusedId=undefined;
  const prior=structuredClone(storage.get('gutachten-config-v2'));
  await command('gutachten-enable');assert.deepEqual(storage.get('gutachten-config-v2'),prior);
  // State survives reload and the original v1 data remains unchanged.
  await deactivate(plugin);await activate(plugin);
  assert(prefix('inside','A.'));assert.deepEqual(storage.get('gutachten-config-v1'),legacy);
  console.log('PASS: prior numbering regressions; default bullets; start/stop boundaries; six levels; inserted rows; multiple sections; nested documents; zoom; prose; legacy storage; title/no-cursor guard; SDK target fallback; reload; manifest.');
 } finally {await deactivate(plugin);}
})().catch(error=>{console.error(error);process.exitCode=1;});

