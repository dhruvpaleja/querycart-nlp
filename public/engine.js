const fields=['sku','name','category','stock','reorder_level','price'];
const normal=s=>s.normalize('NFKC').toLowerCase().trim().replace(/[?!.]+$/g,'').replace(/\s+/g,' ').trim();
export function parseCSV(text){
  if(typeof text!=='string')throw Error('CSV input must be text.');
  if(text.length>1000000)throw Error('CSV must be under 1 MB.');
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
      else cell+=ch;
      continue;
    }
    if(closed && ch!==',' && ch!=='\n' && ch!=='\r'){
      if(ch===' '||ch==='\t')continue;
      throw Error('Unexpected text after a closing CSV quote.');
    }
    if(ch==='"'){if(cell)throw Error('Unexpected quote in CSV.');quoted=true;}
    else if(ch===','){row.push(cell);cell='';closed=false;}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';closed=false;}
    else cell+=ch;
  }
  if(quoted)throw Error('Unclosed quote in CSV.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw Error('CSV needs a header and at least one product.');
  const header=rows.shift().map(c=>c.replace(/^\uFEFF/,'').trim().toLowerCase());
  if(fields.some(f=>!header.includes(f)))throw Error('Required columns: '+fields.join(', '));
  if(new Set(header).size!==header.length)throw Error('Duplicate CSV header.');
  if(rows.length>2000)throw Error('Use up to 2,000 products.');
  const seen=new Set();
  return rows.map((r,i)=>{if(r.length!==header.length)throw Error(`Row ${i+2}: wrong number of columns.`);
    const o=Object.fromEntries(fields.map(f=>[f,r[header.indexOf(f)].trim()]));
    for(const f of ['sku','name','category'])if(!o[f]||o[f].length>160)throw Error(`Row ${i+2}: ${f} must be 1–160 characters.`);
    if(seen.has(o.sku))throw Error(`Row ${i+2}: duplicate SKU ${o.sku}.`);seen.add(o.sku);
    for(const f of ['stock','reorder_level','price']){if(!/^\d+(?:\.\d+)?$/.test(o[f]))throw Error(`Row ${i+2}: ${f} must be a non-negative number.`);o[f]=Number(o[f]);if(!Number.isFinite(o[f])||o[f]>1e8)throw Error(`Row ${i+2}: ${f} is too large.`);}
    for(const f of ['stock','reorder_level'])if(!Number.isInteger(o[f]))throw Error(`Row ${i+2}: ${f} must be a whole number.`);
    if(Math.round(o.price*100)!==o.price*100&&Math.abs(Math.round(o.price*100)-o.price*100)>1e-6)throw Error(`Row ${i+2}: price supports at most two decimal places.`);
    return o;
  });
}
function catName(value,categories){const hit=categories.find(c=>normal(c)===normal(value));if(!hit)throw Error(`Unknown category “${value}”. Available: ${categories.join(', ')}.`);return hit;}
function queryNumber(value){const number=Number(value);if(!Number.isFinite(number)||number>1e8)throw Error('Numeric thresholds must be finite and no greater than 100,000,000.');return number;}
function sumPriceCents(rows,withStock=false){
  let total=0;
  for(const row of rows){const amount=Math.round(row.price*100)*(withStock?row.stock:1);if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(total+amount))throw Error('This total exceeds the exact arithmetic limit. Reduce the inventory values before aggregating.');total+=amount;}
  return total;
}
export function parseQuery(input,categories){
  if(typeof input!=='string'||!input.trim())throw Error('Type an inventory question.');
  if(input.length>400)throw Error('Use a question under 400 characters.');
  const q=normal(input).replace(/^please /,'');let m;
  const plan={intent:'list',filters:[],groupBy:null,sort:null,limit:null,measure:null,query:input};
  if((m=q.match(/^(?:show|list|find) (?:all )?(?:products|items|inventory)$/))){return plan;}
  if((m=q.match(/^(?:show|list|find) (?:all )?(low stock|out of stock)(?: products| items)?(?: in (.+))?$/))){plan.filters.push({field:'stock',op:m[1]==='low stock'?'lteField':'eq',value:m[1]==='low stock'?'reorder_level':0});if(m[2])plan.filters.push({field:'category',op:'eq',value:catName(m[2],categories)});return plan;}
  if((m=q.match(/^(?:how many|count)(?: all)? (?:products|items)(?: (?:are there )?in (.+))?(?: are there)?$/))){plan.intent='aggregate';plan.measure='count';if(m[1])plan.filters.push({field:'category',op:'eq',value:catName(m[1],categories)});return plan;}
  if((m=q.match(/^(?:what is (?:the )?)?(total inventory value|average price|average stock|total stock|count products)(?: by category)?$/))){plan.intent='aggregate';plan.measure={'total inventory value':'value','average price':'averagePrice','average stock':'averageStock','total stock':'stock','count products':'count'}[m[1]];plan.groupBy=q.endsWith('by category')?'category':null;return plan;}
  if((m=q.match(/^top (\d{1,3}) (cheapest|most expensive|lowest stock|highest stock)(?: products| items)?(?: in (.+))?$/))){plan.limit=queryNumber(m[1]);if(plan.limit<1||plan.limit>100)throw Error('Top N must be between 1 and 100.');plan.sort={field:m[2].includes('stock')?'stock':'price',direction:['cheapest','lowest stock'].includes(m[2])?'asc':'desc'};if(m[3])plan.filters.push({field:'category',op:'eq',value:catName(m[3],categories)});return plan;}
  if((m=q.match(/^(?:show|list|find) (?:products|items) (?:with |where )?(stock|price) (under|below|over|above|at most|at least|equal to|<=|>=|=|<|>) (\d+(?:\.\d+)?)(?: in (.+))?$/))){const op={under:'lt',below:'lt',over:'gt',above:'gt','at most':'lte','at least':'gte','equal to':'eq','<=':'lte','>=':'gte','=':'eq','<':'lt','>':'gt'}[m[2]];plan.filters.push({field:m[1],op,value:queryNumber(m[3])});if(m[4])plan.filters.push({field:'category',op:'eq',value:catName(m[4],categories)});return plan;}
  if((m=q.match(/^(?:show|list|find) (.+?)(?: products| items)? (under|below|over|above) (?:rs\.? |₹|\$)?(\d+(?:\.\d+)?)$/))){plan.filters.push({field:'category',op:'eq',value:catName(m[1],categories)},{field:'price',op:['under','below'].includes(m[2])?'lt':'gt',value:queryNumber(m[3])});return plan;}
  if((m=q.match(/^(?:show|list|find) (?:products|items) (?:priced )?between (\d+(?:\.\d+)?) and (\d+(?:\.\d+)?)(?: in (.+))?$/))){if(queryNumber(m[1])>queryNumber(m[2]))throw Error('Minimum price must not exceed maximum.');plan.filters.push({field:'price',op:'gte',value:queryNumber(m[1])},{field:'price',op:'lte',value:queryNumber(m[2])});if(m[3])plan.filters.push({field:'category',op:'eq',value:catName(m[3],categories)});return plan;}
  if((m=q.match(/^(?:show|list|find) (?:all )?(?:products|items) in (.+)$/))){plan.filters.push({field:'category',op:'eq',value:catName(m[1],categories)});return plan;}
  if((m=q.match(/^(?:find|search)(?: products| items)? (?:named|containing) (.+)$/))){
    let value=m[1];
    if(/^["“]/.test(value)){if(!/["”]$/.test(value))throw Error('Close the quoted product name.');value=value.slice(1,-1);if(/["“”]/.test(value))throw Error('Place the full product name inside one pair of quotes.');}
    else if(/["“”]/.test(value)||/\b(?:and|or|with|where)\s+(?:stock|price|category)\b|\b(?:under|below|over|above|at least|at most|between)\s+\d|\b(?:order|sort)\s+by\b/i.test(value))
      throw Error('Name search accepts a literal name, not additional conditions. Quote the full name or ask a supported filter question.');
    if(!value.trim())throw Error('Enter a product name to search for.');
    plan.filters.push({field:'name',op:'contains',value});return plan;
  }
  throw Error('This question is outside the supported grammar. Try a question below, then change its category or number. Nothing was executed.');
}
export function runQuery(plan,data){
  let rows=data.filter(r=>plan.filters.every(f=>{const x=r[f.field],y=f.value;switch(f.op){case'eq':return typeof x==='string'?normal(x)===normal(y):x===y;case'lt':return x<y;case'lte':return x<=y;case'gt':return x>y;case'gte':return x>=y;case'lteField':return x<=r[y];case'contains':return normal(x).includes(normal(y));default:throw Error('Unknown comparison.');}}));
  if(plan.intent==='aggregate'){const groups=new Map();for(const r of rows){const k=plan.groupBy?r.category:'All products';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}if(!plan.groupBy&&!groups.size)groups.set('All products',[]);
    return [...groups].map(([group,rs])=>{let value;switch(plan.measure){case'count':value=rs.length;break;case'stock':value=rs.reduce((s,r)=>s+r.stock,0);break;case'value':value=sumPriceCents(rs,true)/100;break;case'averagePrice':value=rs.length?sumPriceCents(rs)/100/rs.length:null;break;case'averageStock':value=rs.length?rs.reduce((s,r)=>s+r.stock,0)/rs.length:null;break;default:throw Error('Unknown aggregation.');}return {group,measure:plan.measure,value:value===null?null:Math.round((value+Number.EPSILON)*100)/100,productCount:rs.length};}).sort((a,b)=>a.group.localeCompare(b.group));}
  if(plan.sort){const d=plan.sort.direction==='asc'?1:-1;rows=[...rows].sort((a,b)=>(a[plan.sort.field]-b[plan.sort.field])*d||a.sku.localeCompare(b.sku));}
  return plan.limit?rows.slice(0,plan.limit):rows;
}
export function sqlPreview(plan){
  const params=[];const measure={count:'COUNT(*)',stock:'SUM(stock)',value:'SUM(stock * price)',averagePrice:'AVG(price)',averageStock:'AVG(stock)'};
  let sql='SELECT '+(plan.intent==='aggregate'?((plan.groupBy?'category, ':'')+measure[plan.measure]+' AS value'):fields.join(', '))+' FROM inventory';
  if(plan.filters.length)sql+=' WHERE '+plan.filters.map(f=>{if(f.op==='lteField')return `${f.field} <= ${f.value}`;params.push(f.op==='contains'?'%'+f.value.replace(/[\\%_]/g,'\\$&')+'%':f.value);return `${f.field} ${{eq:'=',lt:'<',lte:'<=',gt:'>',gte:'>=',contains:'LIKE'}[f.op]} ?${f.op==='contains'?" ESCAPE '\\'":''}`;}).join(' AND ');
  if(plan.groupBy)sql+=' GROUP BY category';if(plan.sort)sql+=` ORDER BY ${plan.sort.field} ${plan.sort.direction.toUpperCase()}, sku ASC`;if(plan.limit){sql+=' LIMIT ?';params.push(plan.limit);}return {sql:sql+';',params};
}
