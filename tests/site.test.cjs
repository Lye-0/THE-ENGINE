'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sources=[...html.matchAll(/<script defer src="\.\/([^"]+)"/g)].map(m=>m[1]);
test('the production entry is separated into seven classic scripts and a stylesheet',()=>{
 assert.equal(sources.length,7);assert.match(html,/<link rel="stylesheet" href="\.\/css\/style.css"/);
 for(const src of sources){assert.ok(fs.existsSync(path.join(root,src)));new vm.Script(fs.readFileSync(path.join(root,src),'utf8'),{filename:src});}
 assert.equal((html.match(/<script>/g)||[]).length,0);
});
test('runtime resources have no CDN, font, model or texture network dependency',()=>{
 for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(!/^https?:\/\//.test(m[1]),m[1]);
 const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');assert.doesNotMatch(css,/@import|https?:\/\//);
 for(const src of sources)assert.doesNotMatch(fs.readFileSync(path.join(root,src),'utf8'),/\bfetch\s*\(|XMLHttpRequest|https?:\/\//);
});
test('semantic controls, unique IDs and reduced-motion support remain present',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const id of ['engine-canvas','quality','sound','play','rpm','speed','angle','about','explore','combustion','reset'])assert.ok(ids.includes(id),id);
 assert.match(html,/<html lang="ja"/);assert.match(html,/<dialog/);assert.match(html,/aria-live="polite"/);
 assert.match(fs.readFileSync(path.join(root,'css/style.css'),'utf8'),/prefers-reduced-motion/);
});
test('portable preview builder preserves code, including $$ selectors and embedded scripts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ferro-preview-'));
 try{
  const file=path.join(dir,'preview.html');execFileSync(process.execPath,[path.join(root,'scripts/build-preview.mjs'),file]);
  const built=fs.readFileSync(file,'utf8');assert.doesNotMatch(built,/<script defer src=/);assert.doesNotMatch(built,/<link rel="stylesheet"/);
  assert.match(built,/\$\$\s*=\s*s\s*=>/);assert.match(built,/data:image\/svg\+xml;base64,/);
  const scripts=[...built.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);
  new vm.Script(scripts[0][1]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
