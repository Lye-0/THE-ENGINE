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
  if(mode!=='cutaway')assert.ok(engine.sparks.every(s=>!s.group.visible)&&engine.gases.every(g=>!g.visible));
 }
 engine.update(710*K.DEG,.016,false);
 assert.ok(engine.sparks.every(s=>!s.group.visible));assert.ok(engine.gases.every(g=>!g.visible));
 assert.ok(engine.injectors.every(i=>i.jets.every(j=>!j.mesh.visible)));
});

// Intersect the actual triangles, so a visually hidden wall cannot pass these
// checks merely because the emitter and destination coordinates line up.
const geometryBounds=new Map();
function segmentHitsGeometry(g,start,end){
 const d=V.sub(end,start),p=g.positions;
 if(!geometryBounds.has(g.id)){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  p.forEach((v,i)=>{min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);});
  geometryBounds.set(g.id,{min,max});
 }
 const {min,max}=geometryBounds.get(g.id);let low=0,high=1;
 for(let a=0;a<3;a++){
  if(Math.abs(d[a])<1e-12){if(start[a]<min[a]||start[a]>max[a])return false;}
  else{const t0=(min[a]-start[a])/d[a],t1=(max[a]-start[a])/d[a];low=Math.max(low,Math.min(t0,t1));high=Math.min(high,Math.max(t0,t1));}
 }
 if(low>high)return false;
 for(let k=0;k<g.indices.length;k+=3){
  const q=[0,1,2].map(i=>p.subarray(g.indices[k+i]*3,g.indices[k+i]*3+3));
  const e1=V.sub(q[1],q[0]),e2=V.sub(q[2],q[0]),h=V.cross(d,e2),det=V.dot(e1,h);
  if(Math.abs(det)<1e-12)continue;
  const s=V.sub(start,q[0]),u=V.dot(s,h)/det;if(u<0||u>1)continue;
  const cross=V.cross(s,e1),v=V.dot(d,cross)/det;if(v<0||u+v>1)continue;
  const t=V.dot(e2,cross)/det;if(t>1e-5&&t<1-1e-5)return true;
 }
 return false;
}
test('shared port inlets keep a clear bore in full and sectioned geometry',()=>{
 assert.equal(engine.portPassages.length,8);
 for(const port of engine.portPassages){
  const radius=(port.side<0?.205:.177)-.022;
  const start=V.add(port.trunk[0],[0,0,port.side*.045]);
  const end=V.add(port.trunk.at(-1),[0,0,port.side*.03]);
  for(const geometry of [port.full,port.cut]){
   assert.ok(geometry.positions.every(Number.isFinite)&&geometry.normals.every(Number.isFinite));
   assert.ok(geometry.indices.every(i=>i<geometry.positions.length/3));
   for(const u of [-.5,-.25,0,.25,.5])for(const v of [-.5,-.25,0,.25,.5]){
    const offset=[u*radius,v*radius,0];
    assert.equal(segmentHitsGeometry(geometry,V.add(start,offset),V.add(end,offset)),false,`inlet blocked: cylinder ${port.i+1}, bank ${port.side}`);
   }
  }
 }
});
test('combustion volume follows each piston crown and lighting stops with effects or detached parts',()=>{
 engine.reducedMotion=true;engine.setMode('cutaway');
 for(let deg=0;deg<720;deg+=5){
  engine.update(deg*K.DEG,.016,true);
  engine.gases.forEach((gas,i)=>{
   const state=K.cylinderAt(deg*K.DEG,i),burn=K.combustionAt(state.phase),chamber=gas.material.chamber;
   close(chamber[0],engine.xs[i]);close(chamber[1],state.y+K.HEAD.pistonCrown+.002);
   close(gas.p[1]-gas.s[1]/2,chamber[1]);close(gas.p[1]+gas.s[1]/2,K.ROOF_Y);
   close(gas.material.burnShape[0]*gas.s[1],burn.referenceHeight);
   assert.ok(gas.material.burn.every(Number.isFinite));
   close(engine.combustionLights[i*4+3],burn.light);
  });
 }
 for(const [mode,effects] of [['cutaway',false],['exterior',true],['exploded',true]]){
  engine.setMode(mode);engine.update(24*K.DEG,.016,effects);
  assert.ok(engine.gases.every(g=>!g.visible));
  for(let i=0;i<4;i++){close(engine.combustionLights[i*4+3],0);close(engine.ignitionLights[i*4+3],0);}
 }
 engine.setMode('cutaway');engine.update(24*K.DEG,.016,true);
 assert.ok(engine.gases[0].visible&&engine.combustionLights[3]>0);
});
test('both injector spray cones have clear passages through each intake fork',()=>{
 for(const injector of engine.injectors){
  const port=engine.portPassages.find(p=>p.i===injector.i&&p.side===-1);
  const centre=[engine.xs[injector.i],0,0],start=V.sub(injector.nozzle,centre);
  for(const jet of injector.jets){
   const target=V.sub(jet.target,centre),axis=V.norm(V.sub(target,start));
   const u=V.norm(V.cross(axis,[0,1,0])),v=V.cross(axis,u);
   for(const geometry of [port.full,port.cut])for(let sample=0;sample<9;sample++){
    const angle=sample/8*Math.PI*2,r=sample===8?0:jet.length*.105*.6;
    const end=V.add(target,V.add(V.mul(u,Math.cos(angle)*r),V.mul(v,Math.sin(angle)*r)));
    assert.equal(segmentHitsGeometry(geometry,start,end),false,`spray hits pipe wall: cylinder ${injector.i+1}, sample ${sample}`);
   }
  }
 }
});
test('visible head supports and hardware do not cross the common intake passages',()=>{
 engine.setMode('cutaway');engine.reducedMotion=true;engine.update(398*K.DEG,.016,false);engine.root.update();
 const meshes=[];
 const collect=n=>{if(!n.visible)return;if(n.geometry&&n.material.alpha>=.995)meshes.push({n,inverse:M.invert(n.world)});n.children.forEach(collect);};
 collect(engine.root);
 for(const port of engine.portPassages.filter(p=>p.side===-1)){
  const origin=[engine.xs[port.i],0,0];
  const start=V.add(origin,V.add(port.trunk[0],[0,0,-.045]));
  const end=V.add(origin,V.add(port.trunk.at(-1),[0,0,-.03]));
  for(const x of [-.09,0,.09])for(const y of [-.09,0,.09]){
   const a=V.add(start,[x,y,0]),b=V.add(end,[x,y,0]);
   for(const {n,inverse} of meshes){
    assert.equal(segmentHitsGeometry(n.geometry,M.transform(inverse,a).slice(0,3),M.transform(inverse,b).slice(0,3)),false,`head mesh ${n.id} crosses cylinder ${port.i+1} inlet`);
   }
  }
 }
});
