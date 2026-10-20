import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Exercise the actual app event handlers without a browser or private user data.
test('dataset loading uses latest request and invalidates stale exports',async()=>{
  const nodes=new Map();let downloads=0;
  class Node {
    constructor(tag='div'){this.tag=tag;this.value='';this.files=[];this.children=[];this.events=new Map();this.textContent='';this.disabled=false;this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
    addEventListener(type,fn){this.events.set(type,fn);}
    emit(type){return this.events.get(type)?.({target:this});}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
    click(){if(this.tag==='a')downloads++;else return this.emit('click');}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  globalThis.document={querySelector:get,createElement:tag=>new Node(tag)};
  const inventory=await readFile(new URL('../public/inventory.csv',import.meta.url),'utf8');
  let pendingReset;
  globalThis.fetch=async()=>{
    if(!pendingReset)return {ok:true,text:async()=>inventory};
    return new Promise(resolve=>{pendingReset.resolve=resolve;});
  };
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await import('../public/app.js');
  await flush();
  assert.match(get('#dataset').textContent,/24 products/);
  get('#question').value='List all items';get('#ask').emit('click');
  get('#export').emit('click');assert.equal(downloads,1);
  get('#question').value='Unsupported changed query';get('#question').emit('input');
  get('#export').emit('click');get('#export-plan').emit('click');
  assert.equal(downloads,1,'editing a query must invalidate both previous exports');

  pendingReset={};
  const reset=get('#reset-data').emit('click');
  assert.equal(get('#ask').disabled,true);
  get('#file').files=[{name:'new-shop.csv',size:100,text:async()=> 'sku,name,category,stock,reorder_level,price\nNEW,New product,Custom,7,2,4.50'}];
  await get('#file').emit('change');
  assert.match(get('#dataset').textContent,/new-shop\.csv.*1 products/);
  pendingReset.resolve({ok:true,text:async()=>inventory});
  await reset;await flush();
  assert.match(get('#dataset').textContent,/new-shop\.csv/,'an older demo response must not replace a newer import');
  assert.equal(get('#ask').disabled,false);

  get('#question').value='List all items';get('#ask').emit('click');
  get('#export').emit('click');assert.equal(downloads,2);
  get('#file').files=[{name:'broken.csv',size:100,text:async()=> 'bad csv'}];
  await get('#file').emit('change');
  assert.match(get('#error').textContent,/previous inventory remains loaded/);
  get('#export').emit('click');get('#export-plan').emit('click');
  assert.equal(downloads,2,'a failed import must not leave an old export looking current');
  assert.equal(get('#ask').disabled,false);
});
