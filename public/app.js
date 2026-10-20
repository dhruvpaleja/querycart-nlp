import{parseCSV,parseQuery,runQuery,sqlPreview}from'./engine.js';
import{$,element,download,csv,showError}from'./utils.js';
let data=[],result=null,plan=null,dataLabel='Fictional demo shop';
const examples=['Show low stock products','Show out of stock products','Total inventory value by category','Top 5 most expensive products','Show Electronics under 1000','Show products with stock at most 5','Average price by category','Find products named coffee'];
function clear(){result=null;plan=null;$('#output').classList.add('hidden');$('#empty').classList.remove('hidden');showError('');}
function describeData(){$('#dataset').textContent=`${dataLabel} · ${data.length} products · ${[...new Set(data.map(r=>r.category))].join(', ')}`;}
async function demo(){const response=await fetch('./inventory.csv');if(!response.ok)throw Error('Demo inventory could not load. Import a CSV to continue.');data=parseCSV(await response.text());dataLabel='Fictional demo shop';describeData();clear();}
for(const text of examples){const b=element('button',text);b.addEventListener('click',()=>{$('#question').value=text;clear();});$('#examples').append(b);}
$('#question').addEventListener('input',clear);
$('#ask').addEventListener('click',()=>{try{if(!data.length)throw Error('Import inventory first.');plan=parseQuery($('#question').value,[...new Set(data.map(r=>r.category))]);result=runQuery(plan,data);showError('');const stats=$('#stats');stats.replaceChildren();for(const[v,l]of [[result.length,'Result rows'],[data.length,'Products scanned']]){const s=element('div',undefined,'stat');s.append(element('strong',String(v)),element('span',l));stats.append(s);}
$('#slots').replaceChildren(element('span',`Intent: ${plan.intent}`));for(const f of plan.filters)$('#slots').append(element('span',`${f.field} ${f.op} ${f.value}`));if(plan.groupBy)$('#slots').append(element('span','Group: category'));if(plan.sort)$('#slots').append(element('span',`Sort: ${plan.sort.field} ${plan.sort.direction}`));if(plan.limit)$('#slots').append(element('span',`Limit: ${plan.limit}`));
const table=$('#results');table.replaceChildren();if(result.length){const cols=Object.keys(result[0]),thead=element('thead'),tr=element('tr');cols.forEach(c=>tr.append(element('th',c.replaceAll('_',' '))));thead.append(tr);table.append(thead);const body=element('tbody');result.forEach(row=>{const tr=element('tr');cols.forEach(c=>tr.append(element('td',row[c]===null?'Not available':String(row[c]))));body.append(tr);});table.append(body);}else{table.append(element('caption','No products match these filters.'));}
const preview=sqlPreview(plan);$('#sql').textContent=preview.sql;$('#params').textContent=JSON.stringify(preview.params);$('#output').classList.remove('hidden');$('#empty').classList.add('hidden');
}catch(e){clear();showError(e.message);}});
$('#clear').addEventListener('click',clear);
$('#reset-data').addEventListener('click',()=>demo().catch(e=>showError(e.message)));
$('#file').addEventListener('change',async()=>{try{const file=$('#file').files[0];if(!file)return;if(!/\.csv$/i.test(file.name))throw Error('Choose a CSV file.');if(file.size>1000000)throw Error('Use a CSV under 1 MB.');const parsed=parseCSV(await file.text());data=parsed;dataLabel=file.name;describeData();clear();}catch(e){showError(e.message);}finally{$('#file').value='';}});
$('#export').addEventListener('click',()=>{if(result?.length){const cols=Object.keys(result[0]);download('querycart-results.csv',csv([cols,...result.map(r=>cols.map(c=>r[c]))]),'text/csv;charset=utf-8');}});
$('#export-plan').addEventListener('click',()=>{if(plan)download('querycart-query.json',JSON.stringify({app:'QueryCart',plan,sqlPreview:sqlPreview(plan),result},null,2));});
demo().catch(e=>showError(e.message));
