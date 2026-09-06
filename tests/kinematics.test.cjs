'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/kinematics.js');
const close = (a,b,eps=1e-10) => assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('a four-stroke cycle is 720 degrees; negative angles wrap positively',()=>{
 close(K.CYCLE,4*Math.PI);close(K.wrap(-Math.PI),3*Math.PI);close(K.wrap(9*Math.PI),Math.PI);
});
test('top and bottom dead centre span exactly twice the crank radius',()=>{
 close(K.pistonAt(0).y,K.ROD_LENGTH+K.CRANK_RADIUS);
 close(K.pistonAt(Math.PI).y,K.ROD_LENGTH-K.CRANK_RADIUS);
 close(K.pistonAt(0).y-K.pistonAt(Math.PI).y,2*K.CRANK_RADIUS);
});
test('connecting-rod length remains constant through 1441 samples',()=>{
 for(let d=0;d<=1440;d++){
  const s=K.pistonAt(d*Math.PI/360);
  close(Math.hypot(s.y-s.crankY,s.crankZ),K.ROD_LENGTH);
  close(s.crankZ+K.ROD_LENGTH*Math.sin(s.rodAngle),0);
  close(s.crankY+K.ROD_LENGTH*Math.cos(s.rodAngle),s.y);
 }
});
test('cylinders 1/4 and 2/3 move together; all phases repeat after 720 degrees',()=>{
 for(let d=0;d<720;d+=7){
  const a=d*Math.PI/180;
  close(K.cylinderAt(a,0).y,K.cylinderAt(a,3).y);
  close(K.cylinderAt(a,1).y,K.cylinderAt(a,2).y);
  for(let i=0;i<4;i++)close(K.cylinderAt(a,i).y,K.cylinderAt(a+K.CYCLE,i).y);
 }
});
test('successive firing TDCs follow 1–3–4–2, separated by 180 degrees',()=>{
 const order=[0,2,3,1];
 order.forEach((i,k)=>{
  const s=K.cylinderAt(k*Math.PI,i);close(s.phase,0);assert.equal(s.stage.name,'POWER');
  close(s.y,K.ROD_LENGTH+K.CRANK_RADIUS);
 });
});
test('power, exhaust, intake, compression occupy successive idealised strokes',()=>{
 ['POWER','EXHAUST','INTAKE','COMPRESSION'].forEach((stage,i)=>{
  assert.equal(K.cylinderAt((i+.5)*Math.PI,0).stage.name,stage);
 });
});
test('valves have lead, lag and overlap, with a sealed compression/ignition interval',()=>{
 for(let d=0;d<720;d++){
  const s=K.cylinderAt(d*K.DEG,0);
  assert.ok(s.intake>=0&&s.intake<=K.VALVE_EVENTS.intake.lift);
  assert.ok(s.exhaust>=0&&s.exhaust<=K.VALVE_EVENTS.exhaust.lift);
  if(d>621||d<107){close(s.intake,0);close(s.exhaust,0);}
 }
 assert.ok(K.valveLift(360*K.DEG,'intake')>0&&K.valveLift(360*K.DEG,'exhaust')>0);
 for(const [kind,event] of Object.entries(K.VALVE_EVENTS)) close(K.valveLift(event.open+event.duration/2,kind),event.lift);
});
test('cam lift ramps meet the seat with zero velocity and acceleration and stay convex',()=>{
 for(const [kind,event] of Object.entries(K.VALVE_EVENTS)) {
  for(const endpoint of [event.open,event.open+event.duration]){
   for(const delta of [-1e-6,0,1e-6]){
    const m=K.valveMotion(endpoint+delta,kind);
    assert.ok(m.lift<1e-10&&Math.abs(m.velocity)<1e-8&&Math.abs(m.acceleration)<1e-6);
   }
  }
  for(let d=0;d<720;d+=.2){
   const m=K.valveMotion(d*K.DEG,kind);
   assert.ok(K.HEAD.camBase+m.lift+4*m.acceleration>.03,'cam profile has no undercut');
   assert.ok(Math.abs(2*m.velocity)<.18,'contact stays inside the 0.20-radius bucket');
   // Moving mass and installed preload, with the rate derived from wire/coil dimensions.
   const acceleration=m.acceleration*(6000/60*K.TAU)**2*K.MM_PER_UNIT/1000;
   assert.ok(K.SPRING.preload+K.SPRING.rate*m.lift*K.MM_PER_UNIT+K.SPRING.movingMass*acceleration>0,'positive cam contact force');
  }
 }
});
test('each spark occurs at its own compression TDC and has a real-time duration',()=>{
 for(const rpm of [800,1200,3000,6000]){
  const omega=rpm/60*K.TAU, ignition=K.ignitionAt(0,rpm);
  assert.ok(ignition.advance>0&&ignition.advance<=32*K.DEG);
  const start=ignition.start;
  assert.equal(K.ignitionAt(start-1e-5,rpm).active,false);
  assert.equal(K.ignitionAt(start+omega*.0006,rpm).active,true);
  assert.equal(K.ignitionAt(start+omega*.00121,rpm).active,false);
  assert.equal(K.ignitionAt(start+Math.PI*2,rpm).active,false,'no exhaust-TDC spark');
  for(let i=0;i<4;i++){
   const s=K.cylinderAt(K.FIRING_OFFSETS[i]+start+omega*.0002,i);
   assert.ok(K.ignitionAt(s.phase,rpm).active);close(s.intake,0);close(s.exhaust,0);
  }
 }
 close(K.HEAD.sparkGap*K.MM_PER_UNIT,.9);
});
test('port injection and its travelling spray remain inside the open intake event',()=>{
 for(const rpm of [800,1200,3000,6000]){
  const omega=rpm/60*K.TAU;
  for(let n=0;n<180;n++){
   const t=n*.00003;
   const phase=380*K.DEG+omega*t, injection=K.injectionAt(phase,rpm);
   assert.ok(injection.visible&&K.valveLift(phase,'intake')>0);
   assert.ok(injection.front>=0&&injection.front<=1&&injection.tail>=0&&injection.tail<=1);
   if(t<.003)assert.ok(injection.active);
  }
  assert.equal(K.injectionAt(380*K.DEG+omega*.0055,rpm).visible,false);
  assert.equal(K.injectionAt(700*K.DEG,rpm).active,false);
 }
});
test('camshaft rotates at exactly half the crankshaft angular speed',()=>{
 close(K.camAngle(K.CYCLE),K.TAU);close(K.camAngle(1.234),.617);
});
test('combustion starts after its spark, propagates with closed valves, then cools during expansion',()=>{
 for(const rpm of [800,1200,3000,6000]){
  const spark=K.ignitionAt(0,rpm),omega=rpm/60*K.TAU;
  for(const phase of [spark.start-.001,spark.start+omega*.0001,180*K.DEG,360*K.DEG,540*K.DEG]){
   const b=K.combustionAt(phase,rpm);assert.equal(b.visible,false);close(b.fraction,0);close(b.light,0);
  }
  let fraction=0,radius=0;
  for(let t=.00016*omega;t<spark.advance+50*K.DEG;t+=.5*K.DEG){
   const phase=spark.start+t,b=K.combustionAt(phase,rpm);
   assert.ok(b.visible&&b.fraction>=fraction&&b.radius>=radius);
   assert.ok(b.fraction>=0&&b.fraction<=1&&b.height>0&&b.front>=0&&b.front<=1);
   close(K.valveLift(phase,'intake'),0);close(K.valveLift(phase,'exhaust'),0);
   fraction=b.fraction;radius=b.radius;
  }
  let heat=Infinity;
  for(let angle=60;angle<148;angle++){
   const b=K.combustionAt(angle*K.DEG,rpm);close(b.fraction,1);close(b.front,0);
   assert.ok(b.heat<heat&&b.light>=0);heat=b.heat;
  }
 }
});
test('combustion repeats every 720 degrees in firing order and reverses deterministically when scrubbing',()=>{
 for(let angle=0;angle<720;angle+=3){
  const active=[];
  for(let i=0;i<4;i++){
   const phase=K.cylinderAt(angle*K.DEG,i).phase,b=K.combustionAt(phase);
   const next=K.combustionAt(phase+K.CYCLE);
   for(const key of ['fraction','floor','height','radius','front','heat'])close(b[key],next[key]);
   if(b.front>0)active.push(i);
  }
  assert.ok(active.length<=1);
 }
 for(const i of [0,2,3,1]){
  const angle=K.FIRING_OFFSETS[i]+12*K.DEG;
  assert.ok(K.combustionAt(K.cylinderAt(angle,i).phase).front>0);
 }
 const initial=K.combustionAt(5*K.DEG);K.combustionAt(60*K.DEG);
 assert.deepEqual(K.combustionAt(5*K.DEG),initial);
});
test('gas dilution conserves the reference charge across the moving pent-roof chamber',()=>{
 // Numerically integrate the actual sloping roof independently of the analytic volume formula.
 const volume=floor=>{
  let v=0;const dz=2*K.HEAD.bore/1000;
  for(let n=0;n<1000;n++){
   const z=-K.HEAD.bore+(n+.5)*dz;
   v+=2*Math.sqrt(K.HEAD.bore**2-z*z)*(K.chamberRoof(z)-floor)*dz;
  }
  return v;
 };
 for(const rpm of [800,1200,6000]){
  const spark=K.ignitionAt(0,rpm),start=K.combustionAt(spark.start,rpm),mass=volume(start.floor);
  for(const angle of [0,20,45,75,100]){
   const b=K.combustionAt(angle*K.DEG,rpm);
   assert.ok(Math.abs(volume(b.floor)*b.density/mass-1)<.00004);
  }
 }
});
test('RPM and presentation speed are independent, explicit time scales',()=>{
 close(K.advance(0,.01,1200,1),.4*Math.PI);
 close(K.advance(0,.01,1200,.025),.01*Math.PI);
 close(K.advance(1,-5,1200,1),1);
 close(K.advance(1,2,0,1),1);
});
test('invalid cylinder indices, dimensions and nonfinite motion are rejected',()=>{
 for(const i of [-1,4,1.5,NaN])assert.throws(()=>K.cylinderAt(0,i),RangeError);
 assert.throws(()=>K.pistonAt(0,2,1),RangeError);
 assert.throws(()=>K.pistonAt(0,0,1),RangeError);
 assert.throws(()=>K.advance(0,NaN,1000,1),TypeError);
});
