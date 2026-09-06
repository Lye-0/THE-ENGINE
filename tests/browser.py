import json,math,time,os,subprocess,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
# The browser exercises a portable build of exactly the shipped split sources.
# HTTP serving is tested separately by server.test.cjs.
with tempfile.TemporaryDirectory(prefix='ferro-browser-') as temp:
 preview=Path(temp)/'preview.html'
 subprocess.run(['node',str(ROOT/'scripts/build-preview.mjs'),str(preview)],check=True,capture_output=True,text=True)
 HTML=preview.read_text(encoding='utf-8')
checks=[]
def check(name,condition):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 launch={'headless':True}
 if os.environ.get('FERRO_BROWSER_EXECUTABLE'):launch['executable_path']=os.environ['FERRO_BROWSER_EXECUTABLE']
 args=['--disable-dev-shm-usage']
 if os.environ.get('FERRO_SOFTWARE_GL')=='1':args+=['--use-angle=swiftshader','--enable-unsafe-swiftshader']
 if os.environ.get('FERRO_NO_SANDBOX')=='1':args+=['--no-sandbox']
 b=p.chromium.launch(args=args,**launch)
 page=b.new_page(viewport={'width':1024,'height':768},has_touch=True,reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.set_content(HTML,wait_until='load');page.wait_for_function('window.ferro?.state.ready',timeout=60000)
 check('WebGL2 initial render and zero GL errors',page.evaluate('ferro.getDiagnostics().webglError===0'))
 check('Reduced motion starts paused',page.evaluate('!ferro.state.running'))
 check('Standard quality is the initial default',page.evaluate('ferro.state.quality===1'))
 check('No audio context before user gesture',page.evaluate('!ferro.audio.ctx'))
 page.evaluate('ferro.setQuality(0)');page.wait_for_timeout(250)
 frames=page.evaluate('ferro.state.frames');page.wait_for_timeout(400)
 check('Paused idle view does not keep drawing unchanged frames',page.evaluate('ferro.state.frames')==frames)
 page.click('#play');page.wait_for_timeout(300);page.click('#play')
 check('Play advances the shared crank angle',page.evaluate('Math.abs(ferro.state.angle-75*Math.PI/180)>.01'))
 angle=page.evaluate('ferro.state.angle');page.wait_for_timeout(120)
 check('Pause holds the crank angle',page.evaluate('ferro.state.angle')==angle)
 page.locator('#angle').evaluate("e=>{e.value='450';e.dispatchEvent(new Event('input',{bubbles:true}))}")
 check('Crank scrub drives actual piston and valve transforms',page.evaluate('Math.abs(ferro.state.angle-2.5*Math.PI)<1e-6 && Math.abs(ferro.engine.valves[0].moving.p[1]+FERRO.K.valveLift(2.5*Math.PI,\"intake\"))<1e-5'))
 page.locator('#rpm').evaluate("e=>{e.value='3000';e.dispatchEvent(new Event('input',{bubbles:true}))}")
 check('RPM input updates state and both readouts',page.evaluate('ferro.state.rpm===3000 && document.querySelector("#rpm-readout").textContent==="3,000"'))
 page.select_option('#speed','0.1');check('Playback-speed select updates state',page.evaluate('ferro.state.speed===.1'))
 page.click('#combustion');page.wait_for_function('!ferro.state.combustion && ferro.engine.gases.every(g=>!g.visible)',timeout=15000)
 check('Combustion switch hides the gas meshes',page.evaluate('!ferro.state.combustion && ferro.engine.gases.every(g=>!g.visible)'))
 page.click('#combustion')
 for mode in ['exterior','exploded','cutaway']:
  page.click('[data-mode="'+mode+'"]');goal=1 if mode=='exploded' else 0
  page.wait_for_function(f'Math.abs(ferro.engine.explosion-{goal})<.001',timeout=30000)
  check(mode+' switches model visibility and keeps a valid WebGL target',page.evaluate(f'ferro.state.mode==="{mode}" && ferro.getDiagnostics().webglError===0'))
 check('Timing chain returns after leaving exploded mode',page.evaluate('ferro.engine.timing.visible'))
 # Actual mouse/wheel input, not programmatic camera assignment.
 box=page.locator('#engine-canvas').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 yaw=page.evaluate('ferro.camera.yaw');page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+70,y+25,steps=3);page.mouse.up()
 check('Dragging orbits the camera',page.evaluate('ferro.camera.yaw')!=yaw)
 radius=page.evaluate('ferro.camera.radiusGoal');page.mouse.wheel(0,-100)
 page.wait_for_timeout(100);check('Wheel zoom changes camera distance',page.evaluate('ferro.camera.radiusGoal')<radius)
 target=page.evaluate('ferro.camera.targetGoal');page.mouse.move(x,y);page.mouse.down(button='right');page.mouse.move(x+20,y+10,steps=2);page.mouse.up(button='right')
 check('Right drag pans the view',page.evaluate('ferro.camera.targetGoal')!=target)
 page.click('#reset');page.wait_for_timeout(100)
 check('Reset restores framing and stops auto-orbit',page.evaluate('ferro.camera.yaw===-.65 && !ferro.camera.auto'))
 page.click('#orbit');yaw=page.evaluate('ferro.camera.yaw');page.wait_for_timeout(160)
 check('Auto-orbit moves the camera',page.evaluate('ferro.camera.yaw')!=yaw);page.click('#orbit')
 # Two-finger gesture through the browser input pipeline.
 cdp=page.context.new_cdp_session(page);radius=page.evaluate('ferro.camera.radiusGoal')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x-35,'y':y,'id':1},{'x':x+35,'y':y,'id':2}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-60,'y':y,'id':1},{'x':x+60,'y':y,'id':2}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 check('Two-finger pinch changes camera distance',page.evaluate('ferro.camera.radiusGoal')<radius)
 page.click('#reset');page.click('#explore');page.wait_for_function('ferro.state.exploring && !!document.querySelector(".hotspot").style.left',timeout=15000)
 check('Explore opens a focused part panel and projected hotspots',page.evaluate('ferro.state.exploring && !document.querySelector("#part-panel").hidden && !!document.querySelector(".hotspot").style.left'))
 page.click('#part-next');check('Part pagination updates the actual description',page.evaluate('ferro.state.part===1 && document.querySelector("#part-title").textContent==="クランクシャフト"'))
 page.keyboard.press('Escape');check('Escape closes exploration even from a focused panel button',page.evaluate('!ferro.state.exploring'))
 page.click('#sound');check('Audio starts only after the sound-button gesture',page.evaluate('ferro.audio.enabled && ferro.audio.ctx.state==="running"'))
 page.click('#play');page.wait_for_timeout(150)
 check('Synthetic sound gains rise during playback',page.evaluate('ferro.audio.master.gain.value>0'))
 page.click('#help');check('Help pauses motion and opens a modal',page.evaluate('document.querySelector("#about").open && !ferro.state.running'))
 page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#about").open && ferro.state.running',timeout=15000);check('Closing help restores the previous playback state',page.evaluate('!document.querySelector("#about").open && ferro.state.running'))
 page.click('#play');page.click('#sound');check('Sound off disables synthesis output',page.evaluate('!ferro.audio.enabled'))
 for q in [1,2,0]:
  page.evaluate(f'ferro.setQuality({q})');page.wait_for_timeout(150)
  check(f'Quality {q} resizes a complete framebuffer',page.evaluate('ferro.getDiagnostics().webglError===0'))
 check('Browser console contains no errors',not errors)
 diagnostics=page.evaluate('ferro.getDiagnostics()')
 # Unsupported-WebGL fallback is tested in a separate page, not the real app page.
 fallback=b.new_page();fallback.set_content('<script>HTMLCanvasElement.prototype.getContext=function(){return null}</script>'+HTML,wait_until='load');fallback.wait_for_selector('.error-message',timeout=10000)
 check('Missing WebGL2 produces an explanatory fallback instead of a blank page','3Dを開始できませんでした' in fallback.locator('.error-message').inner_text())
 b.close()
 (ROOT/'docs/browser-checks.json').write_text(json.dumps({'checks':checks,'count':len(checks),'errors':errors,'diagnostics':diagnostics},ensure_ascii=False,indent=2),encoding='utf-8')
 print('ALL',len(checks),'PASS',flush=True)
