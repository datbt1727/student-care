(function(root){
'use strict';
const column=n=>{let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
const index=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
function sanitize(sheet,retired){
 const headers=sheet.rows.slice(0,sheet.headerRows||sheet.headerRow||1),remove=new Set();
 for(const row of headers)row.forEach((cell,c)=>{const value=cell&&typeof cell==='object'?cell.value:cell;if(typeof value==='string'&&retired(value))remove.add(c);});
 if(!remove.size)return sheet;
 const mapped=n=>n-[...remove].filter(c=>c<n).length;
 const out={...sheet,rows:sheet.rows.map(row=>row.filter((_,c)=>!remove.has(c)))};
 for(const key of ['widths'])if(sheet[key])out[key]=sheet[key].filter((_,c)=>!remove.has(c));
 for(const key of ['percentColumns','courseColumns'])if(sheet[key])out[key]=sheet[key].filter(c=>!remove.has(c)).map(mapped);
 if(sheet.statusColumn!==undefined){if(remove.has(sheet.statusColumn))delete out.statusColumn;else out.statusColumn=mapped(sheet.statusColumn);}
 for(const key of ['identityColumns','profileColumns'])if(sheet[key]!==undefined)out[key]=sheet[key]-[...remove].filter(c=>c<sheet[key]).length;
 out.merges=(sheet.merges||[]).flatMap(ref=>{const m=/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref);if(!m)throw Error('Vùng gộp ô không hợp lệ.');const a=index(m[1]),b=index(m[3]),kept=[];for(let c=a;c<=b;c++)if(!remove.has(c))kept.push(c);if(!kept.length)return [];const left=mapped(kept[0]),right=mapped(kept.at(-1));if(left===right&&m[2]===m[4])return [];return [column(left)+m[2]+':'+column(right)+m[4]];});
 return out;
}
const api={sanitize};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentExportSchema=api;
})(typeof window==='object'?window:globalThis);
