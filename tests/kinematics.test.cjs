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
test('idealised inlet and exhaust valves never open during compression or power',()=>{
 for(let d=0;d<720;d++){
  const s=K.cylinderAt(d*Math.PI/180,0);
  assert.ok(s.intake>=0&&s.intake<=.16);assert.ok(s.exhaust>=0&&s.exhaust<=.16);
  if(s.stageIndex===0||s.stageIndex===3){close(s.intake,0);close(s.exhaust,0);}
  assert.ok(!(s.intake>0&&s.exhaust>0));
 }
 close(K.valveLift(1.5*Math.PI,'exhaust'),.16);
 close(K.valveLift(2.5*Math.PI,'intake'),.16);
});
test('camshaft rotates at exactly half the crankshaft angular speed',()=>{
 close(K.camAngle(K.CYCLE),K.TAU);close(K.camAngle(1.234),.617);
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
