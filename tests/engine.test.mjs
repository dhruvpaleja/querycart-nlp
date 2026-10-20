import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{parseCSV,parseQuery,runQuery,sqlPreview}from'../public/engine.js';
const data=parseCSV(readFileSync('public/inventory.csv','utf8')),cats=[...new Set(data.map(x=>x.category))];
const run=q=>runQuery(parseQuery(q,cats),data);
test('inventory fixture validates',()=>assert.equal(data.length,24));
test('low stock uses per-item reorder point inclusively',()=>{const r=run('Show low stock products');assert.equal(r.length,13);assert.ok(r.some(x=>x.sku==='EL006'));});
test('out of stock query returns exact SKUs',()=>assert.deepEqual(run('Show out of stock products').map(r=>r.sku),['EL005','ST004','GR004']));
test('price category grammar and slot matching',()=>assert.deepEqual(run('Show Electronics under 1000').map(r=>r.sku),['EL001','EL002','EL004','EL006']));
test('aggregate value uses stock times price',()=>assert.equal(run('Total inventory value')[0].value,data.reduce((s,r)=>s+r.stock*r.price,0)));
test('top N ranking and category filtering',()=>{const r=run('Top 2 cheapest products in Stationery');assert.deepEqual(r.map(x=>x.sku),['ST004','ST001']);});
test('between is inclusive',()=>assert.ok(run('Show products between 249 and 299').every(r=>r.price>=249&&r.price<=299)));
test('unknown or compound conditions rejected instead of ignored',()=>{for(const q of ['Show low stock products and delete them','Show items price below 100 or stock above 50','Show products ordered yesterday','drop table inventory','Show products in Medicine','Top 0 cheapest products','Show products between 50 and 10'])assert.throws(()=>parseQuery(q,cats),undefined,q);});
test('SQL parameters separate values from syntax',()=>{const p=parseQuery("Find products named '; drop table inventory;--",cats),s=sqlPreview(p);assert.ok(!s.sql.includes('drop'));assert.equal(runQuery(p,data).length,0);assert.equal(s.params.length,1);});
test('case and punctuation normalization',()=>assert.equal(run('  PLEASE COUNT ALL PRODUCTS? ')[0].value,24));
test('CSV quoted commas and multiline names',()=>{const r=parseCSV('sku,name,category,stock,reorder_level,price\nx,"Mug, blue\nlarge",Home,0,1,2.25');assert.equal(r[0].name,'Mug, blue\nlarge');});
test('CSV rejects malformed, duplicate and invalid values',()=>{for(const s of ['sku,name\nx,test','sku,name,category,stock,reorder_level,price\nx,n,c,-1,1,2','sku,name,category,stock,reorder_level,price\nx,n,c,1.5,1,2','sku,name,category,stock,reorder_level,price\nx,n,c,1,1,2\nx,n,c,1,1,2','sku,name,category,stock,reorder_level,price\nx,"n,c,1,1,2'])assert.throws(()=>parseCSV(s));});
test('empty list returns no false records',()=>assert.deepEqual(run('Show products with price above 999999'),[]));
test('empty aggregate returns null mean and zero count',()=>{const p=parseQuery('Average price',cats);assert.equal(runQuery(p,[])[0].value,null);assert.equal(runQuery(parseQuery('Count products',cats),[])[0].value,0);});
test('CSV rejects content after closing quotes but supports doubled quotes',()=>{
  const prefix='sku,name,category,stock,reorder_level,price\nx,';
  for(const name of ['"Mug"junk','"Mug""oops'])assert.throws(()=>parseCSV(prefix+name+',Home,1,1,1'),undefined,name);
  assert.equal(parseCSV(prefix+'"A ""quoted"" mug",Home,1,1,1')[0].name,'A "quoted" mug');
});
test('overflowing monetary aggregates fail instead of rounding enormous totals',()=>{
  const huge=parseCSV('sku,name,category,stock,reorder_level,price\nx,n,c,100000000,1,100000000');
  assert.throws(()=>runQuery(parseQuery('Total inventory value',['c']),huge),/exact arithmetic/);
  assert.equal(runQuery(parseQuery('Average price',['c']),huge)[0].value,100000000);
});
test('thresholds cannot become infinity',()=>{
  assert.throws(()=>parseQuery('Show products price under '+ '9'.repeat(320),cats),/finite/);
});
test('name searches do not swallow additional numeric conditions',()=>{
  for(const q of ['Find products named coffee and price under 500','Find products named coffee under 500','Find products named "coffee" and stock above 2','Find products named "coffee'])
    assert.throws(()=>parseQuery(q,cats),undefined,q);
  const p=parseQuery('Find products named "coffee under 500"',cats);
  assert.equal(p.filters[0].value,'coffee under 500');
});
