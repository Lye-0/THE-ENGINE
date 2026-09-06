'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
require('../js/math.js');require('../js/kinematics.js');require('../js/geometry.js');require('../js/renderer.js');require('../js/engine.js');
const {M,V,G,Node,K,Engine}=globalThis.FERRO;
const close=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const samples={
 cylinder:()=>G.cylinder(.6,.7),ring:()=>G.ring(.67,.62,1.8),
 cutaway:()=>G.ring(.67,.62,1.8,64,Math.PI,Math.PI),
 box:()=>G.box(1,2,.5),sphere:()=>G.sphere(),torus:()=>G.torus(),
 tube:()=>G.tube([[0,0,0],[0,.3,0],[.2,.6,.1]],.03),
 spring:()=>G.helix(),gear:()=>G.gear(.4,40,.1),
 cam:()=>G.cam(Math.PI,'intake'),
 hollowRunner:()=>G.sweptPipe(G.curve([[0,0,0],[0,.3,.2],[.2,.6,.7]],24),.18,.022),
 sectionedRunner:()=>G.sweptPipe(G.curve([[0,0,0],[0,.3,.2],[.2,.6,.7]],24),.18,.022,24,0,Math.PI,[0,1,-1]),
 extrusion:()=>G.extrude([[-1,-1],[1,-1],[1,1],[-1,1]],.3,.02)
};
for(const [name,build] of Object.entries(samples))test(`${name}: finite indexed geometry and matching attribute lengths`,()=>{
 const g=build(),count=g.positions.length/3;
 assert.ok(count>0);assert.equal(g.normals.length,g.positions.length);assert.equal(g.uvs.length,count*2);
 assert.equal(g.indices.length%3,0);
 for(const arr of [g.positions,g.normals,g.uvs])assert.ok(arr.every(Number.isFinite));
 assert.ok(g.indices.every(i=>i>=0&&i<count));
});
test('torus triangle winding matches its outward surface normals',()=>{
 const g=G.torus(),p=i=>[...g.positions.slice(i*3,i*3+3)],n=i=>[...g.normals.slice(i*3,i*3+3)];
 for(let i=0;i<g.indices.length;i+=3){
  const [a,b,c]=g.indices.slice(i,i+3),normal=V.cross(V.sub(p(b),p(a)),V.sub(p(c),p(a)));
  assert.ok(V.dot(normal,n(a))>0);
 }
});
test('matrix composition, inversion and parent/child transforms agree',()=>{
 const a=M.compose([2,-1,.5],[.4,.8,.2],[2,3,4]),inv=M.invert(a),id=M.mul(a,inv);
 [...M.identity()].forEach((v,i)=>close(id[i],v));
 const root=new Node(null,null,[2,3,4]),child=root.group([1,2,3]);root.update();
 assert.deepEqual([...child.world.slice(12,15)],[3,5,7]);
});
test('empty rotation arrays on hardware parts cannot introduce NaNs',()=>{
 const node=new Node(null,null,[1,2,3],[]);node.update();assert.ok(node.world.every(Number.isFinite));
});
test('Catmull–Rom tubing passes through both requested endpoints',()=>{
 const points=[[0,0,0],[1,2,3],[4,5,6]],curve=G.curve(points,50);
 assert.deepEqual(curve[0],points[0]);assert.deepEqual(curve.at(-1),points.at(-1));
});
// No browser/GPU mock is involved in the model kinematics: only label canvases
// are stubbed; the shipped scene graph and generated meshes run unchanged.
globalThis.document={createElement:()=>({getContext:()=>({clearRect(){},fillText(){}})})};
const engine=new Engine({makeTexture:()=>({})});
test('the original engine contains four piston/rod pairs, two cams and 16 valves',()=>{
 assert.equal(engine.pistons.length,4);assert.equal(engine.rods.length,4);
 assert.equal(engine.cams.length,2);assert.equal(engine.valves.length,16);
});
test('actual model rod endpoints follow their piston pins and crank journals',()=>{
 for(let deg=0;deg<720;deg+=15){
  const angle=deg*Math.PI/180;engine.update(angle,.016,true);engine.root.update();
  for(let i=0;i<4;i++){
   const rod=engine.rods[i],end=M.transform(rod.world,[0,K.ROD_LENGTH,0]);
   const pin=M.transform(engine.pistons[i].world,[0,0,0]);
   end.slice(0,3).forEach((v,j)=>close(v,pin[j],2e-5));
   const crank=M.transform(rod.world,[0,0,0]),state=K.cylinderAt(angle,i);
   close(crank[1],state.crankY);close(crank[2],state.crankZ);
  }
 }
});
test('every view transition retains finite geometry transforms',()=>{
 for(const mode of ['exterior','exploded','cutaway']){
  engine.setMode(mode);for(let i=0;i<70;i++)engine.update(.75,.05,true);engine.root.update();
  const visit=n=>{assert.ok(n.world.every(Number.isFinite));for(const child of n.children)visit(child);};visit(engine.root);
 }
 assert.throws(()=>engine.setMode('unknown'));
});
test('inclined valves follow their own guides and clear the actual piston crown over 720 degrees',()=>{
 engine.setMode('cutaway');engine.reducedMotion=true;
 let minimum=Infinity;
 for(let d=0;d<720;d+=2){
  engine.update(d*K.DEG,.016,true);engine.root.update();
  for(const v of engine.valves){
   const axis=M.transform(v.frame.world,[0,1,0,0]);
   close(axis[1],Math.cos(K.HEAD.tilt));close(axis[2],v.side*Math.sin(K.HEAD.tilt));
   const lift=K.cylinderAt(d*K.DEG,v.i)[v.kind];
   const position=M.transform(v.moving.world,[0,0,0]),seat=M.transform(v.frame.world,[0,0,0]);
   for(let k=0;k<3;k++)close(position[k]-seat[k],-lift*axis[k]);
   const p=v.head.geometry.positions;
   const crown=engine.pistons[v.i].p[1]+K.HEAD.pistonCrown;
   for(let j=0;j<p.length;j+=3){
    const y=M.transform(v.head.world,p.subarray(j,j+3))[1];
    minimum=Math.min(minimum,y-crown);
   }
   assert.ok(K.HEAD.springHeight-lift>6*.04,'spring coils do not bind');
  }
 }
 assert.ok(minimum>.03,`minimum piston/valve clearance: ${minimum*K.MM_PER_UNIT} mm`);
});
test('all sixteen manufactured cam envelopes stay in contact with their bucket faces',()=>{
 engine.setMode('cutaway');engine.reducedMotion=true;
 for(let d=0;d<720;d+=10){
  engine.update(d*K.DEG,.016,true);engine.root.update();
  for(const lobe of engine.camLobes){
   const valve=engine.valves.find(v=>v.i===lobe.i&&v.kind===lobe.kind&&Math.abs(v.frame.p[0]-engine.xs[v.i]-lobe.dx)<1e-6);
   const axis=M.transform(valve.frame.world,[0,1,0,0]);
   const top=M.transform(valve.moving.world,[0,K.HEAD.followerTop,0]);
   const p=lobe.mesh.geometry.positions;
   let gap=Infinity;
   for(let j=0;j<p.length;j+=3){
    const point=M.transform(lobe.mesh.world,p.subarray(j,j+3));
    gap=Math.min(gap,V.dot(V.sub(point,top),axis));
   }
   assert.ok(gap>=-2e-5&&gap<6e-5,`${lobe.kind} ${d} deg: cam gap ${gap}`);
  }
 }
});
test('manifolds, injectors and ignition keep their physical attachments and visibility contracts',()=>{
 assert.equal(engine.injectors.length,4);assert.equal(engine.plugs.length,4);assert.equal(engine.primaryPaths.length,4);
 for(const nozzle of engine.injectors){
  assert.equal(nozzle.jets.length,2);
  for(const jet of nozzle.jets){
   jet.frame.update();
   const start=M.transform(jet.frame.world,[0,0,0]),end=M.transform(jet.frame.world,[0,jet.length,0]);
   start.slice(0,3).forEach((v,k)=>close(v,nozzle.nozzle[k]));
   end.slice(0,3).forEach((v,k)=>close(v,jet.target[k]));
  }
 }
 for(const mode of ['exterior','exploded','cutaway']){
  engine.setMode(mode);engine.update(710*K.DEG,.016,true);
  assert.ok(engine.headers.visible&&engine.intake.visible);
  for(const section of engine.manifoldSections)assert.equal(section.mesh.geometry,mode==='cutaway'?section.cut:section.full);
  if(mode!=='cutaway')assert.ok(engine.sparks.every(s=>!s.group.visible)&&engine.flames.every(f=>!f.visible));
 }
 engine.update(710*K.DEG,.016,false);
 assert.ok(engine.sparks.every(s=>!s.group.visible));assert.ok(engine.gases.every(g=>!g.visible));
 assert.ok(engine.injectors.every(i=>i.jets.every(j=>!j.mesh.visible)));
});
