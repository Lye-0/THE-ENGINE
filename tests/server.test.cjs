'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const net=require('node:net');
const path=require('node:path');
const {spawn}=require('node:child_process');
let child,port;
const request=(url='/',method='GET')=>new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port,path:url,method},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});
 req.on('error',reject);req.setTimeout(5000,()=>req.destroy(new Error('Request timeout')));req.end();
});
before(async()=>{
 port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 child=spawn(process.execPath,[path.join(__dirname,'../scripts/serve.mjs'),'--port',String(port)],{stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),10000);child.stdout.on('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error(`Server exited: ${code}`));});});
});
after(async()=>{if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});});
test('static server serves the split HTML, JS, CSS and favicon with correct MIME types',async()=>{
 for(const [url,type] of [['/','text/html'],['/js/app.js','text/javascript'],['/css/style.css','text/css'],['/favicon.svg','image/svg+xml']]){
  const r=await request(url);assert.equal(r.status,200);assert.ok(r.headers['content-type'].startsWith(type));assert.ok(r.body.length>0);assert.equal(r.headers['x-content-type-options'],'nosniff');
 }
});
test('HEAD returns metadata but no response body',async()=>{const r=await request('/','HEAD');assert.equal(r.status,200);assert.equal(r.body,'');assert.ok(Number(r.headers['content-length'])>0);});
test('missing resources are 404; malformed URI escapes are 400',async()=>{
 assert.equal((await request('/does-not-exist.js')).status,404);assert.equal((await request('/%ZZ')).status,400);
});
test('traversal, encoded separators and dotfiles cannot escape the static root',async()=>{
 for(const url of ['/../package.json','/%2e%2e/package.json','/%2e%2e%5cpackage.json','/.env','/%00'])assert.equal((await request(url)).status,403);
});
test('write methods are not accepted by this local preview server',async()=>{const r=await request('/','POST');assert.equal(r.status,405);assert.equal(r.headers.allow,'GET, HEAD');});
