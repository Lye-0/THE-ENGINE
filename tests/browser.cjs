const {chromium}=require(process.env.THE_ENGINE_PLAYWRIGHT_MODULE || 'playwright');
const {execFileSync}=require('node:child_process');
const os=require('node:os');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');const {pathToFileURL}=require('node:url');
(async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'the-engine-browser-'));
 const output=process.env.THE_ENGINE_TEST_OUTPUT?path.resolve(process.env.THE_ENGINE_TEST_OUTPUT):temporary;
 fs.mkdirSync(output,{recursive:true});
 const preview=path.join(temporary,'preview.html'),results=[];
 execFileSync(process.execPath,[path.resolve(__dirname,'../scripts/build-preview.mjs'),preview]);
 const browser=await chromium.launch({headless:true,...(process.env.THE_ENGINE_BROWSER_CHANNEL?{channel:process.env.THE_ENGINE_BROWSER_CHANNEL}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(pathToFileURL(preview).href);await page.waitForFunction(()=>window.ferro?.state.ready);
  assert.equal(await page.title(),'THE ENGINE');
  results.push('Initial render, title and reduced-motion pause');
  for(const kind of ['ignition','injection']){
   await page.locator(`[data-inspection="${kind}"]`).click();
   await page.waitForFunction(()=>Math.abs(ferro.camera.radius-ferro.camera.radiusGoal)<.002);
   const result=await page.evaluate(kind=>{
    const {K,V}=FERRO,e=ferro.engine,r=ferro.renderer;
    const target=kind==='ignition'?[e.xs[0],K.HEAD.sparkY-K.HEAD.sparkGap/2,0]:V.lerp(e.injectors[1].nozzle,e.injectors[1].jets[0].target,.55);
    const screen=r.project(target),size=64,scale=r.width/r.canvas.clientWidth;
    const x=Math.round(screen[0]*scale-size/2),y=Math.round(r.height-screen[1]*scale-size/2);
    const before=new Uint8Array(size*size*4),after=new Uint8Array(before.length),gl=r.gl;
    r.render(e.root,r.camera,ferro.state.angle);
    gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,before);
    const affected=kind==='ignition'?e.sparks.map(s=>s.group):e.injectors.flatMap(i=>[...i.jets.map(j=>j.mesh),...i.drops.map(d=>d.mesh)]);
    const visibility=affected.map(n=>n.visible);affected.forEach(n=>n.visible=false);
    r.render(e.root,r.camera,ferro.state.angle);gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,after);
    affected.forEach((n,i)=>n.visible=visibility[i]);r.render(e.root,r.camera,ferro.state.angle);
    let changed=0,total=0;for(let i=0;i<before.length;i+=4){const d=Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]);if(d>6)changed++;total+=d;}
    return {kind,changed,total,paused:!ferro.state.running,glError:gl.getError(),inspection:ferro.camera.inspection,sparks:e.sparks.filter(s=>s.group.visible).length,sprays:e.injectors.map(i=>i.jets.filter(j=>j.mesh.visible).length)};
   },kind);
   console.log(result);assert.equal(result.glError,0);assert.ok(result.paused);assert.ok(result.changed>20,`${kind} is visibly rendered at its physical source`);
   if(kind==='ignition')assert.equal(result.sparks,1);else assert.deepEqual(result.sprays,[0,2,0,0]);
   results.push(`${kind}: source position, visible pixels, correct cylinder and pause`);
   await page.screenshot({path:path.join(output,`realism-${kind}.png`)});
   await page.locator('#combustion').click();await page.waitForFunction(()=>!ferro.state.combustion&&ferro.engine.gases.every(g=>!g.visible));
   assert.ok(await page.evaluate(()=>ferro.engine.sparks.every(s=>!s.group.visible)&&ferro.engine.injectors.every(i=>i.jets.every(j=>!j.mesh.visible))));
  }
  for(const mode of ['exterior','exploded','cutaway']){
   await page.locator(`[data-mode="${mode}"]`).click();await page.waitForFunction(mode=>ferro.state.mode===mode&&ferro.engine.explosion===(mode==='exploded'?1:0),mode);
   assert.equal(await page.locator('[data-inspection="overview"]').getAttribute('aria-pressed'),'true');
   assert.ok(await page.evaluate(()=>ferro.engine.headers.visible&&ferro.engine.intake.visible&&ferro.getDiagnostics().webglError===0));
   await page.screenshot({path:path.join(output,`realism-${mode}.png`)});
  }
  results.push('Exterior, exploded and cutaway keep attached manifolds and reset observation controls');
  await page.locator('#explore').click();await page.locator('#part-next').click();assert.equal(await page.locator('#part-title').innerText(),'クランクシャフト');
  assert.equal(await page.locator('#part-page').innerText(),'02 / 08');await page.keyboard.press('Escape');
  results.push('Eight-part exploration, navigation and Escape');
  for(const q of [0,2,1]){await page.evaluate(q=>ferro.setQuality(q),q);await page.waitForFunction(q=>ferro.state.quality===q&&ferro.getDiagnostics().webglError===0,q);}
  results.push('All three rendering qualities including new shaders');
  await page.locator('[data-inspection="overview"]').click();
  const angle=await page.evaluate(()=>ferro.state.angle);
  await page.locator('#play').click();await page.waitForFunction(a=>Math.abs(ferro.state.angle-a)>.08,angle);
  await page.locator('#play').click();assert.equal(await page.evaluate(()=>ferro.state.running),false);
  await page.locator('#angle').fill('450');await page.locator('#angle').dispatchEvent('input');
  assert.ok(await page.evaluate(()=>Math.abs(ferro.state.angle-450*FERRO.K.DEG)<1e-8));
  await page.locator('#rpm').fill('3000');await page.locator('#rpm').dispatchEvent('input');
  assert.equal(await page.locator('#rpm-readout').innerText(),'3,000');
  await page.locator('#speed').selectOption('0.1');assert.equal(await page.evaluate(()=>ferro.state.speed),.1);
  await page.locator('#orbit').click();const yaw=await page.evaluate(()=>ferro.camera.yaw);
  await page.waitForFunction(y=>ferro.camera.yaw!==y,yaw);await page.locator('#reset').click();
  assert.ok(await page.evaluate(()=>!ferro.camera.auto&&ferro.camera.yaw===-.65));
  await page.locator('#play').click();await page.locator('#help').click();
  assert.ok(await page.evaluate(()=>document.querySelector('#about').open&&!ferro.state.running));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#about').open&&ferro.state.running);
  await page.locator('#play').click();
  await page.evaluate(()=>{ferro.setRPM(1200);ferro.setSpeed(.025);});
  results.push('Playback, pause, crank scrub, RPM, speed, orbit/reset and modal resume');
  for(const [width,height] of [[390,844],[320,740],[820,1180]]){
   await page.setViewportSize({width,height});
   await page.locator('[data-inspection="ignition"]').click();await page.waitForFunction(()=>Math.abs(ferro.camera.radius-ferro.camera.radiusGoal)<.002);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const controls=await page.locator('.inspection-views').boundingBox();assert.ok(controls.x>=0&&controls.x+controls.width<=width);
   await page.locator('#toast').evaluate(n=>n.classList.remove('show'));
   await page.screenshot({path:path.join(output,`realism-${width}.png`)});
   results.push(`Responsive observation controls at ${width} × ${height}`);
  }
  assert.deepEqual(errors,[]);results.push('No JavaScript or WebGL errors');
  fs.writeFileSync(path.join(output,'realism-browser-verification.json'),JSON.stringify({browser:await browser.version(),checks:results},null,2));
  console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();for(const file of fs.readdirSync(temporary))fs.unlinkSync(path.join(temporary,file));fs.rmdirSync(temporary);}
})().catch(error=>{console.error(error);process.exitCode=1;});
