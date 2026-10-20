export const $=s=>document.querySelector(s);
export function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
export function download(name,text,type='application/json'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export function csv(rows){return rows.map(row=>row.map(value=>{let s=String(value??'');if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n');}
export async function readTextFile(file,limit=200000){if(!file)return '';if(!/\.(txt|md)$/i.test(file.name))throw Error('Choose a .txt or .md text file.');if(file.size>limit)throw Error('File is too large for this workspace.');const text=await file.text();if(text.includes('\0'))throw Error('This looks like a binary file. Use plain text.');return text;}
export function showError(message){$('#error').textContent=message;$('#error').classList.toggle('hidden',!message);}
