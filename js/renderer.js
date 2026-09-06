/* THE ENGINE WebGL2 renderer — instanced geometry, GGX metals, procedural studio
 * reflections, soft shadow mapping and depth/normal ambient occlusion.
 * All shaders, textures and meshes are generated locally; no network requests.
 */
(function (F) {
    'use strict';
    const { M, V } = F;
    const SPRING_SHAPE = `uniform vec4 uSpring;
void springShape(inout vec3 p,inout vec3 n,vec2 uv){if(uSpring.x<=0.)return;float w=6.28318530718*uSpring.z,a=uv.y*w,b=uv.x*6.28318530718;float height=uSpring.y-2.*uSpring.w;vec3 radial=vec3(cos(a),0.,sin(a));vec3 tangent=normalize(vec3(-uSpring.x*w*sin(a),height,uSpring.x*w*cos(a)));n=cos(b)*radial+sin(b)*cross(tangent,radial);p=vec3(uSpring.x*cos(a),uSpring.w+uv.y*height,uSpring.x*sin(a))+uSpring.w*n;}`;
    const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in mat4 aModel;
uniform mat4 uVP; uniform mat4 uLightVP; uniform mat4 uView;
out vec3 vWorld; out vec3 vNormal; out vec3 vLocal; out vec2 vUV; out vec4 vShadow;
${SPRING_SHAPE}
void main(){vec3 p=aPosition,n=aNormal;springShape(p,n,aUV);vec4 world=aModel*vec4(p,1.0);vWorld=world.xyz;vNormal=transpose(inverse(mat3(aModel)))*n;vLocal=p;vUV=aUV;vShadow=uLightVP*world;gl_Position=uVP*world;}`;
    const FRAG = `#version 300 es
precision highp float;
in vec3 vWorld;in vec3 vNormal;in vec3 vLocal;in vec2 vUV;in vec4 vShadow;
layout(location=0) out vec4 outColor;layout(location=1) out vec4 outNormal;
uniform vec3 uCamera;uniform mat4 uView;uniform vec3 uColor;uniform float uMetal;uniform float uRough;uniform float uAlpha;uniform float uKind;uniform float uEmission;uniform float uAO;uniform float uTime;
uniform sampler2D uShadow;uniform sampler2D uMap;uniform float uUseMap;uniform float uShadowTexel;uniform int uQuality;
uniform vec4 uIgnitionLights[4];uniform vec4 uChamber;uniform vec3 uFlow;uniform float uChamberSlope;
uniform vec4 uSprayOrigin;uniform vec3 uSprayAxis;
uniform vec4 uBurn;uniform vec4 uBurnShape;uniform vec4 uCombustionLights[4];uniform vec2 uCombustionBounds;
uniform sampler2D uOpaqueDepth;uniform mat4 uInverseVP;uniform vec2 uViewport;
const float PI=3.14159265359;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float card(vec3 d,vec3 centre,vec3 up,float w,float h,float blur){vec3 n=normalize(centre),u=normalize(cross(up,n)),v=cross(n,u);float facing=max(dot(d,n),0.0);vec2 p=vec2(dot(d,u),dot(d,v));vec2 edge=abs(p)-vec2(w,h);float sdf=length(max(edge,0.0))+min(max(edge.x,edge.y),0.0);return (1.0-smoothstep(-blur,blur,sdf))*smoothstep(0.0,.45,facing);}
vec3 environment(vec3 d,float r){float blur=.035+r*r*.55;vec3 env=mix(vec3(.025,.033,.039),vec3(.135,.16,.175),clamp(d.y*.55+.4,0.0,1.0));
env+=vec3(4.0,4.1,4.15)*card(d,vec3(-1.6,1.4,2.1),vec3(0,1,0),.15,.7,blur);
env+=vec3(2.1,2.55,2.9)*card(d,vec3(1.3,.7,-1.7),vec3(0,1,0),.20,.67,blur);
env+=vec3(3.1,2.95,2.6)*card(d,vec3(.2,2.0,.2),vec3(0,0,1),.68,.16,blur);
env+=vec3(.8,.91,1.0)*card(d,vec3(-1,-.05,-1),vec3(0,1,0),.06,.62,blur);
return env*(1.0-r*.26);}
vec3 fresnel(float v,vec3 f0){return f0+(1.0-f0)*pow(clamp(1.0-v,0.0,1.0),5.0);}
vec3 lightBRDF(vec3 n,vec3 v,vec3 l,vec3 radiance,vec3 color,float rough,float metal){vec3 h=normalize(v+l);float nv=max(dot(n,v),.001),nl=max(dot(n,l),0.0),nh=max(dot(n,h),0.0),hv=max(dot(h,v),0.0);float a=rough*rough,a2=a*a,den=nh*nh*(a2-1.)+1.,D=a2/(PI*den*den+.00001);float k=(rough+1.)*(rough+1.)/8.,G=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));vec3 ff=fresnel(hv,mix(vec3(.04),color,metal));vec3 spec=D*G*ff/(4.*nv*max(nl,.001)+.0001);return ((1.-ff)*(1.-metal)*color/PI+spec)*radiance*nl;}
float shadow(vec3 n){vec3 p=vShadow.xyz/vShadow.w*.5+.5;if(p.z<0.||p.z>1.||p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;float bias=max(.00035,.0010*(1.-max(dot(n,normalize(vec3(-4,8,5))),0.)));float sum=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float dd=texture(uShadow,p.xy+vec2(float(x),float(y))*uShadowTexel*1.4).r;sum+=p.z-bias>dd?0.:1.;}return mix(.23,1.,sum/9.);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
bool clipPlane(vec3 n,float limit,vec3 origin,vec3 ray,inout vec2 interval){
 float speed=dot(n,ray),gap=limit-dot(n,origin);
 if(abs(speed)<.00001)return gap>=0.;
 float t=gap/speed;if(speed>0.)interval.y=min(interval.y,t);else interval.x=max(interval.x,t);
 return interval.y>interval.x;
}
vec4 chamberVolume(vec3 ray){
 vec3 origin=uCamera-vec3(uChamber.x,0,0);vec2 interval=vec2(0.,100.);
 float a=dot(ray.xz,ray.xz),b=dot(origin.xz,ray.xz),c=dot(origin.xz,origin.xz)-uChamber.z*uChamber.z;
 if(a>.000001){float disc=b*b-a*c;if(disc<=0.)return vec4(0);float d=sqrt(disc);interval=vec2(max(0.,(-b-d)/a),(-b+d)/a);}else if(c>0.)return vec4(0);
 if(!clipPlane(vec3(0,-1,0),-uChamber.y,origin,ray,interval))return vec4(0);
 if(!clipPlane(vec3(0,1,uChamberSlope),uChamber.w,origin,ray,interval))return vec4(0);
 if(!clipPlane(vec3(0,1,-uChamberSlope),uChamber.w,origin,ray,interval))return vec4(0);
 vec2 uv=gl_FragCoord.xy/uViewport;float depth=texture(uOpaqueDepth,uv).r;
 if(depth<.999999){vec4 opaque=uInverseVP*vec4(uv*2.-1.,depth*2.-1.,1.);interval.y=min(interval.y,length(opaque.xyz/opaque.w-uCamera));}
 if(interval.y<=interval.x)return vec4(0);
 int steps=uQuality==0?24:uQuality==1?40:56;float stepSize=(interval.y-interval.x)/float(steps);
 float jitter=hash(vec3(gl_FragCoord.xy,17));vec3 sum=vec3(0);float alpha=0.;
 for(int i=0;i<56;i++){
  if(i>=steps||alpha>.985)break;
  vec3 q=origin+ray*(interval.x+(float(i)+jitter)*stepSize);
  // Stretch burned gas with the moving piston; the initial kernel starts at the electrode gap.
  vec3 fuel=vec3(q.x,(uChamber.w-q.y)*uBurnShape.x-uBurnShape.y,q.z);
  vec3 drift=vec3(uBurnShape.z*.45,-uBurnShape.z*.8,uBurnShape.z*.25);
  float eddies=.65*noise(fuel*18.+drift)+.35*noise(fuel*43.-drift*1.7);
  float wrinkle=(eddies-.5)*.09*min(1.,uBurn.x/.16);
  float distanceToFront=length(fuel)+wrinkle-uBurn.x;
  float width=max(.012+.018*uBurn.w,stepSize*.55);
  float burned=(1.-smoothstep(-width,width,distanceToFront))*step(.000001,uBurn.w);
  float wallDistance=min(uChamber.z-length(q.xz),min(q.y-uChamber.y,uChamber.w-abs(q.z)*uChamberSlope-q.y));
  float quench=smoothstep(0.,.007,wallDistance);
  float front=exp(-pow(distanceToFront/width,2.))*uBurn.y*step(.000001,uBurn.w)*quench;
  float hot=burned*uBurn.z*uBurnShape.w*(.40+.8*eddies);
  float density=front*24.+hot*3.4+uFlow.x;
  vec3 radiance=(front*24.*vec3(5.,1.85,.32)+hot*3.4*vec3(1.8,.20,.022)+uFlow.x*uColor*.4)/max(.00001,density);
  float opacity=1.-exp(-density*stepSize);
  sum+=(1.-alpha)*opacity*radiance;alpha+=(1.-alpha)*opacity;
 }
 return vec4(pow(aces(sum/max(alpha,.00001)),vec3(1./2.2)),alpha);
}
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec3 view=normalize(uCamera-vWorld);float rough=clamp(uRough,.08,.95),metal=uMetal;vec3 base=pow(uColor,vec3(2.2));float alpha=uAlpha;
if(uKind>9.5&&uKind<10.5){if(dot(normalize(vNormal),view)<0.)discard;vec4 volume=chamberVolume(-view);if(volume.a<.001)discard;outColor=volume;outNormal=vec4(normalize(mat3(uView)*n)*.5+.5,1);return;}
if(uChamber.z>0.0){vec2 radial=vec2(vWorld.x-uChamber.x,vWorld.z);if(length(radial)>uChamber.z||vWorld.y<uChamber.y||vWorld.y>uChamber.w-abs(vWorld.z)*uChamberSlope)discard;}
if(uUseMap>.5){vec4 tex=texture(uMap,vUV);base*=pow(tex.rgb,vec3(2.2));alpha*=tex.a;if(alpha<.02)discard;}
if(uKind>5.5&&uKind<6.5){alpha*=pow(abs(dot(n,view)),.9);vec3 radiance=uColor*(.55+.45*clamp(uEmission/8.,0.,1.));outColor=vec4(radiance,alpha);outNormal=vec4(normalize(mat3(uView)*n)*.5+.5,1);return;}
if(uKind>8.5&&uKind<9.5){if(dot(normalize(vNormal),view)<0.)discard;float optical=0.;float stepSize=uSprayOrigin.w/32.;float jitter=hash(vWorld*230.);for(int i=0;i<32;i++){vec3 q=vWorld-view*(float(i)+jitter)*stepSize-uSprayOrigin.xyz;float axial=dot(q,uSprayAxis),t=axial/uSprayOrigin.w;float radius=max(.001,.105*axial);float radial=length(q-uSprayAxis*axial)/radius;if(t>uFlow.y&&t<uFlow.x&&radial<1.){float density=exp(-3.*radial*radial)*(.55+.45*noise(q*180.+vec3(0,0,-uFlow.z)));optical+=density*stepSize;}}alpha*=1.-exp(-optical*60.);if(alpha<.001)discard;outColor=vec4(pow(aces(uColor*.85),vec3(1./2.2)),alpha);outNormal=vec4(normalize(mat3(uView)*n)*.5+.5,1);return;}
if(uKind>3.5&&uKind<4.5){float ripple=noise(vec3(vLocal.x*9.,vLocal.y*6.-uTime*2.,vLocal.z*9.));float edge=pow(1.-abs(dot(n,view)),1.4);alpha*=.45+.5*edge;vec3 c=uColor*(.75+ripple*.4+uEmission);outColor=vec4(pow(aces(c),vec3(1./2.2)),alpha);outNormal=vec4(normalize(mat3(uView)*n)*.5+.5,1);return;}
if(uKind>.5&&uKind<1.5){float coord=vLocal.y*410.;float footprint=fwidth(coord);float lines=sin(coord)*exp(-footprint*.6);float crown=sin(length(vLocal.xz)*850.)*exp(-fwidth(length(vLocal.xz)*850.)*.45);rough=clamp(rough+lines*.023+crown*.011,.09,.85);base*=.96+.025*lines;}
if(uKind>1.5&&uKind<2.5){float grain=noise(vLocal*95.);rough=clamp(rough+grain*.13,.12,.95);base*=.84+grain*.22;n=normalize(n+vec3(dFdx(grain),dFdy(grain),0.)*.015);}
if(uKind>2.5&&uKind<3.5){float lines=sin(vLocal.x*370.)*exp(-fwidth(vLocal.x*370.)*.7);rough+=lines*.035;}
float sh=shadow(n);vec3 color=lightBRDF(n,view,normalize(vec3(-3.,6.,5.)),vec3(2.8,2.8,2.65)*sh,base,rough,metal);
color+=lightBRDF(n,view,normalize(vec3(4.,3.,-4.)),vec3(1.55,1.9,2.3),base,rough,metal);
color+=lightBRDF(n,view,normalize(vec3(-3.,1.,-2.)),vec3(.55,.66,.75),base,rough,metal);
for(int i=0;i<4;i++){vec3 delta=uIgnitionLights[i].xyz-vWorld;float d=length(delta);float irradiance=uIgnitionLights[i].w*.003*(1.-smoothstep(.02,.16,d))/max(d*d,.0003);color+=lightBRDF(n,view,delta/max(d,.0001),vec3(1.,.065,.008)*irradiance,base,rough,metal);}
for(int i=0;i<4;i++){vec4 light=uCombustionLights[i];float radial=length(vec2(vWorld.x-light.x,vWorld.z));float inside=(1.-smoothstep(uCombustionBounds.x,uCombustionBounds.x+.06,radial))*step(light.z-.025,vWorld.y)*step(vWorld.y,uCombustionBounds.y-abs(vWorld.z)*uChamberSlope+.035);vec3 delta=vec3(light.xy,0)-vWorld;float d=length(delta);float irradiance=light.w*inside*.9/max(d*d,.05);color+=lightBRDF(n,view,delta/max(d,.0001),vec3(1.,.20,.025)*irradiance,base,rough,metal);}
vec3 r=reflect(-view,n);vec3 f0=mix(vec3(.04),base,metal);vec3 fr=fresnel(max(dot(n,view),0.),f0);
color+=environment(r,rough)*fr*(.80-.2*rough)*uAO;
color+=environment(n,.93)*base*(1.-metal)*.36*uAO;
color+=base*.026*uAO;color*=.82+.18*sh;color+=base*uEmission;
if(uKind>4.5&&uKind<5.5){float distanceFromCenter=length(vWorld.xz/vec2(4.2,2.3));alpha*=1.-smoothstep(.55,1.,distanceFromCenter);color*=.65;}
outColor=vec4(pow(aces(color*1.03),vec3(1./2.2)),alpha);outNormal=vec4(normalize(mat3(uView)*n)*.5+.5,1.);}`;
    const DEPTHVERT = `#version 300 es
precision highp float;layout(location=0) in vec3 aPosition;layout(location=2) in vec2 aUV;layout(location=3) in mat4 aModel;uniform mat4 uLightVP;
${SPRING_SHAPE}
void main(){vec3 p=aPosition,n=vec3(0,1,0);springShape(p,n,aUV);gl_Position=uLightVP*aModel*vec4(p,1.);}`;
    const DEPTHFRAG = `#version 300 es
precision highp float;void main(){}`;
    const POSTVERT = `#version 300 es
precision highp float;out vec2 vUV;void main(){vUV=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(vUV*2.-1.,0.,1.);}`;
    const POSTFRAG = `#version 300 es
precision highp float;in vec2 vUV;out vec4 outColor;uniform sampler2D uScene;uniform sampler2D uDepth;uniform sampler2D uNormals;uniform vec2 uResolution;uniform mat4 uInverseP;uniform int uQuality;
vec3 reconstruct(vec2 uv,float d){vec4 p=uInverseP*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){vec4 c=texture(uScene,vUV);float d=texture(uDepth,vUV).r;if(c.a<.002){outColor=vec4(0.);return;}vec2 texel=1./uResolution;
float ao=0.;if(uQuality>0&&d<.99999){vec3 p=reconstruct(vUV,d),n=normalize(texture(uNormals,vUV).rgb*2.-1.);float angle=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)*6.2831853;float radius=clamp(28./max(1.,-p.z/8.),6.,32.);for(int i=0;i<12;i++){float a=angle+float(i)*2.39996323;float rr=radius*sqrt((float(i)+.5)/12.);vec2 suv=vUV+vec2(cos(a),sin(a))*rr*texel;float sd=texture(uDepth,suv).r;if(sd<.99999){vec3 delta=reconstruct(suv,sd)-p;float len=length(delta);float occ=max(0.,dot(n,delta/max(len,.001))-.09)*(1.-smoothstep(.04,.72,len));ao+=occ;}}ao=ao/12.;}
c.rgb*=1.-clamp(ao*1.2,0.,.34);
// Edge-aware final antialiasing keeps small machining details crisp.
vec4 ncol=texture(uScene,vUV+vec2(0,texel.y)),scol=texture(uScene,vUV-vec2(0,texel.y)),ecol=texture(uScene,vUV+vec2(texel.x,0)),wcol=texture(uScene,vUV-vec2(texel.x,0));float lum=luma(c.rgb),lo=min(lum,min(min(luma(ncol.rgb),luma(scol.rgb)),min(luma(ecol.rgb),luma(wcol.rgb)))),hi=max(lum,max(max(luma(ncol.rgb),luma(scol.rgb)),max(luma(ecol.rgb),luma(wcol.rgb))));float edge=clamp((hi-lo-.12)*.65,0.,.18);vec4 avg=(ncol+scol+ecol+wcol)*.25;if(c.a>.95&&avg.a>.95)c.rgb=mix(c.rgb,avg.rgb,edge);
float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9,78.2)))*43758.54)-.5;c.rgb+=grain/650.;outColor=c;}`;
    function shader(gl, type, source) { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const msg = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error('Shader compile failed: ' + msg);
    } return s; }
    function program(gl, vs, fs) { const p = gl.createProgram(), v = shader(gl, gl.VERTEX_SHADER, vs), f = shader(gl, gl.FRAGMENT_SHADER, fs); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f); if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error('Shader link failed: ' + gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name] = gl.getUniformLocation(p, info.name);
    } return { p, u }; }
    let matId = 0;
    F.material = function (color, metal = .9, rough = .27, kind = 0, extra = {}) { if (typeof color === 'string') {
        const h = color.replace('#', '');
        color = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    } return { id: ++matId, color, metal, rough, kind, alpha: 1, ao: 1, emission: 0, ...extra }; };
    class Renderer {
        constructor(canvas) { this.canvas = canvas; this.gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }); if (!this.gl)
            throw new Error('WebGL 2が利用できません。ハードウェアアクセラレーションを有効にしたブラウザーで開いてください。'); const gl = this.gl; this.main = program(gl, VERT, FRAG); this.depth = program(gl, DEPTHVERT, DEPTHFRAG); this.post = program(gl, POSTVERT, POSTFRAG); this.geometry = new Map(); this.batches = new Map(); this.postVAO = gl.createVertexArray(); this.quality = 1; this.shadowSize = 1536; this.stats = { drawCalls: 0, parts: 0, triangles: 0 }; this.white = this.makeTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); this.createShadow(); this.width = 0; this.height = 0; this.lightVP = M.mul(M.ortho(-6.3, 6.3, -6.3, 6.3, .1, 28), M.lookAt([-6, 11, 7], [0, 2, 0])); gl.disable(gl.CULL_FACE); }
        makeTexture(source, w, h) { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); if (source instanceof Uint8Array)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
        else
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
        createShadow() { const gl = this.gl; if (this.shadowTex) {
            gl.deleteTexture(this.shadowTex);
            gl.deleteFramebuffer(this.shadowFBO);
        } this.shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null); for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
            gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST); for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
            gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); this.shadowFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error('Shadow framebuffer unavailable.'); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
        setQuality(q) { this.quality = q; this.shadowSize = [768, 1536, 2048][q]; this.createShadow(); this.width = 0; }
        resize(w, h) { const maxPixelRatio = [1, 1.5, 2][this.quality], ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio); w = Math.max(2, Math.round(w * ratio)); h = Math.max(2, Math.round(h * ratio)); if (w === this.width && h === this.height)
            return; this.width = w; this.height = h; this.canvas.width = w; this.canvas.height = h; const gl = this.gl; if (this.fbo) {
            gl.deleteFramebuffer(this.fbo);
            for (const t of this.targets)
                gl.deleteTexture(t);
        } if (this.msFBO) {
            gl.deleteFramebuffer(this.msFBO);
            for (const rb of this.msBuffers)
                gl.deleteRenderbuffer(rb);
            this.msFBO = null;
        } this.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); this.targets = []; for (let i = 0; i < 3; i++) {
            const t = gl.createTexture();
            this.targets.push(t);
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, i === 2 ? gl.DEPTH_COMPONENT24 : gl.RGBA8, w, h, 0, i === 2 ? gl.DEPTH_COMPONENT : gl.RGBA, i === 2 ? gl.UNSIGNED_INT : gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, i === 2 ? gl.NEAREST : gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, i === 2 ? gl.NEAREST : gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, i === 2 ? gl.DEPTH_ATTACHMENT : gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
        } gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error('Scene framebuffer unavailable.'); const samples = this.quality === 0 ? 1 : Math.min(4, gl.getParameter(gl.MAX_SAMPLES)); if (samples > 1) {
            this.msFBO = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFBO);
            this.msBuffers = [];
            for (let i = 0; i < 3; i++) {
                const rb = gl.createRenderbuffer();
                this.msBuffers.push(rb);
                gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, i === 2 ? gl.DEPTH_COMPONENT24 : gl.RGBA8, w, h);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, i === 2 ? gl.DEPTH_ATTACHMENT : gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER, rb);
            }
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
                throw new Error('MSAA framebuffer unavailable.');
        }
        if (this.opaqueDepth) { gl.deleteTexture(this.opaqueDepth); gl.deleteFramebuffer(this.opaqueFBO); }
        this.opaqueDepth = gl.createTexture(); this.opaqueFBO = gl.createFramebuffer();
        gl.bindTexture(gl.TEXTURE_2D, this.opaqueDepth);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
        for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.opaqueFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.opaqueDepth, 0);
        gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Chamber depth framebuffer unavailable.');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
        upload(g) { if (this.geometry.has(g.id))
            return this.geometry.get(g.id); const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao); const buffers = []; [g.positions, g.normals, g.uvs].forEach((arr, i) => { const b = gl.createBuffer(); buffers.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, i === 2 ? 2 : 3, gl.FLOAT, false, 0, 0); }); const indices = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.indices, gl.STATIC_DRAW); const instances = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, instances); for (let i = 0; i < 4; i++) {
            gl.enableVertexAttribArray(3 + i);
            gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, 64, i * 16);
            gl.vertexAttribDivisor(3 + i, 1);
        } gl.bindVertexArray(null); const gpu = { vao, instances, count: g.indices.length, buffers, indices }; this.geometry.set(g.id, gpu); return gpu; }
        collect(root) { for (const b of this.batches.values())
            b.nodes.length = 0; let parts = 0, triangles = 0; const visit = n => { if (!n.visible)
            return; if (n.geometry && n.material && n.material.alpha > .008) {
            const key = n.geometry.id + ':' + n.material.id;
            let batch = this.batches.get(key);
            if (!batch) {
                batch = { g: n.geometry, m: n.material, nodes: [], cast: n.castShadow };
                this.batches.set(key, batch);
            }
            batch.nodes.push(n);
            parts++;
            triangles += n.geometry.indices.length / 3;
        } for (const c of n.children)
            visit(c); }; visit(root); this.active = [...this.batches.values()].filter(b => b.nodes.length); this.stats.parts = parts; this.stats.triangles = triangles; }
        drawBatch(b, uniforms = this.main.u) { const gl = this.gl, g = this.upload(b.g); gl.uniform4fv(uniforms.uSpring, b.m.spring || [0,0,0,0]); const required = b.nodes.length * 16; if (!b.data || b.data.length < required)
            b.data = new Float32Array(required); b.nodes.forEach((n, i) => b.data.set(n.world, i * 16)); gl.bindVertexArray(g.vao); gl.bindBuffer(gl.ARRAY_BUFFER, g.instances); gl.bufferData(gl.ARRAY_BUFFER, b.data.subarray(0, required), gl.DYNAMIC_DRAW); gl.drawElementsInstanced(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0, b.nodes.length); this.stats.drawCalls++; }
        render(root, camera, time = 0) {
            const gl = this.gl;
            if (gl.isContextLost() || this.width < 2)
                return;
            this.stats.drawCalls = 0;
            root.update();
            this.collect(root);
            const view = M.lookAt(camera.eye, camera.target), projection = M.perspective(camera.fov, this.width / this.height, .08, 90), vp = M.mul(projection, view);
            this.vp = vp;
            this.camera = camera;
            this.view = view;
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.depthMask(true);
            gl.disable(gl.BLEND);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
            gl.viewport(0, 0, this.shadowSize, this.shadowSize);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.useProgram(this.depth.p);
            gl.uniformMatrix4fv(this.depth.u.uLightVP, false, this.lightVP);
            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1.2, 2.0);
            for (const b of this.active)
                if (b.m.alpha > .95 && b.cast && b.m.kind !== 4)
                    this.drawBatch(b, this.depth.u);
            gl.disable(gl.POLYGON_OFFSET_FILL);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFBO || this.fbo);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.useProgram(this.main.p);
            const u = this.main.u;
            gl.uniformMatrix4fv(u.uVP, false, vp);
            gl.uniformMatrix4fv(u.uView, false, view);
            gl.uniformMatrix4fv(u.uLightVP, false, this.lightVP);
            gl.uniform3fv(u.uCamera, camera.eye);
            gl.uniform1f(u.uShadowTexel, 1 / this.shadowSize);
            gl.uniform1i(u.uQuality, this.quality);
            gl.uniform1f(u.uTime, time);
            gl.uniform1f(u.uChamberSlope, Math.tan(F.K.HEAD.tilt));
            gl.uniform4fv(u['uIgnitionLights[0]'], root.ignitionLights || new Float32Array(16));
            gl.uniform4fv(u['uCombustionLights[0]'], root.combustionLights || new Float32Array(16));
            gl.uniform2f(u.uCombustionBounds, F.K.HEAD.bore, F.K.ROOF_Y);
            gl.uniformMatrix4fv(u.uInverseVP, false, M.invert(vp));
            gl.uniform2f(u.uViewport, this.width, this.height);
            gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.opaqueDepth); gl.uniform1i(u.uOpaqueDepth, 2);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
            gl.uniform1i(u.uShadow, 0);
            gl.uniform1i(u.uMap, 1);
            const draw = b => { const m = b.m; gl.uniform3fv(u.uColor, m.color); gl.uniform1f(u.uMetal, m.metal); gl.uniform1f(u.uRough, m.rough); gl.uniform1f(u.uKind, m.kind); gl.uniform1f(u.uAlpha, m.alpha); gl.uniform1f(u.uAO, m.ao); gl.uniform1f(u.uEmission, m.emission); gl.uniform4fv(u.uChamber, m.chamber || [0,0,0,0]); gl.uniform3fv(u.uFlow, m.flow || [0,0,0]); gl.uniform4fv(u.uBurn, m.burn || [0,0,0,0]); gl.uniform4fv(u.uBurnShape, m.burnShape || [1,0,0,1]); gl.uniform4fv(u.uSprayOrigin, m.sprayOrigin || [0,0,0,0]); gl.uniform3fv(u.uSprayAxis, m.sprayAxis || [0,1,0]); gl.uniform1f(u.uUseMap, m.texture ? 1 : 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, m.texture || this.white); this.drawBatch(b); };
            for (const b of this.active)
                if (b.m.alpha >= .995)
                    draw(b);
            // A separate depth snapshot avoids sampling an attached render target,
            // and terminates the flame behind piston, valve and cylinder surfaces.
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msFBO || this.fbo);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.opaqueFBO);
            gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFBO || this.fbo);
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            const transparent = this.active.filter(b => b.m.alpha < .995).sort((a, b) => { const p = n => n.nodes[0].world; return V.len(V.sub([p(b)[12], p(b)[13], p(b)[14]], camera.eye)) - V.len(V.sub([p(a)[12], p(a)[13], p(a)[14]], camera.eye)); });
            for (const b of transparent) {
                gl.blendFuncSeparate(gl.SRC_ALPHA, b.m.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                draw(b);
            }
            gl.depthMask(true);
            gl.disable(gl.BLEND);
            if (this.msFBO) {
                gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msFBO);
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo);
                gl.readBuffer(gl.COLOR_ATTACHMENT0);
                gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
                gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
                gl.readBuffer(gl.COLOR_ATTACHMENT1);
                gl.drawBuffers([gl.NONE, gl.COLOR_ATTACHMENT1]);
                gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
                gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.width, this.height);
            gl.disable(gl.DEPTH_TEST);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(this.post.p);
            const pu = this.post.u;
            for (let i = 0; i < 3; i++) {
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, this.targets[i]);
            }
            gl.uniform1i(pu.uScene, 0);
            gl.uniform1i(pu.uNormals, 1);
            gl.uniform1i(pu.uDepth, 2);
            gl.uniform2f(pu.uResolution, this.width, this.height);
            gl.uniformMatrix4fv(pu.uInverseP, false, M.invert(projection));
            gl.uniform1i(pu.uQuality, this.quality);
            gl.bindVertexArray(this.postVAO);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.bindVertexArray(null);
        }
        project(p) { if (!this.vp)
            return null; const v = M.transform(this.vp, p); if (v[3] <= 0)
            return null; return [(v[0] / v[3] * .5 + .5) * this.canvas.clientWidth, (-v[1] / v[3] * .5 + .5) * this.canvas.clientHeight, v[2] / v[3]]; }
        dispose() { const gl = this.gl; for (const g of this.geometry.values()) {
            gl.deleteVertexArray(g.vao);
            gl.deleteBuffer(g.instances);
            gl.deleteBuffer(g.indices);
            for (const b of g.buffers)
                gl.deleteBuffer(b);
        } for (const t of this.targets || [])
            gl.deleteTexture(t); gl.deleteTexture(this.shadowTex); gl.deleteTexture(this.white); gl.deleteFramebuffer(this.fbo); gl.deleteFramebuffer(this.shadowFBO); if (this.msFBO) {
            gl.deleteFramebuffer(this.msFBO);
            for (const rb of this.msBuffers)
                gl.deleteRenderbuffer(rb);
        } gl.deleteTexture(this.opaqueDepth); gl.deleteFramebuffer(this.opaqueFBO);
        for (const p of [this.main, this.depth, this.post])
            gl.deleteProgram(p.p); gl.deleteVertexArray(this.postVAO); }
    }
    F.Renderer = Renderer;
})(globalThis.FERRO);
