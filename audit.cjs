const fs=require('fs');const path=require('path');
const root=process.argv[2];
function walk(d){let r=[];for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())r=r.concat(walk(p));else if(f.name.endsWith('.ts'))r.push(p);}return r;}
const files=walk(root);
const set=new Set();
const allImports=[];
for(const f of files){const lines=fs.readFileSync(f,'utf8').split(/\r?\n/);for(let i=0;i<lines.length;i++){const m=lines[i].match(/from\s+['"]([^'"]+)['"]/);if(m){const s=m[1];allImports.push({file:f,line:i+1,spec:s,raw:lines[i]});if(!s.startsWith('.'))set.add(s);}const m2=lines[i].match(/^\s*import\s+['"]([^'"]+)['"]/);if(m2){const s=m2[1];allImports.push({file:f,line:i+1,spec:s,raw:lines[i],sideEffect:true});if(!s.startsWith('.'))set.add(s);}}}
console.log('=== UNIQUE NON-RELATIVE IMPORTS ===');
console.log([...set].sort().join('\n'));
console.log('\n=== ALL IMPORTS BY FILE ===');
const byFile={};for(const i of allImports){(byFile[i.file]=byFile[i.file]||[]).push(i);}
for(const f of Object.keys(byFile).sort()){console.log('\n--- '+path.relative(root,f).replace(/\\/g,'/'));for(const i of byFile[f])console.log('  L'+i.line+': '+i.spec);}
