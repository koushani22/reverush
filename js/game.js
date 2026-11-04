/* Reverush — game script. Requires three.js r128 (+ bloom post-processing) loaded first. */
(function(){
'use strict';
const V3=THREE.Vector3,$=id=>document.getElementById(id);
const coarse=matchMedia('(pointer:coarse)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mkRnd=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
let rnd=mkRnd(11);
const hex=n=>'#'+n.toString(16).padStart(6,'0');


/* ---------- Renderer ---------- */
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,coarse?1.25:2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=coarse?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(62,1,.1,7000);
scene.fog=new THREE.Fog(0xffffff,150,1400);
const hemi=new THREE.HemisphereLight(0xffffff,0x444444,.9);scene.add(hemi);
const sunL=new THREE.DirectionalLight(0xffffff,1);sunL.castShadow=true;sunL.shadow.mapSize.set(coarse?512:1024,coarse?512:1024);
{const c=sunL.shadow.camera;c.left=-12;c.right=12;c.top=12;c.bottom=-12;c.near=1;c.far=160;}sunL.shadow.bias=-0.0006;sunL.shadow.normalBias=.02;
scene.add(sunL);scene.add(sunL.target);
let composer=null,bloom=null;
try{if(!coarse&&THREE.EffectComposer&&THREE.UnrealBloomPass&&THREE.RenderPass){composer=new THREE.EffectComposer(renderer);composer.addPass(new THREE.RenderPass(scene,camera));bloom=new THREE.UnrealBloomPass(new THREE.Vector2(512,512),.5,.5,.86);composer.addPass(bloom);}}catch(e){composer=null;}

/* ---------- Worlds ---------- */
const ZONES=[
 {name:'Ember Dunes',sub:'Desert at dusk',top:0x24285e,hor:0xff9152,fog:0xf09a68,near:170,far:1500,sun:0xffc283,sunI:1.05,sunEl:.07,sunAz:-.35,hs:0xffd2a8,hg:0x8a4632,hi:.85,rail:0xffad55,spark:0xffcf8a,up:.5,stars:.12,aurora:0,clouds:.55,cloudC:0xffb08a,bloom:.5,g1:0xdc9a5e,g2:0xbd7442},
 {name:'Glass Lagoon',sub:'Turquoise coast',top:0x2a78d2,hor:0xffe4c4,fog:0xd2ebf3,near:220,far:1900,sun:0xfff1d2,sunI:1.2,sunEl:.3,sunAz:.5,hs:0xd2f0ff,hg:0xe9cfa0,hi:1.0,rail:0x55eeff,spark:0xffffff,up:.25,stars:0,aurora:0,clouds:1,cloudC:0xffffff,bloom:.3,g1:0xf5ddae,g2:0xe8c58e},
 {name:'Lantern Wood',sub:'Enchanted night',top:0x04061a,hor:0x2b2163,fog:0x151135,near:80,far:950,sun:0xa9bcff,sunI:.6,sunEl:.24,sunAz:2.3,hs:0x4b5cb4,hg:0x0c2416,hi:.75,rail:0x76ffb0,spark:0xb8ff78,up:.12,stars:1,aurora:1,clouds:.1,cloudC:0x5a4ab0,bloom:1.0,g1:0x1c4a2c,g2:0x10301c},
 {name:'Prism Peaks',sub:'Crystal snowfield',top:0x5446b8,hor:0xf5a6cc,fog:0xd9b4da,near:170,far:1500,sun:0xffd6ec,sunI:.9,sunEl:.14,sunAz:-1.7,hs:0xffe8ff,hg:0xb7b0e6,hi:.95,rail:0xff86d4,spark:0xffffff,up:-1,stars:.35,aurora:.3,clouds:.8,cloudC:0xffd2ea,bloom:.35,g1:0xeceafc,g2:0xcfc8f0}
];
const ZC=ZONES.map(z=>{const o={};for(const k of ['top','hor','fog','sun','hs','hg','rail','spark','cloudC'])o[k]=new THREE.Color(z[k]);o.sunDir=new V3(Math.cos(z.sunEl)*Math.sin(z.sunAz),Math.sin(z.sunEl),Math.cos(z.sunEl)*Math.cos(z.sunAz));return o;});

/* ---------- Powers & hazards ---------- */
const PW=[{key:'wings',name:'Wings',css:'--wings',col:0xfff3b8,hz:'Rift'},{key:'lava',name:'Lava tyres',css:'--lava',col:0xff7a2e,hz:'Lava flow'},{key:'boat',name:'Boat',css:'--boat',col:0x4fe3ff,hz:'Flood'},{key:'ice',name:'Ice studs',css:'--ice',col:0xb9d8ff,hz:'Ice sheet'}];
const HZ={rift:0,lava:1,flood:2,ice:3},HZLEN=[36,42,70,95];

/* ---------- Materials ---------- */
const phong=(c,o)=>new THREE.MeshPhongMaterial(Object.assign({color:c,flatShading:true,shininess:0,side:THREE.DoubleSide},o||{}));
const basic=(c,o)=>new THREE.MeshBasicMaterial(Object.assign({color:c,side:THREE.DoubleSide},o||{}));
const std=(c,mt,rg,o)=>{const k=.12+mt*.45;const m=new THREE.MeshPhongMaterial(Object.assign({color:c,shininess:Math.round(8+(1-rg)*140),specular:new THREE.Color(k,k,k)},o||{}));m.userData.refl=clamp((1-rg)*.32,.02,.28);m.userData.car=1;return m;};
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
const lavaTex=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#ff5a14';x.fillRect(0,0,w,h);const r=mkRnd(5);for(let i=0;i<60;i++){const px=r()*w,py=r()*h,rad=6+r()*22;const g=x.createRadialGradient(px,py,0,px,py,rad);const hot=r()<.5;g.addColorStop(0,hot?'rgba(255,236,120,.95)':'rgba(70,14,10,.9)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;for(const ox of [-w,0,w])for(const oy of [-h,0,h]){x.save();x.translate(ox,oy);x.fillRect(px-rad,py-rad,rad*2,rad*2);x.restore();}}});
const mats={road:phong(0x2a2731,{shininess:8,specular:0x222222}),line:basic(0xf6ecd6),curbA:phong(0xf6ecd6),curbB:phong(0xc8352b),rail:basic(0xffad55),side:phong(0x4a3b46),trim:phong(0x1b1418),
  abyss:basic(0x040208),boost:basic(0xffffff,{transparent:true,opacity:.9}),
  lava:basic(0xffffff,{map:lavaTex}),ice:new THREE.MeshPhongMaterial({color:0xcfe9ff,emissive:0x1a3550,shininess:140,specular:0xffffff,transparent:true,opacity:.92}),frost:basic(0xf4fbff),
  basalt:phong(0x2a1a18),
  paint:std(0xffffff,.4,.24,{vertexColors:true,side:THREE.DoubleSide}),body:std(0xf4f1ec,.4,.24,{side:THREE.DoubleSide}),livery:std(0xff5a36,.4,.24,{side:THREE.DoubleSide}),
  carbon:std(0x18161c,.3,.45,{side:THREE.DoubleSide}),pin:std(0x2fd2c9,.3,.3),glass:std(0x0b0e16,.7,.06,{side:THREE.DoubleSide}),helmet:std(0x1d1b26,.5,.22),
  tyre:std(0x1a181c,0,.82),rim:std(0x2c2c33,.85,.28),compound:basic(0xe8322a),tail:basic(0xff3030),
  wingM:new THREE.MeshPhongMaterial({color:0xfffaf2,emissive:0x5a4a30,side:THREE.DoubleSide,transparent:true,opacity:.95,shininess:80}),
  lavaTyre:basic(0xff8a3a),iceRim:basic(0xbfe6ff),float:std(0xfff6ea,.2,.3)};
const waterU={uTime:{value:0}};
function waterMaterial(col,op){const m=new THREE.MeshPhongMaterial({color:col,transparent:true,opacity:op,shininess:110,specular:0xbff6ff,flatShading:true,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=waterU.uTime;sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 wpW=modelMatrix*vec4(transformed,1.);float wv=(sin(wpW.x*.06+uTime*1.3)+sin(wpW.z*.08+uTime*1.7)+sin((wpW.x+wpW.z)*.03+uTime*.8))*.28;transformed.z+=wv;transformed.y+=wv*0.;');};return m;}
const seaMat=waterMaterial(0x1ab3c6,.82);
const floodMat=new THREE.MeshPhongMaterial({color:0x2ab7d0,transparent:true,opacity:.72,shininess:120,specular:0xdffaff,side:THREE.DoubleSide});

/* ---------- Sky, stars, aurora, clouds, sparkles ---------- */
const skyU={top:{value:new THREE.Color()},hor:{value:new THREE.Color()},sunC:{value:new THREE.Color()},sunD:{value:new V3(0,.2,1)}};
const skyMat=new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:'uniform vec3 top,hor,sunC,sunD;varying vec3 vW;void main(){vec3 d=normalize(vW-cameraPosition);float h=d.y;vec3 c=mix(hor,top,pow(clamp(h,0.,1.),.5));c=mix(c,hor*.8,clamp(-h*3.,0.,1.));float s=max(dot(d,normalize(sunD)),0.);c+=sunC*(smoothstep(.9985,.9992,s)*2.2+pow(s,40.)*.45+pow(s,6.)*.18);gl_FragColor=vec4(c,1.);}'});
const sky=new THREE.Mesh(new THREE.SphereGeometry(5000,48,24),skyMat);sky.renderOrder=-10;sky.frustumCulled=false;scene.add(sky);
const skyGroup=new THREE.Group();scene.add(skyGroup);
const starMat=new THREE.PointsMaterial({color:0xffffff,size:2.2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false});
{const n=1600,a=new Float32Array(n*3);for(let i=0;i<n;i++){const u=rnd()*Math.PI*2,v=Math.acos(rnd()*.95);a[i*3]=Math.sin(v)*Math.cos(u)*4400;a[i*3+1]=Math.cos(v)*4400;a[i*3+2]=Math.sin(v)*Math.sin(u)*4400;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a,3));const s=new THREE.Points(g,starMat);s.frustumCulled=false;skyGroup.add(s);}
const auroraU={uT:{value:0},uA:{value:0}};
const auroraMat=new THREE.ShaderMaterial({uniforms:auroraU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,
  vertexShader:'uniform float uT;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.004+uT*.4)*80.+sin(p.x*.011-uT*.7)*30.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
  fragmentShader:'uniform float uT,uA;varying vec2 vUv;void main(){float band=.5+.5*sin(vUv.x*38.+uT*1.3+sin(vUv.x*9.-uT)*2.);float fade=smoothstep(0.,.25,vUv.y)*smoothstep(1.,.4,vUv.y)*smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);vec3 c=mix(vec3(.2,1.,.6),vec3(.75,.35,1.),vUv.y);gl_FragColor=vec4(c*band*fade*uA*.9,1.);}'});
for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(3400,520,120,1),auroraMat);m.position.set(-600+k*500,780+k*120,-2600+k*300);m.rotation.y=-.3+k*.25;m.rotation.x=.25;skyGroup.add(m);}
function softTex(blobs){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');for(const [bx,by,r,a] of blobs){const g=x.createRadialGradient(bx,by,0,bx,by,r);g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}return new THREE.CanvasTexture(c);}
const cloudMat=new THREE.SpriteMaterial({map:softTex([[64,70,40,.9],[40,74,30,.8],[88,72,32,.8],[60,56,30,.7]]),transparent:true,depthWrite:false,fog:false,opacity:.5});
const clouds=new THREE.Group();scene.add(clouds);
for(let k=0;k<50;k++){const a=rnd()*Math.PI*2,r=800+rnd()*1500;const sp=new THREE.Sprite(cloudMat);sp.position.set(Math.cos(a)*r,180+rnd()*280,Math.sin(a)*r);const s=280+rnd()*400;sp.scale.set(s,s*.45,1);clouds.add(sp);}
const dotTex=softTex([[64,64,64,1]]);
const SPN=coarse?140:520,spPos=new Float32Array(SPN*3),spPh=new Float32Array(SPN);
for(let i=0;i<SPN;i++){spPos[i*3]=(rnd()-.5)*90;spPos[i*3+1]=rnd()*26;spPos[i*3+2]=(rnd()-.5)*90;spPh[i]=rnd()*6.28;}
const spGeo=new THREE.BufferGeometry();spGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(SPN*3),3));
const spMat=new THREE.PointsMaterial({size:.32,map:dotTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.9});
const sparkles=new THREE.Points(spGeo,spMat);sparkles.frustumCulled=false;scene.add(sparkles);
const sea=new THREE.Mesh(new THREE.PlaneGeometry(5200,5200,140,140),seaMat);sea.rotation.x=-Math.PI/2;scene.add(sea);

/* ---------- Cars ---------- */

// Smooth lofted surfaces: each section is [z, width, height, centreY, squareness, xOffset]
const crv=(a,i,j,t)=>{const n=a.length,p0=a[Math.max(i-1,0)][j],p1=a[i][j],p2=a[i+1][j],p3=a[Math.min(i+2,n-1)][j];const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);};
function loft(secs,R,catOf,steps){
  steps=steps||6;const S=[];
  for(let i=0;i<secs.length-1;i++)for(let k=0;k<steps;k++){const t=k/steps;S.push(secs[0].map((_,j)=>crv(secs,i,j,t)));}
  S.push(secs[secs.length-1].slice());
  const pos=[],cats=[],idx=[];
  for(const [z,w,h,yc,n,xo] of S)for(let r=0;r<R;r++){const a=r/R*Math.PI*2,c=Math.cos(a),s=Math.sin(a);const x=xo+w/2*Math.sign(c)*Math.pow(Math.abs(c),2/n),y=yc+h/2*Math.sign(s)*Math.pow(Math.abs(s),2/n);pos.push(x,y,z);cats.push(catOf?catOf(x,y,z,xo):0);}
  for(let i=0;i<S.length-1;i++)for(let r=0;r<R;r++){const a=i*R+r,b=i*R+(r+1)%R,c=(i+1)*R+r,d=(i+1)*R+(r+1)%R;idx.push(a,b,c,b,d,c);}
  for(const [i,flip] of [[0,1],[S.length-1,0]]){const ci=pos.length/3,[z,,,yc,,xo]=S[i];pos.push(xo,yc,z);cats.push(catOf?catOf(xo,yc,z,xo):0);for(let r=0;r<R;r++){const a=i*R+r,b=i*R+(r+1)%R;flip?idx.push(ci,b,a):idx.push(ci,a,b);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(new Array(pos.length).fill(1),3));g.setIndex(idx);g.computeVertexNormals();g.userData.cats=cats;return g;
}
const paintGeos=[];
function repaint(pal){const cols=pal.map(h=>new THREE.Color(h));for(const g of paintGeos){const a=g.attributes.color,c=g.userData.cats;for(let i=0;i<c.length;i++){const k=cols[c[i]];a.setXYZ(i,k.r,k.g,k.b);}a.needsUpdate=true;}}
// NACA-style airfoil, extruded across the car; leading edge at z=0, chord runs toward -z
function wing(chord,thick,span,camber){const sh=new THREE.Shape(),N=16,up=[],lo=[];for(let i=0;i<=N;i++){const x=Math.pow(i/N,1.6);const yt=5*thick*(.2969*Math.sqrt(x)-.126*x-.3516*x*x+.2843*x*x*x-.1036*x*x*x*x);const yc=camber*4*x*(1-x);up.push([x*chord,(yc+yt)*chord]);lo.push([x*chord,(yc-yt)*chord]);}
  sh.moveTo(up[0][0],up[0][1]);for(let i=1;i<=N;i++)sh.lineTo(up[i][0],up[i][1]);for(let i=N;i>=0;i--)sh.lineTo(lo[i][0],lo[i][1]);
  const g=new THREE.ExtrudeGeometry(sh,{depth:span,bevelEnabled:false,curveSegments:4});g.translate(0,0,-span/2);g.rotateY(Math.PI/2);g.computeVertexNormals();return g;}
// flat plate from a side-profile outline [[back, up],...], thickness t
function plate(outline,t){const sh=new THREE.Shape();outline.forEach(([u,v],i)=>i?sh.lineTo(u,v):sh.moveTo(u,v));const g=new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false});g.translate(0,0,-t/2);g.rotateY(Math.PI/2);return g;}

function buildCar(m,isGhost){
  const root=new THREE.Group(),model=new THREE.Group(),ch=new THREE.Group();model.scale.setScalar(.86);root.add(model);model.add(ch);
  const M_=k=>m[k]||m.body;
  const put=(g,mat,x,y,z,rx,ry,rz,parent)=>{const e=new THREE.Mesh(g,mat);e.position.set(x||0,y||0,z||0);e.rotation.set(rx||0,ry||0,rz||0);(parent||ch).add(e);return e;};
  const paint=(g)=>{if(!isGhost)paintGeos.push(g);return put(g,M_('paint'));};
  const rod=(a,b,r,mat)=>{const A=new V3(...a),B=new V3(...b),d=B.clone().sub(A);const e=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),6),mat);e.position.copy(A).addScaledVector(d,.5);e.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());ch.add(e);return e;};
  const carbon=M_('carbon'),body=M_('body'),acc=M_('livery'),pin=M_('pin');
  // livery map: 0 base, 1 accent, 2 exposed carbon, 3 pinstripe
  const liv=(x,y,z)=>{ if(y<.3)return 2; if(z>2.75)return 1; return 0; };

  // monocoque, nose and gearbox in one surface
  paint(loft([[3.4,.11,.09,.23,2.2,0],[3.0,.25,.17,.27,2.6,0],[2.4,.40,.27,.33,3,0],[1.7,.56,.37,.40,3.2,0],[1.0,.72,.48,.47,3.4,0],
    [.3,.82,.54,.48,3.6,0],[-.3,.86,.58,.47,3.6,0],[-.8,.80,.62,.50,3.4,0],[-1.3,.60,.52,.48,3,0],[-1.8,.40,.38,.43,2.6,0],[-2.28,.22,.22,.38,2.4,0]],28,liv,7));
  // airbox / engine cover spine
  paint(loft([[-.12,.30,.24,.90,2.4,0],[-.45,.33,.32,.92,2.6,0],[-.95,.24,.28,.84,2.6,0],[-1.45,.10,.18,.74,2.4,0],[-1.95,.03,.08,.60,2.2,0]],20,()=>1,6));
  put(new THREE.CircleGeometry(1,20).scale(.11,.1,1),carbon,0,.92,-.115);
  // sidepods with inlets and the classic undercut
  for(const s of [1,-1]){
    paint(loft([[.78,.40,.28,.44,3.2,s*.62],[.5,.52,.40,.45,3.4,s*.66],[0,.54,.42,.44,3.4,s*.68],[-.6,.46,.34,.40,3,s*.62],[-1.2,.30,.22,.34,2.6,s*.5],[-1.65,.12,.10,.30,2.2,s*.38]],22,liv,6));
    put(new THREE.CircleGeometry(1,20).scale(.17,.11,1),carbon,s*.63,.45,.785);
    put(new THREE.BoxGeometry(.03,.012,1.5),pin,s*.62,.665,-.2,-.07);
  }
  // floor with edge wing, plank, diffuser
  {const sh=new THREE.Shape(),o=[[.3,1.45],[.7,.95],[.84,.6],[.88,-1.3],[.66,-1.95],[.55,-2.3]];sh.moveTo(-o[o.length-1][0],o[o.length-1][1]);
   [...o].reverse().forEach(([x,z])=>sh.lineTo(-x,z));o.forEach(([x,z])=>sh.lineTo(x,z));
   const g=new THREE.ExtrudeGeometry(sh,{depth:.035,bevelEnabled:false});g.rotateX(Math.PI/2);put(g,carbon,0,.15,0);
   put(new THREE.BoxGeometry(1.1,.2,.42),carbon,0,.2,-2.3,-.32);
   for(const x of [-.4,0,.4])put(new THREE.BoxGeometry(.015,.2,.4),carbon,x,.22,-2.3,-.32);}
  // shark fin
  put(plate([[0,0],[1.15,0],[1.25,.24],[.2,.06]],.018),acc,0,.78,-.95);
  // cockpit, driver, halo, mirrors
  put(new THREE.CircleGeometry(1,24).scale(.27,.52,1).rotateX(-Math.PI/2),carbon,0,.762,.02);
  put(new THREE.SphereGeometry(.155,18,14),M_('helmet'),0,.86,-.1);
  put(new THREE.SphereGeometry(.157,18,8,-Math.PI*.35,Math.PI*.7,Math.PI*.36,Math.PI*.16),M_('glass'),0,.86,-.1);
  {const hc=new THREE.CatmullRomCurve3([[-.34,.76,-.42],[-.37,.9,-.12],[-.28,.97,.16],[0,1.0,.3],[.28,.97,.16],[.37,.9,-.12],[.34,.76,-.42]].map(p=>new V3(...p)));
   put(new THREE.TubeGeometry(hc,40,.028,8,false),carbon);rod([0,.99,.3],[0,.74,.62],.026,carbon);}
  for(const s of [1,-1]){rod([s*.36,.73,.5],[s*.55,.82,.48],.012,carbon);put(new THREE.SphereGeometry(1,14,10).scale(.11,.05,.05),body,s*.6,.83,.48);}
  // front wing: three elements + endplates
  put(wing(.52,.08,2.12,-.05),carbon,0,.09,3.46,.04);
  put(wing(.30,.09,2.02,-.07),acc,0,.16,3.08,.36);
  put(wing(.22,.09,1.9,-.08),body,0,.25,2.9,.62);
  for(const s of [1,-1])put(plate([[0,0],[.62,0],[.62,.2],[.36,.26],[.06,.14]],.02),acc,s*1.07,.06,3.46);
  // rear wing: swan-neck pylons, beam wing, main plane, DRS flap, endplates, rain light
  put(wing(.38,.1,1.56,-.06),body,0,.98,-2.2,.16);
  put(wing(.26,.1,1.56,-.07),acc,0,1.1,-2.5,.6);
  put(wing(.22,.09,.92,-.05),carbon,0,.42,-2.25,.3);
  for(const s of [1,-1]){put(plate([[0,0],[.7,0],[.74,.62],[.42,.7],[0,.66]],.022),body,s*.79,.52,-2.08);rod([s*.07,.5,-2.2],[s*.07,.98,-2.42],.022,carbon);}
  put(new THREE.BoxGeometry(.12,.06,.02),M_('tail'),0,.5,-2.39);
  // suspension: wishbones + pushrods
  const sus=[[[.28,.58,2.35],[.3,.55,1.82],[.78,.5,2.12]],[[.22,.33,2.42],[.24,.32,1.78],[.8,.26,2.12]],
             [[.3,.55,-1.38],[.28,.55,-1.88],[.72,.55,-1.62]],[[.3,.3,-1.32],[.25,.3,-1.92],[.72,.25,-1.62]]];
  for(const s of [1,-1]){for(const [a,b,c] of sus){const f=p=>[p[0]*s,p[1],p[2]];rod(f(a),f(c),.014,carbon);rod(f(b),f(c),.014,carbon);}
    rod([s*.78,.28,2.12],[s*.3,.62,2.0],.013,carbon);rod([s*.72,.27,-1.62],[s*.3,.6,-1.5],.013,carbon);}
  // wheels: rounded-shoulder slicks on 18" covers with a compound band
  const wheels=[];
  for(const [x,z,R,w] of [[.92,2.12,.38,.33],[-.92,2.12,.38,.33],[.88,-1.62,.40,.44],[-.88,-1.62,.40,.44]]){
    const wg=new THREE.Group();wg.position.set(x,R,z);wg.rotation.order='YXZ';model.add(wg);
    const prof=[[R*.6,-w/2],[R-.05,-w/2],[R-.015,-w/2+.03],[R,-w/2+.08],[R,w/2-.08],[R-.015,w/2-.03],[R-.05,w/2],[R*.6,w/2]].map(([a,b])=>new THREE.Vector2(a,b));
    put(new THREE.LatheGeometry(prof,32).rotateZ(Math.PI/2),M_('tyre'),0,0,0,0,0,0,wg);
    put(new THREE.CylinderGeometry(R*.6,R*.6,w-.02,28).rotateZ(Math.PI/2),M_('rim'),0,0,0,0,0,0,wg);
    put(new THREE.TorusGeometry(R*.76,.016,4,32).rotateY(Math.PI/2),M_('compound'),Math.sign(x)*(w/2-.004),0,0,0,0,0,wg);
    put(new THREE.BoxGeometry(.02,.05,R*.9),M_('compound'),Math.sign(x)*(w/2-.004),R*.35,0,0,0,0,wg);
    wheels.push(wg);
  }
  let wings=null;
  if(m.wingM){wings=[];const sh=new THREE.Shape();
    [[0,.5],[.9,.62],[1.9,.42],[2.8,0],[2.45,-.22],[2.1,-.12],[1.75,-.45],[1.35,-.28],[1.0,-.6],[.6,-.38],[.3,-.68],[0,-.55]].forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));
    const wgG=new THREE.ExtrudeGeometry(sh,{depth:.035,bevelEnabled:false});wgG.rotateX(Math.PI/2);
    for(const s of [1,-1]){const piv=new THREE.Group();piv.position.set(s*.6,.66,-.25);ch.add(piv);const me=new THREE.Mesh(wgG,M_('wingM'));me.scale.x=s;piv.add(me);piv.scale.setScalar(.001);piv.userData.s=s;wings.push(piv);}}
  let floats=null;
  if(m.wingM){floats=new THREE.Group();ch.add(floats);floats.scale.setScalar(.001);
    for(const s of [1,-1]){const f=new THREE.Mesh(new THREE.SphereGeometry(1,18,10).scale(.32,.24,2.3),M_('float'));f.position.set(s*1.12,.22,.2);floats.add(f);
      const st=new THREE.Mesh(new THREE.BoxGeometry(.5,.06,.12),M_('carbon'));st.position.set(s*.85,.4,.9);floats.add(st);const st2=st.clone();st2.position.z=-.6;floats.add(st2);}}
  root.userData={ch,wheels,wings,floats};scene.add(root);return root;
}
const car=buildCar(mats,false);
car.userData.fw=car.userData.ch.children.filter(o=>o.isMesh&&o.position.z>2.6);car.userData.rw=car.userData.ch.children.filter(o=>o.isMesh&&o.position.z<-2.1&&o.position.y>1.05);
const gm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,depthWrite:false});
const ghost=buildCar({body:gm},true);ghost.visible=false;


/* ---------- Levels ---------- */
const LEVELS=[
 {name:'First Light',zones:[0,1],hz:[['lava',.3],['rift',.62]],seed:3,R:500},
 {name:'Salt & Steam',zones:[1,0],hz:[['flood',.22],['lava',.52],['rift',.8]],seed:8,R:540},
 {name:'Lantern Run',zones:[2,1],hz:[['flood',.25],['rift',.5],['rift',.8]],seed:13,R:560},
 {name:'Frostbite',zones:[3,2],hz:[['ice',.18],['rift',.42],['ice',.64],['rift',.86]],seed:21,R:580},
 {name:'Four Corners',zones:[0,1,2,3],hz:[['lava',.1],['flood',.3],['rift',.53],['ice',.76]],seed:34,R:640},
 {name:'Fire & Flood',zones:[0,1,0,1],hz:[['lava',.12],['flood',.28],['rift',.44],['lava',.62],['flood',.8]],seed:55,R:660},
 {name:'Glass Storm',zones:[3,1,3,2],hz:[['ice',.09],['flood',.26],['rift',.41],['ice',.56],['rift',.72],['flood',.88]],seed:89,R:690},
 {name:'The Long Fracture',zones:[0,1,2,3,0],hz:[['lava',.07],['rift',.19],['flood',.31],['rift',.43],['ice',.55],['rift',.67],['lava',.79],['flood',.91]],seed:144,R:740}
];
const LAPS=2;
const W=8,CURB=1.4,EDGE=W+CURB,GROUND=-0.6,MAXS=60,SEA=GROUND-1.2;
let lamps=[],lampsOn=false;let lvl=null,LV=null,M=0,pts=[],nrm=[],head=[],hzType=null,HAZ=[],PADS=[],SEG=1,SEGZ=[0],tokens=[],lanterns=null,islands=[],lapLen=0,medals=[0,0,0],cx=0,cz=0;
const P=(i,off,dy)=>{i=((Math.round(i)%M)+M)%M;return new V3(pts[i].x+nrm[i].x*off,pts[i].y+dy,pts[i].z+nrm[i].z*off);};
const G=(i,off)=>{const p=P(i,off,0);p.y=GROUND;return p;};
const wrap=i=>((Math.round(i)%M)+M)%M;
const hzAt=i=>hzType?hzType[wrap(i)]:-1;
const inRift=i=>hzAt(i)===HZ.rift;
const hzNear=(i,pad)=>{for(const h of HAZ){const d=((i-h.a)%M+M)%M;if(d<h.b-h.a+pad||M-d<pad)return true;}return false;};
const segOf=i=>Math.min(SEG-1,Math.floor(wrap(i)/(M/SEG)));
function segW(i,out){let s=0;const L=M/SEG;for(let k=0;k<SEG;k++){const t=(((i-(k*L+L/2))%M)+M*1.5)%M-M/2;const v=clamp((L/2+30-Math.abs(t))/60,0,1);out[k]=v*v*(3-2*v);s+=out[k];}for(let k=0;k<SEG;k++)out[k]/=s||1;return out;}
const zw=(i,out)=>{const sw=segW(i,new Array(SEG).fill(0));out[0]=out[1]=out[2]=out[3]=0;for(let k=0;k<SEG;k++)out[SEGZ[k]]+=sw[k];return out;};

function ribbon(A,B,inc,uv){const pos=[],uvs=[];for(let i=0;i<M;i++){if(inc&&!inc(i))continue;const j=(i+1)%M;const a0=A(i),b0=B(i),a1=A(j),b1=B(j);for(const v of [a0,b0,a1,b0,b1,a1])pos.push(v.x,v.y,v.z);
  if(uv){const v0=i*.12,v1=(i+1)*.12;uvs.push(0,v0,1,v0,0,v1,1,v0,1,v1,0,v1);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;}
const add=(g,m)=>{const me=new THREE.Mesh(g,m);lvl.add(me);return me;};
function merge(geos){const pos=[],nor=[];for(let g of geos){g=g.index?g.toNonIndexed():g;g.computeVertexNormals();const a=g.attributes.position.array,b=g.attributes.normal.array;for(let i=0;i<a.length;i++){pos.push(a[i]);nor.push(b[i]);}}const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));m.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));return m;}
function kit(parts,n){const ims=parts.map(([g,m])=>{const im=new THREE.InstancedMesh(g,m,n);lvl.add(im);return im;});let k=0;return{add(mx){if(k>=n)return false;ims.forEach(im=>im.setMatrixAt(k,mx));k++;return true;},done(){ims.forEach(im=>{im.count=k;im.instanceMatrix.needsUpdate=true;});}};}
const dummy=new THREE.Object3D();
const fieldAt=(x,z)=>{let bd=1e12,bi=0;for(let i=0;i<M;i+=4){const dx=x-pts[i].x,dz=z-pts[i].z,d=dx*dx+dz*dz;if(d<bd){bd=d;bi=i;}}return [Math.sqrt(bd),bi];};
function heightAt(x,z,d,bi,w){
  const f=sstep(EDGE+5,EDGE+45,d),far=sstep(160,520,d);
  const dunes=(Math.sin(x*.031+Math.sin(z*.012)*2)+Math.sin(z*.027+x*.008)+2)*2.2*f+far*10*(Math.sin(z*.01+x*.004)+1);
  const sea=-5.5*sstep(18,70,d);
  const hills=(Math.sin(x*.021)*Math.cos(z*.019)+1.2)*5*f+far*22*(Math.sin(x*.006+z*.004)+1.1);
  const drifts=(Math.sin(x*.045+z*.03)+1)*1.5*f+far*14*(Math.sin(x*.008)+1);
  let h=w[0]*dunes+w[1]*sea+w[2]*hills+w[3]*drifts;
  if(hzNear(bi,12)&&d<EDGE+60)h*=sstep(EDGE+40,EDGE+60,d);
  return GROUND+h;
}
function scatterSeg(s,n,minD,maxD,K,shape){
  const L=M/SEG;let placed=0,t=0;const w=[0,0,0,0];
  while(placed<n&&t<n*50){t++;const i=Math.floor(s*L+rnd()*L)%M;const side=rnd()<.5?1:-1;const dd=minD+Math.pow(rnd(),1.3)*(maxD-minD);const p=P(i,side*dd,0);
    const [d,bi]=fieldAt(p.x,p.z);if(d<minD-1||segOf(bi)!==s)continue;if(hzNear(bi,12)&&d<EDGE+60)continue;zw(bi,w);const y=heightAt(p.x,p.z,d,bi,w);
    dummy.position.set(p.x,y,p.z);dummy.rotation.set(0,rnd()*6.283,0);dummy.scale.set(1,1,1);if(shape(dummy,y,d)===false)continue;dummy.updateMatrix();if(!K.add(dummy.matrix))break;placed++;}
  K.done();
}
const C=(r1,r2,h,s)=>new THREE.CylinderGeometry(r1,r2,h,s||7);
// shared scenery geometry
const G_={rock:new THREE.DodecahedronGeometry(1,0),
  cactus:merge([C(.42,.5,6).translate(0,3,0),new THREE.SphereGeometry(.42,8,6).translate(0,6,0),C(.3,.3,.8).rotateZ(Math.PI/2).translate(.7,2.9,0),C(.3,.3,2.4).translate(1.1,4,0),new THREE.SphereGeometry(.3,7,5).translate(1.1,5.2,0),C(.28,.28,.7).rotateZ(Math.PI/2).translate(-.6,2.3,0),C(.28,.28,1.8).translate(-.95,3.1,0),new THREE.SphereGeometry(.28,7,5).translate(-.95,4,0)]),
  mesa:C(1,1.15,1,8).translate(0,.5,0),cone:new THREE.ConeGeometry(1,1,6).translate(0,.5,0)};
{const t=[],l=[];const r=mkRnd(4);for(let k=0;k<7;k++)t.push(C(.34-k*.025,.38-k*.025,1.35).translate(.045*k*k,k*1.25+.65,0));t.push(new THREE.SphereGeometry(.28,6,5).translate(2.1,8.3,.25),new THREE.SphereGeometry(.28,6,5).translate(1.9,8.3,-.25));
 for(let k=0;k<8;k++)l.push(new THREE.ConeGeometry(.7,4.6,3).translate(0,2.3,0).scale(1,1,.22).rotateZ(-1.05-r()*.35).rotateY(k*Math.PI/4+r()*.3).translate(2.1,8.8,0));G_.palmT=merge(t);G_.palmL=merge(l);}
{const hull=new THREE.BoxGeometry(1.6,.7,4.6);const hp=hull.attributes.position;for(let i=0;i<hp.count;i++){if(hp.getZ(i)>0)hp.setX(i,hp.getX(i)*.15);if(hp.getY(i)<0)hp.setX(i,hp.getX(i)*.6);}
 const sail=new THREE.Shape();sail.moveTo(0,0);sail.lineTo(0,4.6);sail.lineTo(2.4,0);sail.closePath();G_.hull=merge([hull.translate(0,.2,0),C(.06,.06,5.2,5).translate(0,2.9,.2)]);G_.sail=new THREE.ShapeGeometry(sail).rotateY(Math.PI/2).translate(0,.9,-1.4);}
G_.trunk=C(.35,.5,3).translate(0,1.5,0);G_.firs=merge([new THREE.ConeGeometry(3,5,7).translate(0,4.5,0),new THREE.ConeGeometry(2.4,4.2,7).translate(0,6.8,0),new THREE.ConeGeometry(1.7,3.4,7).translate(0,8.9,0)]);
G_.stem=C(.22,.32,1.6,8).translate(0,.8,0);G_.cap=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2).scale(1,.6,1).translate(0,1.5,0);
G_.crystal=merge([new THREE.OctahedronGeometry(1,0).scale(1,3.4,1).translate(0,2.8,0),new THREE.OctahedronGeometry(.7,0).scale(1,2.6,1).rotateZ(.5).translate(.9,1.6,0),new THREE.OctahedronGeometry(.6,0).scale(1,2.2,1).rotateZ(-.6).translate(-.8,1.3,.3)]);
G_.pTrunk=C(.3,.4,2.4).translate(0,1.2,0);G_.pine=merge([new THREE.ConeGeometry(2.6,4.4,7).translate(0,4,0),new THREE.ConeGeometry(1.9,3.6,7).translate(0,6.2,0)]);G_.snowcap=new THREE.ConeGeometry(1.2,2.6,7).translate(0,8.2,0);
G_.umbP=C(.06,.06,3.2,5).translate(0,1.6,0);G_.umbC=new THREE.ConeGeometry(1.7,.75,8).translate(0,3.2,0);
const SM={rock:phong(0xa9573c),cactus:phong(0x4f7a46),mesa:phong(0xc0643e),palmT:phong(0x8f6c49),palmL:phong(0x2f9e5a),umbP:phong(0xf6f1e6),umbC:phong(0xff6f5a),hull:phong(0x2d6f9c),sail:phong(0xfff6e8),searock:phong(0x8a7a6a),
  trunk:phong(0x3a2a2c),firs:phong(0x1f5c4c),stem:phong(0xf2efe6),caps:[basic(0x5ffff0),basic(0xff6fd8),basic(0xffe37a)],hills:phong(0x0e2a22),lantern:basic(0xffcf6a),
  cr1:new THREE.MeshPhongMaterial({color:0xd8c4ff,emissive:0x7a52e0,shininess:120,specular:0xffffff,transparent:true,opacity:.86,flatShading:true}),
  cr2:new THREE.MeshPhongMaterial({color:0xc6f6ff,emissive:0x2ea6c8,shininess:120,specular:0xffffff,transparent:true,opacity:.86,flatShading:true}),
  pTrunk:phong(0x4a3a4e),pine:phong(0x3d7a7c),snow:phong(0xf7f6ff),peaks:phong(0xe6e2ff),isl:phong(0x8f7fc4),islC:new THREE.MeshPhongMaterial({color:0xffc6ec,emissive:0xd05aa8,flatShading:true,shininess:100})};
const LAMPM=basic(0xfff1c8);
const CHEVM=basic(0xffffff,{map:(()=>{const c=document.createElement('canvas');c.width=128;c.height=48;const x=c.getContext('2d');x.fillStyle='#c8352b';x.fillRect(0,0,128,48);x.fillStyle='#fff8ee';
  for(let k=0;k<3;k++){const o=14+k*38;x.beginPath();x.moveTo(o,6);x.lineTo(o+16,6);x.lineTo(o+32,24);x.lineTo(o+16,42);x.lineTo(o,42);x.lineTo(o+16,24);x.closePath();x.fill();}return new THREE.CanvasTexture(c);})()});
const SHARED=new Set([LAMPM,CHEVM,...Object.values(mats),...Object.values(SM).flat(),seaMat,floodMat]);
const SHAREDG=new Set(Object.values(G_));

function buildScenery(s,z,L){
  const f=L/240*(coarse?.5:1);const n=k=>Math.max(1,Math.round(k*f));
  if(z===0){scatterSeg(s,n(140),EDGE+6,260,kit([[G_.rock,SM.rock]],n(140)),o=>{const k=1+rnd()*4;o.scale.set(k*(1+rnd()),k*(.5+rnd()*.6),k*(1+rnd()*.6));o.position.y+=k*.15;});
    scatterSeg(s,n(90),EDGE+8,200,kit([[G_.cactus,SM.cactus]],n(90)),o=>{o.scale.setScalar(.8+rnd()*.7);});
    scatterSeg(s,n(20),170,520,kit([[G_.mesa,SM.mesa]],n(20)),(o,y)=>{const r=25+rnd()*55;o.scale.set(r,24+rnd()*50,r*(.6+rnd()*.5));o.position.y=y-3;});}
  if(z===1){scatterSeg(s,n(110),EDGE+6,70,kit([[G_.palmT,SM.palmT],[G_.palmL,SM.palmL]],n(110)),(o,y)=>{if(y<SEA+.4)return false;o.scale.setScalar(.8+rnd()*.6);});
    scatterSeg(s,n(26),EDGE+8,45,kit([[G_.umbP,SM.umbP],[G_.umbC,SM.umbC]],n(26)),(o,y)=>{if(y<SEA+.3)return false;o.rotation.z=(rnd()-.5)*.25;});
    scatterSeg(s,n(24),90,420,kit([[G_.hull,SM.hull],[G_.sail,SM.sail]],n(24)),(o,y)=>{if(y>SEA-2)return false;o.position.y=SEA+.1;o.scale.setScalar(1+rnd()*.8);});
    scatterSeg(s,n(30),60,300,kit([[G_.rock,SM.searock]],n(30)),(o,y)=>{if(y>SEA-1)return false;const k=1.5+rnd()*4;o.scale.set(k,k*.7,k);o.position.y=SEA;});}
  if(z===2){scatterSeg(s,n(260),EDGE+8,260,kit([[G_.trunk,SM.trunk],[G_.firs,SM.firs]],n(260)),o=>{o.scale.setScalar(1+rnd()*1.2);});
    for(const cm of SM.caps)scatterSeg(s,n(40),EDGE+4,60,kit([[G_.stem,SM.stem],[G_.cap,cm]],n(40)),o=>{o.scale.setScalar(.7+rnd()*1.6);});
    scatterSeg(s,n(26),180,600,kit([[G_.cone,SM.hills]],n(26)),(o,y)=>{const r=80+rnd()*140;o.scale.set(r,60+rnd()*120,r);o.position.y=y-2;});
    const im=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.45,0),SM.lantern,n(70));lvl.add(im);const list=[];
    for(let k=0;k<n(70);k++){const i=Math.floor(s*L+rnd()*L);list.push({p:P(i,(rnd()<.5?1:-1)*(EDGE+3+rnd()*30),5+rnd()*16),ph:rnd()*6});}
    lanterns.push({im,list});}
  if(z===3){scatterSeg(s,n(60),EDGE+5,140,kit([[G_.crystal,SM.cr1]],n(60)),o=>{o.scale.setScalar(.8+rnd()*1.8);});
    scatterSeg(s,n(50),EDGE+5,140,kit([[G_.crystal,SM.cr2]],n(50)),o=>{o.scale.setScalar(.8+rnd()*1.6);});
    scatterSeg(s,n(180),EDGE+8,240,kit([[G_.pTrunk,SM.pTrunk],[G_.pine,SM.pine],[G_.snowcap,SM.snow]],n(180)),o=>{o.scale.setScalar(.9+rnd()*1.1);});
    scatterSeg(s,n(26),200,620,kit([[G_.cone,SM.peaks]],n(26)),(o,y)=>{const r=90+rnd()*140;o.scale.set(r,120+rnd()*170,r);o.position.y=y-2;});
    for(let k=0;k<n(16);k++){const i=Math.floor(s*L+rnd()*L);const p=P(i,(rnd()<.5?1:-1)*(40+rnd()*220),30+rnd()*70);const g=new THREE.Group();const sz=4+rnd()*9;
      const rock=new THREE.Mesh(new THREE.ConeGeometry(1,2.2,7).rotateX(Math.PI).translate(0,-1.1,0),SM.isl);rock.scale.setScalar(sz);g.add(rock);
      const top=new THREE.Mesh(C(1.02,1,.25,7),SM.snow);top.scale.setScalar(sz);top.position.y=.1*sz;g.add(top);
      const cr=new THREE.Mesh(G_.crystal,SM.islC);cr.scale.setScalar(sz*.22);cr.position.y=.2*sz;g.add(cr);
      g.position.copy(p);lvl.add(g);islands.push({g,y:p.y,ph:rnd()*6});}}
}

function setLamps(ct){if(!lamps.length)return;if(ct<0){lamps.forEach(m=>m.color.setHex(0x2a0808));lampsOn=false;return;}lampsOn=true;const on=ct>0?Math.min(5,Math.floor((3.6-ct)/.6)+1):0;lamps.forEach((m,k)=>m.color.setHex(ct<=0?0x3cff8a:(k<on?0xff2a1a:0x2a0808)));}
function disposeLevel(){if(!lvl)return;scene.remove(lvl);lvl.traverse(o=>{if(o.geometry&&!SHAREDG.has(o.geometry))o.geometry.dispose();if(o.material&&!SHARED.has(o.material)&&!Array.isArray(o.material))o.material.dispose();});lvl=null;}

function buildLevel(li){
  disposeLevel();LV=LEVELS[li];lvl=new THREE.Group();scene.add(lvl);rnd=mkRnd(LV.seed);
  // track: a star-shaped loop so it never crosses itself
  const N=30,ph=[0,0,0,0,0,0].map(()=>rnd()*6.283),ctrl=[];
  for(let k=0;k<N;k++){const t=k/N*Math.PI*2;const r=LV.R*(1+.17*Math.sin(2*t+ph[0])+.11*Math.sin(3*t+ph[1])+.06*Math.sin(5*t+ph[2])+.03*Math.sin(7*t+ph[3]));
    ctrl.push(new V3(Math.cos(t)*r,1.2+2.6*(Math.sin(2*t+ph[4])+1)+1.4*Math.sin(5*t+ph[5])+1.4,Math.sin(t)*r*.82));}
  const curve=new THREE.CatmullRomCurve3(ctrl,true,'centripetal');lapLen=curve.getLength();
  M=Math.round(lapLen/1.8);pts=curve.getSpacedPoints(M).slice(0,M);nrm=[];head=[];
  for(let i=0;i<M;i++){const a=pts[(i-1+M)%M],b=pts[(i+1)%M];const t=new V3(b.x-a.x,0,b.z-a.z).normalize();nrm.push(new V3(t.z,0,-t.x));head.push(Math.atan2(t.x,t.z));}
  cx=pts.reduce((s,p)=>s+p.x,0)/M;cz=pts.reduce((s,p)=>s+p.z,0)/M;
  SEGZ=LV.zones;SEG=SEGZ.length;
  // hazards
  hzType=new Int8Array(M).fill(-1);HAZ=[];
  for(const [type,fr] of LV.hz){const t=HZ[type],a=Math.round(fr*M),b=a+HZLEN[t];HAZ.push({t,a,b});for(let i=a;i<b;i++)hzType[wrap(i)]=t;}
  const plain=i=>hzType[i]<0&&hzType[(i+1)%M]<0;
  const notRift=i=>hzType[i]!==0&&hzType[(i+1)%M]!==0;
  // road + markings
  add(ribbon(i=>P(i,-W,0),i=>P(i,W,0),i=>plain(i)),mats.road).receiveShadow=true;
  add(ribbon(i=>P(i,-.2,.02),i=>P(i,.2,.02),i=>plain(i)&&i>8&&(i%12)<6),mats.line);
  add(ribbon(i=>P(i,-W,.03),i=>P(i,W,.03),i=>i<2),mats.line);
  for(const s of [1,-1]){
    add(ribbon(i=>P(i,s*W,.03),i=>P(i,s*EDGE,.03),i=>notRift(i)&&Math.floor(i/4)%2===0),mats.curbA).receiveShadow=true;
    add(ribbon(i=>P(i,s*W,.03),i=>P(i,s*EDGE,.03),i=>notRift(i)&&Math.floor(i/4)%2===1),mats.curbB).receiveShadow=true;
    add(ribbon(i=>P(i,s*EDGE,0),i=>P(i,s*EDGE,.9),notRift),mats.rail);
    add(ribbon(i=>P(i,s*EDGE,0),i=>G(i,s*EDGE),notRift),mats.side);
  }
  // hazard surfaces
  const flat=(i,off,dy)=>{const p=P(i,off,0);p.y=GROUND+dy;return p;};
  for(const h of HAZ){const inc=i=>{const d=((i-h.a)%M+M)%M;return d<h.b-h.a;},wide=pad=>i=>{const d=((i-h.a+pad)%M+M)%M;return d<h.b-h.a+pad*2;};
    if(h.t===0){
      for(const [e,dir] of [[h.a-1,1],[h.b,-1]]){const g=new THREE.BufferGeometry().setFromPoints([P(e,-EDGE,0),P(e,EDGE,0),G(e,EDGE),P(e,-EDGE,0),G(e,EDGE),G(e,-EDGE)]);g.computeVertexNormals();add(g,mats.side);
        for(let k=0;k<7;k++){const i=e+dir*(1+Math.floor(rnd()*5));const p=P(i,(rnd()-.5)*2*W,-1.2-rnd()*3);const sl=add(new THREE.BoxGeometry(2+rnd()*3,.5,1.5+rnd()*2.5),mats.road);sl.position.copy(p);sl.rotation.set((rnd()-.5)*1.2,rnd()*6,(rnd()-.5)*1.2);}}
      add(ribbon(i=>flat(i,-(EDGE+14),.08),i=>flat(i,EDGE+14,.08),wide(3)),mats.abyss);
      for(const sd of [1,-1])add(ribbon(i=>flat(i,sd*(EDGE+14),.1),i=>flat(i,sd*(EDGE+15.4),.1),wide(3)),mats.rail);
    }else if(h.t===1){
      add(ribbon(i=>P(i,-W,.01),i=>P(i,W,.01),inc,true),mats.lava);
      add(ribbon(i=>flat(i,-(EDGE+46),.1),i=>flat(i,EDGE+46,.1),wide(2),true),mats.lava);
      for(const sd of [1,-1])add(ribbon(i=>flat(i,sd*(EDGE+46),.12),i=>flat(i,sd*(EDGE+50),.12),wide(4)),mats.basalt);
    }else if(h.t===2){
      add(ribbon(i=>P(i,-W,-.8),i=>P(i,W,-.8),inc),mats.road);
      add(ribbon(i=>P(i,-EDGE-.4,.32),i=>P(i,EDGE+.4,.32),inc),floodMat);
      add(ribbon(i=>flat(i,-(EDGE+52),.3),i=>flat(i,EDGE+52,.3),wide(10)),seaMat);
    }else{
      add(ribbon(i=>P(i,-W,.015),i=>P(i,W,.015),inc),mats.ice);
      for(const sd of [1,-1])add(ribbon(i=>P(i,sd*(W-1.2),.025),i=>P(i,sd*W,.025),inc),mats.frost);
      add(ribbon(i=>flat(i,-(EDGE+40),.08),i=>flat(i,EDGE+40,.08),wide(6)),mats.ice);
    }}
  // start gantry
  {const l=P(0,W+2,0),r=P(0,-W-2,0);const post=new THREE.BoxGeometry(.6,8,.6);const a=add(post,mats.trim);a.position.set(l.x,l.y+4,l.z);const b=add(post,mats.trim);b.position.set(r.x,r.y+4,r.z);
   const beam=add(new THREE.BoxGeometry(2*W+4.6,1.1,.7),mats.rail);beam.position.set(pts[0].x,pts[0].y+8,pts[0].z);beam.rotation.y=head[0]+Math.PI/2;
   lamps=[];const lg=new THREE.SphereGeometry(.42,12,8);for(let k=0;k<5;k++){const m=basic(0x2a0808);const l=add(lg,m);const p=P(0,(k-2)*1.3,7.6);const t=new V3(Math.sin(head[0]),0,Math.cos(head[0]));l.position.copy(p).addScaledVector(t,-.5);lamps.push(m);}
   const crowd=new THREE.InstancedMesh(new THREE.BoxGeometry(.5,.8,.5),new THREE.MeshLambertMaterial({color:0xffffff}),900);lvl.add(crowd);let cn=0;const cc=new THREE.Color(),PALC=[0xff5a36,0xffd36b,0x4fe3ff,0xffffff,0x7be3a2,0xff7ad8,0x5a8bff,0x222222];
   for(const sd of [1,-1])for(let i=-34;i<=34;i+=4){if(hzNear(wrap(i),30))continue;for(let tier=0;tier<4;tier++){const off=sd*(EDGE+6+tier*2.2);const p=P(i,off,0);const stand=add(new THREE.BoxGeometry(2.2,1.2+tier*1.2,7.4),tier%2?mats.trim:mats.side);stand.position.set(p.x,GROUND+(1.2+tier*1.2)/2,p.z);stand.rotation.y=head[wrap(i)];
      for(let q=-3;q<=3;q+=1.5){if(cn>=900)break;const cp=P(i+q*.55,off,0);dummy.position.set(cp.x,GROUND+1.2+tier*1.2+.4,cp.z);dummy.rotation.set(0,head[wrap(i)],0);dummy.scale.setScalar(.8+rnd()*.5);dummy.updateMatrix();crowd.setMatrixAt(cn,dummy.matrix);crowd.setColorAt(cn,cc.setHex(PALC[Math.floor(rnd()*PALC.length)]));cn++;}}}
   crowd.count=cn;crowd.instanceMatrix.needsUpdate=true;if(crowd.instanceColor)crowd.instanceColor.needsUpdate=true;}
  // boost pads between hazards
  {const sp=coarse?22:14,n=Math.ceil(M/sp);const postG=merge([C(.09,.12,6.2,6).translate(0,3.1,0),new THREE.BoxGeometry(.12,.12,3.8).translate(0,6.15,-1.8)]),headG=new THREE.BoxGeometry(.55,.16,.9).translate(0,6.05,-3.4);
   const ip=new THREE.InstancedMesh(postG,mats.trim,n),ih=new THREE.InstancedMesh(headG,LAMPM,n);let c=0;
   for(let i=40;i<M-40&&c<n;i+=sp){if(hzNear(i,10))continue;const sd=c%2?1:-1;dummy.position.copy(P(i,sd*(EDGE+.35),0));dummy.rotation.set(0,head[i]+sd*Math.PI/2,0);dummy.scale.set(1,1,1);dummy.updateMatrix();ip.setMatrixAt(c,dummy.matrix);ih.setMatrixAt(c,dummy.matrix);c++;}
   ip.count=ih.count=c;lvl.add(ip);lvl.add(ih);
   const bg=new THREE.PlaneGeometry(2,.8).translate(0,1.3,0),nc=coarse?50:100,ic=new THREE.InstancedMesh(bg,CHEVM,nc);let q=0;
   for(let i=30;i<M-30&&q<nc;i+=6){const turn=Math.abs(ang(head[wrap(i+22)],head[i]));if(turn<.42||hzNear(i,8))continue;
     const pa=P(i+22,0,0),pi=P(i,0,0),dl=(pa.x-pi.x)*nrm[i].x+(pa.z-pi.z)*nrm[i].z,sd=dl>0?-1:1;
     dummy.position.copy(P(i,sd*(EDGE+1.1),0));dummy.rotation.set(0,head[i]+Math.PI,0);dummy.scale.set(dl>0?-1:1,1,1);dummy.updateMatrix();ic.setMatrixAt(q++,dummy.matrix);}
   ic.count=q;lvl.add(ic);}
  PADS=[];{const sh=new THREE.Shape();sh.moveTo(-1.8,0);sh.lineTo(0,1.2);sh.lineTo(1.8,0);sh.lineTo(1.8,.7);sh.lineTo(0,1.9);sh.lineTo(-1.8,.7);sh.closePath();
   const cg=new THREE.ShapeGeometry(sh).rotateX(-Math.PI/2).rotateY(Math.PI);
   for(let i=Math.round(M*.04);i<M-40;i+=Math.round(M/9)){let j=i;while(hzNear(j,90)&&j<i+Math.round(M/9)-20)j+=10;if(hzNear(j,90))continue;const off=[-4,0,4][Math.floor(rnd()*3)];PADS.push([j,off]);for(let k=0;k<3;k++){const m=add(cg,mats.boost);m.position.copy(P(j+k*1.6,off,.05));m.rotation.y=head[j];}}}
  // terrain
  const size=LV.R*2+3400;const gg=new THREE.PlaneGeometry(size,size,150,150).rotateX(-Math.PI/2);gg.translate(cx,0,cz);
  {const p=gg.attributes.position,cols=new Float32Array(p.count*3),w=[0,0,0,0],c=new THREE.Color(),c2=new THREE.Color(),tmp=new THREE.Color();
   const seaDeep=new THREE.Color(0x0f6f86),seaShal=new THREE.Color(0x3cc7b8),wet=new THREE.Color(0xd8b98a),dark=new THREE.Color(0x2a1a1a);
   for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);const [d,bi]=fieldAt(x,z);zw(bi,w);const y=heightAt(x,z,d,bi,w);p.setY(i,y);
     const nn=(Math.sin(x*.11+z*.07)+Math.sin(x*.05-z*.13))*.25+.5;c.setRGB(0,0,0);
     for(let k=0;k<4;k++){if(!w[k])continue;c2.setHex(ZONES[k].g1).lerp(tmp.setHex(ZONES[k].g2),nn);c.r+=c2.r*w[k];c.g+=c2.g*w[k];c.b+=c2.b*w[k];}
     if(y<SEA+.6){const t=sstep(SEA+.6,SEA-3.5,y);c.lerp(wet,clamp((SEA+.6-y)*2,0,1)*.6);c.lerp(seaShal,t*.8);c.lerp(seaDeep,sstep(SEA-1,SEA-4.5,y));}
     if(hzNear(bi,12)&&d<EDGE+60)c.lerp(dark,.35*(1-sstep(EDGE+40,EDGE+60,d)));
     cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b;}
   gg.setAttribute('color',new THREE.BufferAttribute(cols,3));gg.computeVertexNormals();}
  const ground=add(gg,new THREE.MeshPhongMaterial({vertexColors:true,flatShading:true,shininess:0}));ground.receiveShadow=true;
  sea.position.set(cx,SEA,cz);clouds.position.set(cx,0,cz);
  // scenery per world segment
  lanterns=[];islands=[];
  for(let s=0;s<SEG;s++)buildScenery(s,SEGZ[s],M/SEG);
  // tokens: a set of the right power before each hazard, plus mixed ones along the lap
  tokens=[];
  for(const h of HAZ){for(const [dk,off] of [[-96,-2.5],[-78,0],[-60,2.5]])addTok(h.t,h.a+dk,off,1.9);if(h.t===0)addTok(0,(h.a+h.b)>>1,0,7.5);}
  const types=[...new Set(HAZ.map(h=>h.t))];
  for(let i=60;i<M-30;i+=48){if(hzNear(i,110)||i<20)continue;const nextH=HAZ.find(h=>h.a>i)||HAZ[0];const t=rnd()<.6?nextH.t:types[Math.floor(rnd()*types.length)];addTok(t,i,Math.sin(i*.07)*3.2,1.9);}
  // medal times (whole race)
  const race=lapLen*LAPS;medals=[race/46,race/41,race/35];
}


repaint([0xf4f1ec,0xff5a36,0x18161c,0x2fd2c9]);
car.traverse(o=>{if(o.isMesh)o.castShadow=true;});
const carStd=[];car.traverse(o=>{if(o.isMesh&&o.material&&o.material.userData.car&&!carStd.includes(o.material))carStd.push(o.material);});
const envCan=document.createElement('canvas');envCan.width=256;envCan.height=128;const ex=envCan.getContext('2d');let envTex=null;
const css=c=>'rgb('+Math.min(255,c.r*255|0)+','+Math.min(255,c.g*255|0)+','+Math.min(255,c.b*255|0)+')';
function refreshEnv(){try{
  const t=skyU.top.value,h=skyU.hor.value,s=skyU.sunC.value,d=skyU.sunD.value;
  const g=ex.createLinearGradient(0,0,0,128);g.addColorStop(0,css(t));g.addColorStop(.47,css(h));g.addColorStop(.53,css(h.clone().multiplyScalar(.55)));g.addColorStop(1,css(hemi.groundColor.clone().multiplyScalar(.6)));ex.fillStyle=g;ex.fillRect(0,0,256,128);
  const u=(Math.atan2(d.x,d.z)/(2*Math.PI)+.5)*256,v=(.5-Math.asin(clamp(d.y,-1,1))/Math.PI)*128;const sg=ex.createRadialGradient(u,v,0,u,v,22);sg.addColorStop(0,css(s));sg.addColorStop(1,'rgba(0,0,0,0)');ex.fillStyle=sg;ex.fillRect(0,0,256,128);
  const tex=new THREE.CanvasTexture(envCan);tex.mapping=THREE.EquirectangularReflectionMapping;
  for(const m of carStd){m.envMap=tex;m.combine=THREE.MixOperation;m.reflectivity=m.userData.refl;m.needsUpdate=true;}
  if(envTex)envTex.dispose();envTex=tex;}catch(e){}}

/* ---------- Tokens ---------- */
const tokRing=new THREE.TorusGeometry(1.45,.14,8,36);
const tokCore=[new THREE.OctahedronGeometry(.45),new THREE.DodecahedronGeometry(.42),new THREE.SphereGeometry(.42,12,8).scale(1.3,.6,.8),new THREE.IcosahedronGeometry(.44)];
SHAREDG.add(tokRing);tokCore.forEach(g=>SHAREDG.add(g));
function addTok(t,i,off,dy){const g=new THREE.Group(),m=basic(PW[t].col,{transparent:true});const ring=new THREE.Mesh(tokRing,m),core=new THREE.Mesh(tokCore[t],m);g.add(ring);g.add(core);const p=P(i,off,dy);g.position.copy(p);g.rotation.y=head[wrap(i)];lvl.add(g);tokens.push({t,g,ring,core,m,home:p.clone(),got:false,k:0});}
function resetTokens(){for(const t of tokens){t.got=false;t.k=0;t.g.visible=true;t.g.scale.setScalar(1);t.m.opacity=1;t.g.position.copy(t.home);}}

/* ---------- Saved progress (this browser only) ---------- */
let prog={unlocked:1,best:{},medal:{},name:'',gp:{unlocked:1,pos:{}},seen:{}};let lvlMode='single';
try{const p=JSON.parse(localStorage.getItem('gn.progress')||'null');if(p&&p.unlocked)prog=Object.assign(prog,p);if(!prog.gp)prog.gp={unlocked:1,pos:{}};if(!prog.seen)prog.seen={};}catch(e){}
const saveProg=()=>{try{localStorage.setItem('gn.progress',JSON.stringify(prog));}catch(e){}};
const MEDAL=['Gold','Silver','Bronze'],MEDALC=['var(--gold)','var(--silver)','var(--bronze)'];
const fmt=t=>{if(t==null)return'—';const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(3);};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Screens ---------- */
let screen='scrTitle';
function show(id){screen=id;if(id){$('zoneBanner').classList.remove('show');bannerT=0;}document.querySelectorAll('[data-screen]').forEach(s=>s.hidden=s.id!==id);if(id==='scrLevels')renderLevels();}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show(b.dataset.back));
$('goSingle').onclick=()=>{lvlMode='single';show('scrLevels');};
$('goGP').onclick=()=>{lvlMode='gp';show('scrLevels');};
$('goMulti').onclick=()=>{show('scrMulti');$('nameIn').value=prog.name||'';initRoom();};
const HZNAME=['Rift','Lava','Flood','Ice'];
const POSN=['1st','2nd','3rd'];
function renderLevels(){
  const gp=lvlMode==='gp',unl=gp?prog.gp.unlocked:prog.unlocked;
  $('lvlEyebrow').textContent=gp?'Multiplayer · vs 7 AI drivers':'Single player · time trial';
  $('lvlNote').textContent=gp?'Finish on the podium (top 3) to unlock the next level. Rivals get faster every level.':'Beat the bronze time to unlock the next level.';
  $('levelGrid').innerHTML=LEVELS.map((L,i)=>{const locked=i>=unl,md=gp?prog.gp.pos[i]:prog.medal[i];
    return '<button class="lvl" type="button" data-l="'+i+'"'+(locked?' disabled':'')+'><span class="sw">'+L.zones.map(z=>'<i style="background:linear-gradient(180deg,'+hex(ZONES[z].hor)+','+hex(ZONES[z].g1)+')"></i>').join('')+'</span>'+
    (locked?'<span class="lock">Locked</span>':(md!=null?'<span class="md" style="color:'+(md<3?MEDALC[md]:'var(--dim)')+'">'+(gp?(md<3?POSN[md]:'P'+(md+1)):MEDAL[md])+'</span>':''))+
    '<span class="tx"><span class="no">Level '+(i+1)+(!gp&&prog.best[i]?' · '+fmt(prog.best[i]):(gp?' · AI '+(['easy','easy','steady','steady','quick','quick','fierce','brutal'][i]):''))+'</span><span class="nm">'+L.name+'</span><span class="hz">'+[...new Set(L.hz.map(h=>HZ[h[0]]))].map(t=>'<span class="hzt" style="color:var('+PW[t].css+')">'+HZNAME[t]+'</span>').join('')+'</span></span></button>';}).join('');
  $('levelGrid').querySelectorAll('.lvl:not([disabled])').forEach(b=>b.onclick=()=>startRace(+b.dataset.l,lvlMode));
}

/* ---------- HUD: power switches ---------- */
$('powers').innerHTML=PW.map((p,k)=>'<button class="pw" type="button" data-p="'+k+'" style="--c:var('+p.css+');pointer-events:auto;background:none;border:0;padding:0;cursor:pointer;color:inherit"><span>'+p.name.split(' ')[0]+' <kbd class="deskOnly">'+(k===0?'F':k+1)+'</kbd></span><span class="m"><b></b></span><span>OFF</span></button>').join('');
const pwEls=[...$('powers').querySelectorAll('.pw')];
pwEls.forEach(b=>{b.tabIndex=-1;b.addEventListener('pointerdown',e=>{e.preventDefault();toggle(+b.dataset.p);});});
['camBtn','sndBtn','pauseBtn'].forEach(id=>{$(id).tabIndex=-1;$(id).addEventListener('mousedown',e=>e.preventDefault());});

/* ---------- State ---------- */
const st={pos:new V3(),h:0,vh:0,speed:0,steer:0,idx:4,lat:0,onCurb:false,shake:0,air:false,vy:0,wingD:0,boost:0,pw:[0,0,0,0],on:[false,false,false,false],yOff:0,fl:0,heat:0,sink:0,dmg:0,dmgStage:0,pull:1,hitT:0};
let mode='menu',race=null,now=0,quarters=new Set(),camMode=0,paused=false,camT=0,warnedH=-1,inHzWarn=-1;
const CAMS=['Chase','Onboard','Drone'];
function placeOnGrid(lane){const i=4;st.idx=i;st.pos.copy(P(i,lane||0,0));st.h=st.vh=head[i];st.speed=0;st.steer=0;st.air=false;st.vy=0;st.wingD=0;st.boost=0;st.yOff=0;st.fl=0;st.heat=0;st.sink=0;quarters.clear();}
function toggle(k){if(mode!=='race'||!race||race.state==='done')return;
  if(!st.on[k]&&st.pw[k]<=0){flash(PW[k].name+' empty','Collect '+PW[k].name.toLowerCase()+' tokens','var('+PW[k].css+')');return;}
  st.on[k]=!st.on[k];tone(st.on[k]?440:330,st.on[k]?880:220,.18,'triangle',.05);if(st.on[k]&&tutorT===k){flash(PW[k].name+' on ✓',k===0?'Fly over the gap':'You are protected','var(--good)');}
  if(k===0&&st.on[0]&&!st.air){st.air=true;st.vy=9;if(st.speed<0)st.speed=0;}}

/* ---------- Input ---------- */
const keys={up:false,down:false,left:false,right:false,hb:false};
const keyMap={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'hb'};
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;
  if(mode==='race'&&document.activeElement&&document.activeElement!==document.body){document.activeElement.blur();if(e.code==='Space'||e.code==='Enter')e.preventDefault();}
  if(keyMap[e.code]){keys[keyMap[e.code]]=true;if(mode==='race')e.preventDefault();}
  if(e.repeat)return;
  if(e.code==='KeyF'||e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='Digit1')toggle(0);
  if(e.code==='Digit2')toggle(1);if(e.code==='Digit3')toggle(2);if(e.code==='Digit4')toggle(3);
  if(e.code==='KeyC')cycleCam();
  if(e.code==='KeyR'&&mode==='race')resetToTrack();
  if(e.code==='KeyP'||e.code==='Escape')togglePause();
  if(e.code==='Enter'&&screen==='scrFail'){e.preventDefault();$('failRetry').click();}
});
addEventListener('keyup',e=>{if(keyMap[e.code])keys[keyMap[e.code]]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
document.querySelectorAll('.tpw').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();toggle(+b.dataset.p);}));
// Touch: hold left / right half to steer, swipe up = power for the hazard ahead, swipe down = drift, hold both = brake
const tps=new Map();let hbUntil=0;
const loc=e=>ROT?{x:e.clientY,y:innerWidth-e.clientX}:{x:e.clientX,y:e.clientY};
function touchKeys(){let L=false,R2=false,dr=false;for(const p of tps.values()){if(p.g==='up')continue;if(p.side<0)L=true;else R2=true;if(p.g==='down')dr=true;}
  const both=L&&R2;keys.down=both;keys.left=L&&!both;keys.right=R2&&!both;keys.hb=!both&&(dr||performance.now()<hbUntil);
  $('touchZone').querySelector('.tzL').classList.toggle('on',L);$('touchZone').querySelector('.tzR').classList.toggle('on',R2);}
const tz=$('touchZone');
tz.addEventListener('pointerdown',e=>{e.preventDefault();const q=loc(e);tps.set(e.pointerId,{x0:q.x,y0:q.y,t0:performance.now(),side:q.x<AW/2?-1:1,g:null});try{tz.setPointerCapture(e.pointerId);}catch(_){}touchKeys();});
tz.addEventListener('pointermove',e=>{const p=tps.get(e.pointerId);if(!p||p.g)return;const q=loc(e),dx=q.x-p.x0,dy=q.y-p.y0;
  if(Math.abs(dy)>38&&Math.abs(dy)>Math.abs(dx)*1.15&&performance.now()-p.t0<600){p.g=dy<0?'up':'down';if(p.g==='up')smartPower();else{hbUntil=performance.now()+450;tone(180,120,.15,'square',.03);}touchKeys();}});
const tend=e=>{const p=tps.get(e.pointerId);if(p&&p.g==='down')hbUntil=performance.now()+300;tps.delete(e.pointerId);touchKeys();};
tz.addEventListener('pointerup',tend);tz.addEventListener('pointercancel',tend);
setInterval(()=>{if(coarse&&mode==='race')touchKeys();},100);
function targetPower(){let inside=-1,next=-1,bd=1e9;for(const h of HAZ){const len=h.b-h.a,into=((st.idx-h.a)%M+M)%M;if(into<len)inside=h.t;const d=((h.a-st.idx)%M+M)%M;if(d<bd&&d<420&&into>=len){bd=d;next=h.t;}}return inside>=0?inside:next;}
function smartPower(){if(mode!=='race'||!race||race.state!=='run')return;const t=targetPower();
  if(st.on[0]&&st.air&&t!==0){toggle(0);return;}
  if(t<0){const on=st.on.findIndex(x=>x);if(on>=0){toggle(on);return;}if(st.pw[0]>0){toggle(0);return;}flash('Nothing to power up','Swipe up when a hazard is ahead','');return;}
  toggle(t);}
// try real fullscreen + landscape lock on phones (works on Android when hosted on its own site)
let fsTried=false;function tryLandscape(){if(!coarse||fsTried)return;fsTried=true;try{const el=document.documentElement;const p=el.requestFullscreen?el.requestFullscreen({navigationUI:'hide'}):null;
  if(p&&p.then)p.then(()=>{try{screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{});}catch(_){}}).catch(()=>{});}catch(_){}}
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('pointerdown',tryLandscape));
function resetToTrack(){if(!race||race.state!=='run')return;if(hzAt(st.idx)===0){fell();return;}st.air=false;st.vy=0;turnAround('Back on track');}
function cycleCam(){camMode=(camMode+1)%CAMS.length;$('camName').textContent=CAMS[camMode];}
$('camBtn').onclick=cycleCam;$('pauseBtn').onclick=togglePause;$('pauseT').onclick=togglePause;
function togglePause(){if(mode!=='race'||(race&&(race.state==='failed'||race.state==='done'||race.state==='celebrate')))return;paused=!paused;tps.clear();keys.left=keys.right=keys.down=keys.hb=false;document.body.classList.toggle('paused',paused);
  if(paused){$('pauseTitle').textContent=(race.multi?'Room '+roomCode+' · ':'')+'Level '+(race.li+1)+' · '+LEVELS[race.li].name;$('restartBtn').hidden=race.multi;show('scrPause');$('resumeBtn').focus();engine(false);}
  else{engine(true);}}
$('resumeBtn').onclick=togglePause;
$('failRetry').onclick=()=>{paused=false;document.body.classList.remove('paused');startRace(race.li,race.kind);};
$('failLevels').onclick=()=>quitToMenu();$('failMenu').onclick=()=>quitToMenu(true);
$('restartBtn').onclick=()=>{paused=false;document.body.classList.remove('paused');startRace(race.li,race.kind);};
$('quitBtn').onclick=()=>quitToMenu();$('menuBtn').onclick=()=>quitToMenu(true);
function quitToMenu(toTitle){clearPodium();$('coach').hidden=true;$('wrongWay').hidden=true;wwT=0;tps.clear();const wasMulti=race&&race.multi;if(race)lvlMode=race.kind==='gp'?'gp':'single';paused=false;document.body.classList.remove('paused','racing');mode='menu';race=null;engine(false);clearRemotes();clearAI();
  if(wasMulti&&!toTitle){setP({s:'lobby',rr:null,f:null});show('scrLobby');}else show(toTitle?'scrTitle':'scrLevels');}

/* ---------- Audio ---------- */
let ac=null,osc1,osc2,filt,gain,soundOn=false,master,noiseBuf,windG,crowdG,squealG,lastGear=0;
function audioInit(){if(ac)return;try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  osc1=ac.createOscillator();osc1.type='sawtooth';osc2=ac.createOscillator();osc2.type='square';osc2.detune.value=-1200;
  filt=ac.createBiquadFilter();filt.type='lowpass';filt.frequency.value=700;gain=ac.createGain();gain.gain.value=0;
  master=ac.createGain();master.connect(ac.destination);
  noiseBuf=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);{const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const mk=(fr,q)=>{const n=ac.createBufferSource();n.buffer=noiseBuf;n.loop=true;const b=ac.createBiquadFilter();b.type='bandpass';b.frequency.value=fr;b.Q.value=q;const g=ac.createGain();g.gain.value=0;n.connect(b);b.connect(g);g.connect(master);n.start();return g;};
  windG=mk(800,.5);crowdG=mk(420,.7);squealG=mk(2600,7);
  osc1.connect(filt);osc2.connect(filt);filt.connect(gain);gain.connect(master);osc1.start();osc2.start();soundOn=true;$('sndName').textContent='On';}
function engine(on){if(!ac)return;gain.gain.setTargetAtTime(on&&soundOn?.05:0,ac.currentTime,.08);if(!on||!soundOn)for(const g of [windG,crowdG,squealG])g.gain.setTargetAtTime(0,ac.currentTime,.1);}
function impact(v){if(!ac||!soundOn)return;const n=ac.createBufferSource();n.buffer=noiseBuf;const b=ac.createBiquadFilter();b.type='lowpass';b.frequency.value=380;const g=ac.createGain();g.gain.setValueAtTime(v,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.3);n.connect(b);b.connect(g);g.connect(master);n.start();n.stop(ac.currentTime+.32);}
$('sndBtn').onclick=()=>{audioInit();if(!ac)return;soundOn=!soundOn;$('sndName').textContent=soundOn?'On':'Off';engine(mode==='race'&&!paused);};
function tone(f1,f2,dur,type,vol){if(!ac||!soundOn)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f1,ac.currentTime);o.frequency.exponentialRampToValueAtTime(f2,ac.currentTime+dur*.5);g.gain.setValueAtTime(vol||.08,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g);g.connect(master||ac.destination);o.start();o.stop(ac.currentTime+dur+.02);}

/* ---------- Messages ---------- */
let msgTimer=0,bannerT=0;
function flash(main,sub,col){if(bannerT>0){$('zoneBanner').classList.remove('show');bannerT=0;}const el=$('msg');el.innerHTML=esc(main)+(sub?'<span class="sub" style="color:'+(col||'var(--dim)')+'">'+esc(sub)+'</span>':'');el.style.opacity=1;msgTimer=1.9;}
function gainFx(t){const b=pwEls[t];b.classList.remove('gain');void b.offsetWidth;b.classList.add('gain');const p=$('gainPop');p.textContent='+34% '+PW[t].name.toLowerCase();p.style.color='var('+PW[t].css+')';p.classList.remove('show');void p.offsetWidth;p.classList.add('show');}

/* ---------- Minimap ---------- */
const mapC=$('minimap'),mctx=mapC.getContext('2d');let mapScale=1,mapOff=[0,0],segPaths=[],hzPaths=[];
function sizeMap(){if(!M)return;const r=mapC.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);mapC.width=Math.max(1,r.width*d);mapC.height=Math.max(1,r.height*d);
  let a=1e9,b=-1e9,c=1e9,e=-1e9;for(const p of pts){a=Math.min(a,p.x);b=Math.max(b,p.x);c=Math.min(c,p.z);e=Math.max(e,p.z);}
  const pad=10*d;mapScale=Math.min((mapC.width-2*pad)/(b-a),(mapC.height-2*pad)/(e-c));mapOff=[pad-a*mapScale+((mapC.width-2*pad)-(b-a)*mapScale)/2,pad-c*mapScale+((mapC.height-2*pad)-(e-c)*mapScale)/2];
  const path=(from,to)=>{const p=new Path2D();for(let i=from;i<=to;i++){const q=pts[wrap(i)];const u=q.x*mapScale+mapOff[0],v=q.z*mapScale+mapOff[1];i===from?p.moveTo(u,v):p.lineTo(u,v);}return p;};
  const L=M/SEG;segPaths=SEGZ.map((z,k)=>[z,path(Math.round(k*L),Math.round((k+1)*L))]);hzPaths=HAZ.map(h=>[h.t,path(h.a-1,h.b)]);}
const mp=(x,z)=>[x*mapScale+mapOff[0],z*mapScale+mapOff[1]];
function drawMap(){if(!M)return;const d=Math.min(window.devicePixelRatio||1,2);mctx.clearRect(0,0,mapC.width,mapC.height);mctx.lineJoin='round';mctx.lineCap='round';
  segPaths.forEach(([z,p])=>{mctx.strokeStyle=hex(ZONES[z].rail);mctx.globalAlpha=.7;mctx.lineWidth=4*d;mctx.stroke(p);});mctx.globalAlpha=1;
  hzPaths.forEach(([t,p])=>{mctx.strokeStyle=t===0?'#120b16':hex(PW[t].col);mctx.lineWidth=6*d;mctx.stroke(p);});
  for(const r of remotes.values()){const [u,v]=mp(r.cur.x,r.cur.z);mctx.fillStyle=r.css;mctx.beginPath();mctx.arc(u,v,3.6*d,0,7);mctx.fill();}
  if(ghost.visible){const [u,v]=mp(ghost.position.x,ghost.position.z);mctx.fillStyle='rgba(255,255,255,.7)';mctx.beginPath();mctx.arc(u,v,3.2*d,0,7);mctx.fill();}
  const [u,v]=mp(st.pos.x,st.pos.z);mctx.fillStyle='#fff';mctx.beginPath();mctx.arc(u,v,4.5*d,0,7);mctx.fill();mctx.strokeStyle='#120b16';mctx.lineWidth=1.5*d;mctx.stroke();}

/* ---------- Physics ---------- */
const ang=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function physics(dt,canDrive){
  const k=canDrive?(coarse?autoK():keys):{up:false,down:false,left:false,right:false,hb:false};
  if(st.boost>0)st.boost-=dt;
  const hz=st.air?-1:hzAt(st.idx);
  let max=MAXS*(st.onCurb?.8:1)*(st.boost>0?1.45:1)*(1-.2*st.dmg),gripMul=1,steerMul=1,yOff=0;
  // switched-on powers drain slowly, faster while they work
  for(let p=1;p<4;p++)if(st.on[p]){st.pw[p]-=(hz===p?[0,22,16,14][p]:3.5)*dt;if(st.pw[p]<=0){st.pw[p]=0;st.on[p]=false;flash(PW[p].name+' empty','','var('+PW[p].css+')');}}
  if(race&&race.state!=='run'){st.heat=st.sink=0;}
  else if(hz===1&&!st.on[1]){max=Math.min(max,12);st.heat+=dt/.9;st.shake=Math.max(st.shake,.2+st.heat*.4);if(st.heat>=1){wipeout('Tyres melted');return st.idx;}}else st.heat=Math.max(0,st.heat-dt*1.5);
  if(hz===2&&!st.on[2]){max=Math.min(max,8);st.sink+=dt/1.1;yOff=-.9*st.sink;if(st.sink>=1){wipeout('Sunk in the flood');return st.idx;}}else{st.sink=Math.max(0,st.sink-dt*2);if(hz===2){yOff=.42+Math.sin(now*4)*.06;max=Math.min(max,MAXS*.95);}}
  if(hz===1||hz===2){}
  else if(hz===3){if(!st.on[3]){gripMul=.1;steerMul=.45;if(inHzWarn!==3){inHzWarn=3;flash('No grip','Switch on ice studs · '+(coarse?'tap ICE':'press 4'),'var(--ice)');}}}
  else inHzWarn=-1;
  st.yOff+=(yOff-st.yOff)*Math.min(1,dt*5);
  const sp=st.speed;
  if(k.up&&sp>=-0.5)st.speed+=30*dt*(1-Math.max(0,sp)/(max*1.05));
  if(st.boost>0)st.speed+=36*dt;
  if(k.down){if(sp>0.5)st.speed-=58*dt;else st.speed=Math.max(-15,sp-16*dt);}
  if(!k.up&&!k.down)st.speed-=Math.sign(sp)*Math.min(Math.abs(sp),(hz===3&&!st.on[3]?1:6)*dt);
  if(k.hb)st.speed-=Math.sign(st.speed)*Math.min(Math.abs(st.speed),10*dt);
  st.speed-=st.speed*.05*dt;
  if(st.speed>max)st.speed-=(st.speed-max)*2.5*dt;
  const tgt=(k.left?1:0)-(k.right?1:0);st.steer+=(tgt-st.steer)*Math.min(1,dt*7);
  const a=Math.abs(st.speed),sf=Math.min(1,a/12);
  st.h+=st.steer*(k.hb?2.5:1.75)*steerMul*sf*(1-.42*Math.min(1,a/MAXS))*Math.sign(st.speed||1)*dt;
  if(st.dmg>.2&&!st.air)st.h+=st.pull*(st.dmg-.2)*.22*sf*dt;   // a bent car pulls to one side
  const grip=st.air?8:(k.hb?1.1:(6.5-2*Math.min(1,a/MAXS)))*gripMul;
  if(st.speed<0)st.vh=st.h;else st.vh+=ang(st.h,st.vh)*Math.min(1,grip*dt);
  st.pos.x+=Math.sin(st.vh)*st.speed*dt;st.pos.z+=Math.cos(st.vh)*st.speed*dt;
  let bd=1e12,bi=st.idx;for(let o=-45;o<=45;o++){const i=(st.idx+o+M)%M,dx=st.pos.x-pts[i].x,dz=st.pos.z-pts[i].z,d=dx*dx+dz*dz;if(d<bd){bd=d;bi=i;}}
  const prev=st.idx;st.idx=bi;const n=nrm[bi];
  let lat=(st.pos.x-pts[bi].x)*n.x+(st.pos.z-pts[bi].z)*n.z;const lim=EDGE-1.05;
  if(Math.abs(lat)>lim){const s=Math.sign(lat);st.pos.x-=n.x*(lat-s*lim);st.pos.z-=n.z*(lat-s*lim);lat=s*lim;
    if(!st.air){const along=Math.cos(st.h-head[bi])>=0?head[bi]:head[bi]+Math.PI;const hit=Math.abs(Math.sin(ang(st.vh,along)));
      const sev=hit*Math.min(1,Math.abs(st.speed)/40);st.speed*=Math.max(.35,1-hit*1.4-.03);st.h+=ang(along,st.h)*.55;st.vh=st.h;st.shake=Math.max(st.shake,.25+hit);if(hit>.15)emit(st.pos,2,6);
      if(sev>.12&&canDrive){addDamage(sev*.24);impact(Math.min(.3,sev*.5));}}}
  st.lat=lat;st.onCurb=!st.air&&Math.abs(lat)>W-1.1&&hz<0;
  if(!st.air&&canDrive)for(const [pi,off] of PADS){const di=((bi-pi)%M+M)%M;if(di<=5&&Math.abs(lat-off)<3.4&&st.boost<1.3){st.boost=1.8;st.shake=Math.max(st.shake,.35);flash('Boost','','');tone(220,880,.4,'sawtooth',.05);break;}}
  // flight: wings are a switch
  const roadY=(pts[bi].y+pts[(bi+1)%M].y)/2,rift=hzAt(bi)===0,wingsOut=st.on[0]&&st.pw[0]>0;
  if(st.on[0]&&st.pw[0]<=0){st.on[0]=false;st.pw[0]=0;flash('Wings empty','Folding','var(--wings)');}
  if(!st.air){if(rift||wingsOut){st.air=true;st.vy=wingsOut?9:0;}else st.pos.y=roadY+st.yOff;}
  if(st.air){
    let g=32;
    if(wingsOut){if(st.pos.y<roadY+8)st.vy+=40*dt;g=9;st.pw[0]-=18*dt;
      if(st.speed<38)st.speed+=(38-st.speed)*Math.min(1,dt*3)+8*dt;else if(st.speed<MAXS*1.1)st.speed+=12*dt;}
    st.vy-=g*dt;st.vy=Math.max(-30,Math.min(12,st.vy));st.pos.y+=st.vy*dt;
    if(!rift&&!wingsOut&&st.vy<=0&&st.pos.y<=roadY+st.yOff&&st.pos.y>roadY-1.8){st.pos.y=roadY+st.yOff;if(st.vy<-8)st.shake=Math.max(st.shake,.5);st.vy=0;st.air=false;}
    if(st.pos.y<GROUND-8){fell();return st.idx;}
  }
  return prev;
}
const FAILTIP=[['--wings','Collect the <b>gold rings</b>, then '+'%K0'+' as the rift warning appears.'],['--lava','Collect the <b>orange rings</b>, then '+'%K1'+' before you reach the lava.'],['--boat','Collect the <b>blue rings</b>, then '+'%K2'+' before the flood.'],['--ice','Collect the <b>ice-blue rings</b>, then '+'%K3'+' before the ice.']];
function failRace(why,t){
  if(!race||race.state!=='run')return;
  const w=$('wipe');w.classList.remove('on');void w.offsetWidth;w.classList.add('on');tone(300,60,.8,'sawtooth',.07);st.shake=.8;
  if(race.multi){placeOnGrid(race.lane);race.dist=race.lapsDone*M;flash(why,'Back to the start line','var(--hot)');return;}  // live room: others keep racing
  race.state='failed';race.failT=now;race.failWhy=why;race.failType=t;st.on=[false,false,false,false];slowMo=false;wwT=0;$('wrongWay').hidden=true;$('tutor').hidden=true;tutKey='';$('prompt').hidden=true;promptKey='';
  engine(false);
}
function showFail(){
  paused=true;document.body.classList.add('paused');tps.clear();msgTimer=0;$('msg').style.opacity=0;$('zoneBanner').classList.remove('show');bannerT=0;keys.left=keys.right=keys.down=keys.hb=false;
  const pct=Math.max(0,Math.min(99,Math.round(race.dist/(LAPS*M)*100)));
  $('failEyebrow').textContent=(race.gp?'Multiplayer · ':'')+'Level '+(race.li+1)+' · '+LEVELS[race.li].name;
  $('failTitle').textContent=race.failWhy;
  $('failNote').textContent='You made it '+pct+'% of the way'+(race.lapsDone?' and finished lap 1.':'.')+' Try again from the start line.';
  const t=race.failType;if(t>=0){const k=coarse?'<kbd>Swipe ↑</kbd>':'press <kbd>'+(t===0?'F':t+1)+'</kbd>';$('failTip').innerHTML='<i class="dot" style="--c:var('+FAILTIP[t][0]+')"></i><span>'+FAILTIP[t][1].replace('%K'+t,k)+'</span>';}else $('failTip').innerHTML='';
  show('scrFail');setTimeout(()=>{try{$('failRetry').focus();}catch(e){}},50);
}
function wipeout(why){failRace(why,why==='Tyres melted'?1:2);}
const AK={up:true,down:false,left:false,right:false,hb:false};/* auto-throttle on touch */function autoK(){AK.up=!keys.down;AK.down=keys.down;AK.left=keys.left;AK.right=keys.right;AK.hb=keys.hb;return AK;}
function addDamage(v){if(!race||race.state!=='run')return;st.dmg=Math.min(1,st.dmg+v);
  const stg=st.dmg>=.9?3:st.dmg>=.65?2:st.dmg>=.38?1:0;if(stg<=st.dmgStage)return;st.dmgStage=stg;const fw=car.userData.fw,rw=car.userData.rw;
  if(stg>=1)fw.forEach((m,i)=>{if(i%2)m.visible=false;});if(stg>=2)fw.forEach(m=>m.visible=false);if(stg>=3)rw.forEach(m=>m.visible=false);
  const f=car.userData.ch.localToWorld(new V3(0,.3,3));emit(f,2,16);emit(f,0,6);
  flash(['','Front wing damaged','Front wing gone','Rear wing gone'][stg],stg>=2?'The car is pulling to one side':'Avoid the walls','var(--hot)');}
function repairCar(){st.dmg=0;st.dmgStage=0;st.pull=Math.random()<.5?-1:1;car.userData.fw.forEach(m=>m.visible=true);car.userData.rw.forEach(m=>m.visible=true);}
function fell(){failRace('Lost to the rift',0);}

/* ---------- Race flow ---------- */
let ghostData=null,gPtr=0,rec=[],recT=0,wwT=0;
function turnAround(msg){const i=st.idx;st.pos.copy(P(i,clamp(st.lat,-(W-1.6),W-1.6),0));st.h=st.vh=head[i];st.speed=0;st.steer=0;st.air=false;st.vy=0;wwT=0;$('wrongWay').hidden=true;flash(msg||'Turned around','Race in the direction of the track','var(--accent)');}
function updWrongWay(dt){
  if(st.air){wwT=0;$('wrongWay').hidden=true;return;}
  const mv=st.speed>=0?st.vh:st.vh+Math.PI,along=Math.cos(mv-head[st.idx]),facing=Math.cos(st.h-head[st.idx]);
  if(Math.abs(st.speed)>2.5&&along<-.25)wwT+=dt;              // driving (or reversing) against the track
  else if(Math.abs(st.speed)<=2.5&&facing<-.5)wwT+=dt*.7;     // parked facing backwards
  else wwT=Math.max(0,wwT-dt*2.5);
  $('wrongWay').hidden=wwT<.45;if(wwT>=.45){$('msg').style.opacity=0;msgTimer=0;}
  if(wwT>2.4)turnAround();
}
function startRace(li,kind,raceId,lane){
  $('loading').hidden=false;
  setTimeout(()=>{
    if(!LV||LEVELS.indexOf(LV)!==li){buildLevel(li);sizeMap();lastZone=-1;}
    resetTokens();clearRemotes();clearAI();
    const multi=kind==='multi',gp=kind==='gp';
    race={li,multi,gp,kind,id:raceId||null,lane:lane||0,state:'count',countT:3.6,t0:0,lapsDone:0,lapStart:0,lapTimes:[],finish:null,dist:0};
    placeOnGrid(race.lane);
    if(gp){spawnAI(li);const g=gridSlot(5);st.idx=wrap(4+g.s);st.pos.copy(P(st.idx,g.lat,0));st.h=st.vh=head[st.idx];race.dist=g.s;}
    st.pw=[0,0,0,0];st.on=[false,false,false,false];repairCar();clearPodium();
    ghostData=null;if(kind==='single'){try{const g=JSON.parse(localStorage.getItem('gn.ghost.'+li)||'null');if(g&&g.length)ghostData=g;}catch(e){}}
    rec=[];recT=0;gPtr=0;warnedH=-1;inHzWarn=-1;slowMo=false;tutorT=-1;tutKey='';$('tutor').hidden=true;wwT=0;$('wrongWay').hidden=true;$('prompt').hidden=true;promptKey='';
    $('posChip').hidden=!(multi||gp);$('refLbl').textContent=kind==='single'?'Best':'Last lap';$('refTime').textContent=kind==='single'?fmt(prog.best[li]):'—';$('lapNum').textContent='1/'+LAPS;$('raceTime').textContent='0:00.000';
    mode='race';paused=false;document.body.classList.remove('paused');document.body.classList.add('racing');show('');sizeMap();if(document.activeElement)document.activeElement.blur();
    audioInit();engine(true);$('loading').hidden=true;
    if(multi)setP({s:'race',rr:race.id,f:null,lp:0,p:0});
  },30);
}
function lapLogic(prev){
  let d=st.idx-prev;if(d>M/2)d-=M;if(d<-M/2)d+=M;race.dist+=d;
  if(race.dist>=(race.lapsDone+1)*M){race.lapsDone++;const lt=now-race.lapStart;race.lapTimes.push(lt);race.lapStart=now;warnedH=-1;
    if(race.lapsDone>=LAPS){finishRace();}
    else{flash('Lap '+race.lapsDone+' · '+fmt(lt),'Final lap','var(--accent)');$('lapNum').textContent=(race.lapsDone+1)+'/'+LAPS;if(race.kind!=='single')$('refTime').textContent=fmt(lt);resetTokens();}}
}
function finishRace(){
  const t=now-race.t0;race.finish=t;race.state='done';race.doneT=now;st.on=[false,false,false,false];
  {const el=$('count');el.innerHTML='<span class="fin">Finish</span>';el.hidden=false;setTimeout(()=>{el.hidden=true;},1500);}for(let k=0;k<5;k++)setTimeout(()=>emit(st.pos,2,18),k*180);tone(523,1046,.5,'triangle',.07);
  if(race.multi){setP({s:'done',f:+t.toFixed(3)});showMultiResults();return;}
  if(race.gp){finishGP(t);return;}
  const li=race.li;let medal=null;for(let m=0;m<3;m++)if(t<=medals[m]){medal=m;break;}
  const prevBest=prog.best[li];const isBest=prevBest==null||t<prevBest;
  if(isBest){prog.best[li]=+t.toFixed(3);try{localStorage.setItem('gn.ghost.'+li,JSON.stringify(rec));}catch(e){}}
  if(medal!=null&&(prog.medal[li]==null||medal<prog.medal[li]))prog.medal[li]=medal;
  const unlockedNow=medal!=null&&li+1<LEVELS.length&&prog.unlocked<li+2;if(medal!=null)prog.unlocked=Math.max(prog.unlocked,Math.min(LEVELS.length,li+2));saveProg();
  setTimeout(()=>{
    document.body.classList.remove('racing');mode='menu';engine(false);
    $('resEyebrow').textContent='Level '+(li+1)+' · '+LEVELS[li].name;
    $('resTitle').innerHTML=medal!=null?'<span class="medalBig" style="color:'+MEDALC[medal]+'">'+MEDAL[medal]+' medal</span>':'No medal this time';
    $('resBody').innerHTML='<div class="times"><span>Your time</span><span><b>'+fmt(t)+'</b>'+(isBest?' · new best':'')+'</span>'+race.lapTimes.map((x,i)=>'<span>Lap '+(i+1)+'</span><span>'+fmt(x)+'</span>').join('')+
      '<span style="color:var(--gold)">Gold</span><span>'+fmt(medals[0])+'</span><span style="color:var(--silver)">Silver</span><span>'+fmt(medals[1])+'</span><span style="color:var(--bronze)">Bronze</span><span>'+fmt(medals[2])+'</span></div>'+
      (unlockedNow?'<p class="note" style="color:var(--good);margin-top:12px">Level '+(li+2)+' unlocked: '+LEVELS[li+1].name+'</p>':(medal==null?'<p class="note" style="margin-top:12px">Beat the bronze time to unlock the next level.</p>':''));
    const acts=[];if(medal!=null&&li+1<LEVELS.length)acts.push('<button class="primary" type="button" id="resNext">Next level</button>');
    acts.push('<button class="'+(acts.length?'ghostbtn':'primary')+'" type="button" id="resRetry">Retry</button>','<button class="ghostbtn" type="button" id="resLevels">Levels</button>','<button class="ghostbtn" type="button" id="resMenu">Main menu</button>');
    $('resActions').innerHTML=acts.join('');show('scrResults');$('resMenu').onclick=()=>show('scrTitle');
    if($('resNext'))$('resNext').onclick=()=>startRace(li+1,'single');
    $('resRetry').onclick=()=>startRace(li,'single');$('resLevels').onclick=()=>{lvlMode='single';show('scrLevels');};
  },1400);
  flash('Finished · '+fmt(t),medal!=null?MEDAL[medal]+' medal':'No medal','');if(medal!=null)race.confetti=true;
}
function finishGP(t){
  const sl=lapLen/M,li=race.li;
  for(const a of ais)if(a.finish==null)a.finish=t+(LAPS*M-a.s)*sl/Math.max(10,MAXS*a.skill*.8);
  const l=standings();const pos=l.findIndex(e=>e.me);
  const prevPos=prog.gp.pos[li];if(prevPos==null||pos<prevPos)prog.gp.pos[li]=pos;
  const podium=pos<3,unlockedNow=podium&&li+1<LEVELS.length&&prog.gp.unlocked<li+2;if(podium)prog.gp.unlocked=Math.max(prog.gp.unlocked,Math.min(LEVELS.length,li+2));saveProg();
  flash('Finished P'+(pos+1),podium?'Podium!':'Off the podium','');
  if(podium)celebrate(l);
  setTimeout(()=>{clearPodium();
    document.body.classList.remove('racing');mode='menu';engine(false);
    $('resEyebrow').textContent='Multiplayer · Level '+(li+1)+' · '+LEVELS[li].name;
    $('resTitle').innerHTML='<span class="medalBig" style="color:'+(podium?MEDALC[pos]:'var(--ink)')+'">'+(podium?POSN[pos]+' place':'P'+(pos+1)+' of 8')+'</span>';
    const win=l[0].f;
    $('resBody').innerHTML='<div class="results">'+l.map((e,k)=>'<div class="'+(e.me?'me':'')+'"><b>'+(k+1)+'</b><i style="background:'+e.css+'"></i><span class="rn"></span><span>'+(k?'+'+(e.f-win).toFixed(3):fmt(e.f))+'</span></div>').join('')+'</div>'+
      (unlockedNow?'<p class="note" style="color:var(--good);margin-top:12px">Level '+(li+2)+' unlocked: '+LEVELS[li+1].name+'</p>':(!podium?'<p class="note" style="margin-top:12px">Finish in the top 3 to unlock the next level.</p>':''));
    [...$('resBody').querySelectorAll('.rn')].forEach((el,k)=>el.textContent=l[k].n);
    const acts=[];if(podium&&li+1<LEVELS.length)acts.push('<button class="primary" type="button" id="resNext">Next level</button>');
    acts.push('<button class="'+(acts.length?'ghostbtn':'primary')+'" type="button" id="resRetry">Retry</button>','<button class="ghostbtn" type="button" id="resLevels">Levels</button>','<button class="ghostbtn" type="button" id="resMenu">Main menu</button>');
    $('resActions').innerHTML=acts.join('');show('scrResults');clearAI();$('resMenu').onclick=()=>show('scrTitle');
    if($('resNext'))$('resNext').onclick=()=>startRace(li+1,'gp');
    $('resRetry').onclick=()=>startRace(li,'gp');$('resLevels').onclick=()=>{lvlMode='gp';show('scrLevels');};
  },podium?4800:1600);
}
let podG=null;
function clearPodium(){document.body.classList.remove('celebrating');if(!podG)return;if(lvl)lvl.remove(podG);podG.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&!SHARED.has(o.material))o.material.dispose();});podG=null;}
function celebrate(l){
  clearPodium();race.state='celebrate';race.celT=now;document.body.classList.add('celebrating');const idx=wrap(4+18),Ls=[0,-4.6,4.6],Hs=[1.7,1.15,.75],cols=[0xffd36b,0xd8dde6,0xd99460];podG=new THREE.Group();
  for(let k=0;k<3;k++){const p=P(idx,Ls[k],0),b=new THREE.Mesh(new THREE.BoxGeometry(4,Hs[k],3.2),mats.side);b.position.set(p.x,p.y+Hs[k]/2,p.z);b.rotation.y=head[idx];podG.add(b);
    const t=new THREE.Mesh(new THREE.BoxGeometry(4.06,.1,3.26),basic(cols[k]));t.position.set(p.x,p.y+Hs[k]+.05,p.z);t.rotation.y=head[idx];podG.add(t);
    const e=l[k];if(!e)continue;if(e.me){st.pos.set(p.x,p.y+Hs[k]+.1,p.z);st.h=st.vh=head[idx]+Math.PI;st.speed=0;st.air=false;}
    else if(e.ai){e.ai.car.position.set(p.x,p.y+Hs[k]+.1,p.z);e.ai.car.rotation.y=head[idx]+Math.PI;e.ai.label.position.set(p.x,p.y+Hs[k]+2.8,p.z);e.ai.label.visible=true;e.ai.podium=true;}}
  for(const a of ais)if(!a.podium){a.car.visible=false;a.label.visible=false;}
  lvl.add(podG);race.podC=P(idx,0,1.6);tone(392,784,.6,'triangle',.07);setTimeout(()=>tone(523,1046,.8,'triangle',.07),350);
}
function ghostAt(t){if(!ghostData||!ghostData.length)return false;if(t>ghostData[ghostData.length-1][0])return false;
  if(gPtr>=ghostData.length||ghostData[gPtr][0]>t)gPtr=0;while(gPtr<ghostData.length-2&&ghostData[gPtr+1][0]<t)gPtr++;
  const a=ghostData[gPtr],b=ghostData[Math.min(gPtr+1,ghostData.length-1)];const f=b[0]>a[0]?clamp((t-a[0])/(b[0]-a[0]),0,1):0;
  ghost.position.set(a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f,a[3]+(b[3]-a[3])*f);ghost.rotation.y=a[4]+ang(b[4],a[4])*f;return true;}

/* ---------- Tokens update ---------- */
const carC=new V3();
function updTokens(dt){
  carC.copy(st.pos);carC.y+=.8;
  for(const t of tokens){
    if(t.got){if(t.k>0){t.k-=dt;const q=1-t.k/.35;t.g.scale.setScalar(1+q*.9);t.m.opacity=Math.max(0,1-q);if(t.k<=0)t.g.visible=false;}continue;}
    t.ring.rotation.z+=dt*1.2;t.core.rotation.y+=dt*3;
    t.g.position.set(t.home.x,t.home.y+Math.sin(now*3+t.home.x)*.15,t.home.z);
    // pickup only when the car actually passes through the ring (car's own frame: lateral, along, height)
    const dx=t.g.position.x-carC.x,dz=t.g.position.z-carC.z,dy=t.g.position.y-carC.y;
    const along=dx*Math.sin(st.h)+dz*Math.cos(st.h),lat=dx*Math.cos(st.h)-dz*Math.sin(st.h);
    if(mode==='race'&&race&&race.state==='run'&&Math.abs(lat)<1.6&&Math.abs(along)<2.4&&Math.abs(dy)<2){t.got=true;t.k=.35;st.pw[t.t]=Math.min(100,st.pw[t.t]+34);tone(660+t.t*110,1320+t.t*220,.25,'sine',.08);gainFx(t.t);emit(t.g.position,2,10);}
  }
}
const TRN=50,trailPos=new Float32Array(TRN*6).fill(-999),trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));
const trailMat=new THREE.PointsMaterial({size:.24,map:dotTex,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});const trail=new THREE.Points(trailGeo,trailMat);trail.frustumCulled=false;scene.add(trail);
const tipV=new V3();
function updTrail(){trailPos.copyWithin(6,0,(TRN-1)*6);const w=car.userData.wings;
  if(st.wingD>.6&&st.air){car.updateMatrixWorld(true);for(let k=0;k<2;k++){w[k].children[0].localToWorld(tipV.set(2.75,0,-.05));trailPos[k*3]=tipV.x;trailPos[k*3+1]=tipV.y;trailPos[k*3+2]=tipV.z;}}
  else for(let k=0;k<6;k++)trailPos[k]=k%3===1?-999:0;
  trailGeo.attributes.position.needsUpdate=true;}

/* ---------- Car visuals ---------- */
function poseCar(c,ud,s,dt,mine){
  ud.ch.rotation.z=-s.steer*Math.min(1,Math.abs(s.speed)/MAXS)*.07;
  ud.wheels.forEach((w,i)=>{w.rotation.x+=s.speed*dt/.4;if(i<2)w.rotation.y=s.steer*.4;});
  if(ud.wings)ud.wings.forEach(p=>{const d=s.wingD;p.scale.setScalar(Math.max(.001,d));p.rotation.z=p.userData.s*((1-d)*1.4+d*(.1+Math.sin(clock*(mine&&st.air?9:2.5))*(st.air?.18:.05)));});
  if(ud.floats){const f=s.fl;ud.floats.scale.setScalar(Math.max(.001,f));}
}
let lastTyre=null;
function placeCar(dt){
  car.position.copy(st.pos);car.rotation.y=st.h;const ud=car.userData;
  ud.ch.rotation.x=(keys.down&&st.speed>1?.035:0)-(keys.up&&mode==='race'?.02:0)-(st.air?st.vy*.012:0)+st.dmg*.03;
  st.wingD+=((st.on[0]&&st.pw[0]>0?1:0)-st.wingD)*Math.min(1,dt*7);
  st.fl+=((st.on[2]?1:0)-st.fl)*Math.min(1,dt*6);
  poseCar(car,ud,st,dt,true);
  const tyreM=st.on[1]?mats.lavaTyre:mats.tyre,rimM=st.on[3]?mats.iceRim:mats.rim;
  if(lastTyre!==tyreM+'|'+rimM){ud.wheels.forEach(w=>{w.children[0].material=tyreM;w.children[1].material=rimM;});lastTyre=tyreM+'|'+rimM;}
}

/* ---------- World blending ---------- */
const WZ=[0,0,0,0],cTmp=new THREE.Color(),sunDir=new V3(),lightDir=new V3();let lastZone=-1,envDirty=0,envZone=-1;
const mixC=(key,out)=>{out.setRGB(0,0,0);for(let k=0;k<4;k++){if(!WZ[k])continue;const c=ZC[k][key];out.r+=c.r*WZ[k];out.g+=c.g*WZ[k];out.b+=c.b*WZ[k];}return out;};
const mixN=key=>{let v=0;for(let k=0;k<4;k++)v+=ZONES[k][key]*WZ[k];return v;};
function worldUpdate(dt,idx,focus){
  zw(idx,WZ);
  mixC('top',skyU.top.value);mixC('hor',skyU.hor.value);mixC('sun',skyU.sunC.value);
  sunDir.set(0,0,0);for(let k=0;k<4;k++)sunDir.addScaledVector(ZC[k].sunDir,WZ[k]);sunDir.normalize();skyU.sunD.value.copy(sunDir);
  mixC('fog',scene.fog.color);scene.fog.near=mixN('near');scene.fog.far=mixN('far');
  mixC('hs',hemi.color);mixC('hg',hemi.groundColor);hemi.intensity=mixN('hi');
  mixC('sun',sunL.color);sunL.intensity=mixN('sunI');
  lightDir.copy(sunDir);lightDir.y=Math.max(lightDir.y,.45);lightDir.normalize();
  sunL.position.copy(focus).addScaledVector(lightDir,60);sunL.target.position.copy(focus);
  mixC('rail',mats.rail.color);mats.boost.color.copy(mats.rail.color).lerp(cTmp.setRGB(1,1,1),.35);
  starMat.opacity=mixN('stars');auroraU.uA.value=mixN('aurora');
  mixC('cloudC',cloudMat.color);cloudMat.opacity=mixN('clouds')*.85;
  mixC('spark',spMat.color);spMat.size=WZ[3]*.5+(1-WZ[3])*.3;
  if(bloom)bloom.strength=mixN('bloom');
  let dom=0;for(let k=1;k<4;k++)if(WZ[k]>WZ[dom])dom=k;
  if(dom!==lastZone){lastZone=dom;document.documentElement.style.setProperty('--accent',hex(ZONES[dom].rail));
    if(mode==='race'&&race&&race.state==='run'&&msgTimer<=0){$('zoneName').textContent=ZONES[dom].name;$('zoneSub').textContent=ZONES[dom].sub;$('zoneBanner').classList.add('show');bannerT=2.2;}}
  envDirty-=dt;if(envDirty<=0&&(WZ[dom]<.985||dom!==envZone)){refreshEnv();envDirty=.6;envZone=dom;}
}
function updSparkles(dt,focus){
  const up=mixN('up'),a=spGeo.attributes.position.array;
  for(let i=0;i<SPN;i++){const j=i*3;spPh[i]+=dt;spPos[j]+=Math.sin(spPh[i]*.7)*dt*.8;spPos[j+2]+=Math.cos(spPh[i]*.6)*dt*.8;spPos[j+1]+=up*dt*(up<0?4:1.2);
    let x=spPos[j],y=spPos[j+1],z=spPos[j+2];x=((x-focus.x+45)%90+90)%90-45+focus.x;z=((z-focus.z+45)%90+90)%90-45+focus.z;if(y<0)y+=26;if(y>26)y-=26;
    spPos[j]=x;spPos[j+1]=y;spPos[j+2]=z;a[j]=x;a[j+1]=focus.y-2+y;a[j+2]=z;}
  spGeo.attributes.position.needsUpdate=true;}
const lm4=new THREE.Matrix4(),lq=new THREE.Quaternion(),ls=new V3(1,1,1),lp=new V3(),Y=new V3(0,1,0);
function updAmbient(t){waterU.uTime.value=t;auroraU.uT.value=t;lavaTex.offset.y=-t*.25;lavaTex.offset.x=Math.sin(t*.3)*.05;
  for(const L of lanterns){L.list.forEach((l,k)=>{lp.set(l.p.x,l.p.y+Math.sin(t*1.2+l.ph)*.8,l.p.z);lq.setFromAxisAngle(Y,t+l.ph);lm4.compose(lp,lq,ls);L.im.setMatrixAt(k,lm4);});L.im.instanceMatrix.needsUpdate=true;}
  islands.forEach(s=>{s.g.position.y=s.y+Math.sin(t*.4+s.ph)*2;s.g.rotation.y=t*.03+s.ph;});}


/* ---------- Live rooms (multiplayer) ---------- */
const PCOL=[0xff5a36,0x4fe3ff,0xffd36b,0xb07bff,0x7be3a2,0xff7ad8,0xffffff,0x5a8bff];
let room=null,mroom=null,roomCode='',myName='',myColor=0,lobbyLvl=0,amHost=false,lastRaceSeen=null,roomState='idle',offPeers=null,boardT=0,resT=0;
const remotes=new Map();
$('createRoom').disabled=$('joinRoom').disabled=true;
async function initRoom(){
  if(roomState!=='idle')return;roomState='loading';$('multiNote').textContent='Connecting…';$('multiNote').classList.remove('err');
  try{if(window.claude&&window.claude.use)room=await window.claude.use('room');}catch(e){room=null;}
  if(!room){roomState='none';$('multiNote').textContent='Live rooms run on the claude.ai-hosted version of Reverush. Single player and Multiplayer work everywhere.';$('multiNote').classList.add('err');return;}
  roomState='ready';$('createRoom').disabled=$('joinRoom').disabled=false;$('multiNote').textContent='Friends need access to this page (share it from the Share menu) and must be signed in to claude.ai.';
}
const setP=patch=>{if(mroom)mroom.presence(patch).catch(()=>{});};
const CODECH='ABCDEFGHJKLMNPQRSTUVWXYZ';
$('createRoom').onclick=()=>{let c='';for(let i=0;i<4;i++)c+=CODECH[Math.floor(Math.random()*CODECH.length)];enterRoom(c,true);};
$('joinRoom').onclick=()=>{const c=$('codeIn').value.trim().toUpperCase().replace(/[^A-Z]/g,'');if(c.length!==4){$('multiNote').textContent='Room codes are 4 letters.';$('multiNote').classList.add('err');return;}enterRoom(c,false);};
$('codeIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinRoom').click();});
async function enterRoom(code,host){
  if(!room)return;myName=($('nameIn').value.trim()||'Driver').slice(0,14);prog.name=myName;saveProg();
  $('createRoom').disabled=$('joinRoom').disabled=true;$('multiNote').classList.remove('err');$('multiNote').textContent='Joining room '+code+'…';
  try{mroom=await room.join('gn-'+code.toLowerCase());}catch(e){$('createRoom').disabled=$('joinRoom').disabled=false;$('multiNote').classList.add('err');$('multiNote').textContent=e&&e.code==='limit_reached'?'Rooms are busy right now. Try again in a moment.':'Could not open the room. Check your connection and try again.';return;}
  roomCode=code;amHost=host;lastRaceSeen=null;$('roomCode').textContent=code;
  const used=new Set(mroom.peers().filter(p=>!p.sameTab&&p.presence).map(p=>p.presence.c));myColor=0;while(used.has(myColor)&&myColor<7)myColor++;
  setP({n:myName,c:myColor,h:host?1:0,s:'lobby',l:0,r:null,rr:null,f:null});
  repaint([0xf4f1ec,PCOL[myColor],0x18161c,0x2fd2c9]);
  offPeers=mroom.onPeers(onPeers,()=>{$('lobbyNote').textContent='Lost the room connection.';});
  $('createRoom').disabled=$('joinRoom').disabled=false;show('scrLobby');renderLobby();
}
$('leaveLobby').onclick=()=>{if(offPeers)offPeers();offPeers=null;if(mroom)mroom.leave().catch(()=>{});mroom=null;clearRemotes();repaint([0xf4f1ec,0xff5a36,0x18161c,0x2fd2c9]);show('scrMulti');};
const named=()=>mroom?mroom.peers().filter(p=>p.kind==='viewer'&&p.presence&&typeof p.presence.n==='string'):[];
function hostPeer(){const ps=named().slice().sort((a,b)=>a.peer<b.peer?-1:1);return ps.find(p=>p.presence.h===1)||ps[0]||null;}
function laneFor(){const ps=named().slice().sort((a,b)=>a.peer<b.peer?-1:1);const i=Math.max(0,ps.findIndex(p=>p.sameTab));return [0,-4,4,-2,2,-6,6,0][i%8];}
function onPeers(){
  const hp=hostPeer();const iAm=!!(hp&&hp.sameTab);if(iAm!==amHost){amHost=iAm;setP({h:iAm?1:0});}
  if(hp&&!hp.sameTab){const pr=hp.presence;lobbyLvl=+pr.l||0;
    if(pr.s==='race'&&pr.r&&pr.r!==lastRaceSeen&&screen==='scrLobby'&&mode!=='race'){lastRaceSeen=pr.r;startRace(clamp(lobbyLvl,0,LEVELS.length-1),'multi',pr.r,laneFor());}}
  if(screen==='scrLobby')renderLobby();
}
function renderLobby(){
  const ps=named();const hp=hostPeer();
  $('playerList').innerHTML=ps.map(p=>'<div class="player"><i style="background:'+hex(PCOL[(+p.presence.c||0)%8])+'"></i><span></span><small>'+(p===hp?'Host':'')+(p.sameTab?(p===hp?' · ':'')+'You':'')+(p.presence.s==='race'?' · Racing':'')+'</small></div>').join('')||'<p class="note">Connecting…</p>';
  [...$('playerList').querySelectorAll('.player span')].forEach((el,i)=>el.textContent=ps[i].presence.n);
  $('lvlPick').innerHTML=LEVELS.map((L,i)=>'<button type="button" data-l="'+i+'" aria-pressed="'+(i===lobbyLvl)+'"'+(!amHost||i>=prog.unlocked?' disabled':'')+' title="'+esc(L.name)+'">'+(i+1)+'</button>').join('');
  $('lvlPick').querySelectorAll('button:not([disabled])').forEach(b=>b.onclick=()=>{lobbyLvl=+b.dataset.l;setP({l:lobbyLvl});renderLobby();});
  $('pickLbl').textContent='Level '+(lobbyLvl+1)+' · '+LEVELS[lobbyLvl].name;
  $('startRace').hidden=!amHost;
  const racing=hp&&!hp.sameTab&&hp.presence.s==='race';
  $('lobbyNote').textContent=amHost?(ps.length<2?'Share the code '+roomCode+' with friends. You can also start alone.':'Pick a level you have unlocked, then start.'):(racing?'A race is under way. You will join the next one.':'Waiting for the host to start.');
}
$('startRace').onclick=()=>{if(!amHost)return;const id=Math.random().toString(36).slice(2,8);lastRaceSeen=id;setP({s:'race',r:id,l:lobbyLvl});startRace(lobbyLvl,'multi',id,laneFor());};
// merge a rival car's static body parts into one mesh per material (60 parts -> ~6), keeping wheels, wings and floats separate
function lightCar(c){const ch=c.userData.ch;const keep=new Set([...(c.userData.wings||[]),c.userData.floats].filter(Boolean));const byMat=new Map();
  ch.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(ch.matrixWorld).invert();
  for(const o of [...ch.children]){if(!o.isMesh||keep.has(o))continue;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));
    for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);if(!g.attributes.normal)g.computeVertexNormals();
    if(!byMat.has(o.material))byMat.set(o.material,[]);byMat.get(o.material).push(g);ch.remove(o);if(!SHAREDG.has(o.geometry))o.geometry.dispose();}
  for(const [m,gs] of byMat){let n=0;for(const g of gs)n+=g.attributes.position.array.length;const pos=new Float32Array(n),nor=new Float32Array(n);let o=0;
    for(const g of gs){pos.set(g.attributes.position.array,o);nor.set(g.attributes.normal.array,o);o+=g.attributes.position.array.length;g.dispose();}
    const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(pos,3));mg.setAttribute('normal',new THREE.BufferAttribute(nor,3));ch.add(new THREE.Mesh(mg,m));}
  return c;}
function remoteMats(col){return{body:std(col,.4,.24,{side:THREE.DoubleSide}),livery:std(0xf4f1ec,.4,.24,{side:THREE.DoubleSide}),carbon:mats.carbon,glass:mats.glass,helmet:mats.helmet,tyre:mats.tyre,rim:mats.rim,compound:mats.compound,tail:mats.tail,wingM:mats.wingM,float:mats.float,pin:mats.pin};}
function nameSprite(text,col){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='600 34px "Barlow Condensed", "Arial Narrow", sans-serif';x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='rgba(14,9,20,.7)';const w=Math.min(250,x.measureText(text).width+28);x.fillRect(128-w/2,8,w,48);x.fillStyle=col;x.fillRect(128-w/2,8,4,48);x.fillStyle='#fff8ee';x.fillText(text,128,33);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,fog:false}));sp.scale.set(4,1,1);return sp;}
function disposeCar(c,label){scene.remove(c);c.traverse(o=>{if(o.geometry&&!SHAREDG.has(o.geometry))o.geometry.dispose();if(o.material&&!SHARED.has(o.material))o.material.dispose();});if(label){scene.remove(label);label.material.map.dispose();label.material.dispose();}}
function clearRemotes(){for(const r of remotes.values())disposeCar(r.car,r.label);remotes.clear();}
function updRemotes(dt){
  if(!mroom||!race||!race.multi){if(remotes.size)clearRemotes();return;}
  const seen=new Set();
  for(const p of named()){if(p.sameTab||p.presence.rr!==race.id||typeof p.presence.x!=='number')continue;seen.add(p.peer);
    let r=remotes.get(p.peer);const pr=p.presence;
    if(!r){const col=PCOL[(+pr.c||0)%8];const c=lightCar(buildCar(remoteMats(col),true));const label=nameSprite(String(pr.n).slice(0,14),hex(col));scene.add(label);
      r={car:c,label,css:hex(col),cur:{x:pr.x,y:pr.y,z:pr.z,a:pr.a},s:{steer:0,speed:30,wingD:0,fl:0}};remotes.set(p.peer,r);}
    const k=Math.min(1,dt*10);r.cur.x+=(pr.x-r.cur.x)*k;r.cur.y+=((+pr.y||0)-r.cur.y)*k;r.cur.z+=(pr.z-r.cur.z)*k;r.cur.a+=ang(+pr.a||0,r.cur.a)*k;
    r.s.wingD+=((+pr.w||0)-r.s.wingD)*k;r.s.fl+=((+pr.fl||0)-r.s.fl)*k;r.s.speed=pr.f?0:40;
    r.car.position.set(r.cur.x,r.cur.y,r.cur.z);r.car.rotation.y=r.cur.a;poseCar(r.car,r.car.userData,r.s,dt,false);
    r.label.position.set(r.cur.x,r.cur.y+2.6,r.cur.z);{const d2=camera.position.distanceToSquared(r.car.position);r.label.visible=d2>16*16;}}
  for(const [peer,r] of remotes)if(!seen.has(peer)){disposeCar(r.car,r.label);remotes.delete(peer);}
}
const myProgress=()=>Math.round(race.dist);
function standings(){
  if(race.gp){const l=[{me:true,n:'You',css:'#fff8ee',f:race.finish,p:race.finish?1e9:race.dist,sp:st.speed}];for(const a of ais)l.push({me:false,n:(a.nem?'★ ':'')+a.name,css:a.css,f:a.finish,p:a.s,sp:a.speed,ai:a});
    l.sort((a,b)=>(a.f!=null&&b.f!=null)?a.f-b.f:(a.f!=null?-1:b.f!=null?1:b.p-a.p));return l;}
  const list=[{me:true,n:myName,css:hex(PCOL[myColor%8]),f:race.finish,p:race.finish?1e9:myProgress()}];
  for(const p of named()){if(p.sameTab||p.presence.rr!==race.id)continue;list.push({me:false,n:String(p.presence.n),css:hex(PCOL[(+p.presence.c||0)%8]),f:typeof p.presence.f==='number'?p.presence.f:null,p:+p.presence.p||0});}
  list.sort((a,b)=>(a.f!=null&&b.f!=null)?a.f-b.f:(a.f!=null?-1:b.f!=null?1:b.p-a.p));return list;
}
function updBoard(){const l=standings();const i=l.findIndex(e=>e.me);$('posVal').innerHTML=(i+1)+'<small>/'+l.length+'</small>';
  const sl=lapLen/M;$('posGap').textContent=i>0&&!race.finish&&l[i-1].f==null?'+'+((l[i-1].p-l[i].p)*sl/Math.max(15,st.speed)).toFixed(1)+'s to P'+i:(i===0?'Leading':'');
  $('board').innerHTML=l.slice(0,coarse?3:8).map((e,k)=>'<div class="'+(e.me?'me':'')+'"><span>'+(k+1)+'</span><i style="background:'+e.css+'"></i><span class="bn"></span></div>').join('');
  [...$('board').querySelectorAll('.bn')].forEach((el,k)=>el.textContent=l[k].n);}
function showMultiResults(){setTimeout(()=>{document.body.classList.remove('racing');mode='menu';engine(false);
  $('resEyebrow').textContent='Room '+roomCode+' · Level '+(race.li+1)+' · '+LEVELS[race.li].name;$('resTitle').textContent='Race results';
  $('resActions').innerHTML='<button class="primary" type="button" id="resLobby">Back to lobby</button>';
  $('resLobby').onclick=()=>{setP({s:'lobby',rr:null,f:null});clearRemotes();race=null;show('scrLobby');renderLobby();const hp=hostPeer();if(hp&&!hp.sameTab&&hp.presence.s==='race'&&hp.presence.r!==lastRaceSeen)onPeers();};
  renderResults();show('scrResults');},1400);}
function renderResults(){if(!race)return;const l=standings();
  $('resBody').innerHTML='<div class="results">'+l.map((e,k)=>'<div class="'+(e.me?'me':'')+'"><b>'+(k+1)+'</b><i style="background:'+e.css+'"></i><span class="rn"></span><span>'+(e.f!=null?fmt(e.f):'Racing…')+'</span></div>').join('')+'</div>';
  [...$('resBody').querySelectorAll('.rn')].forEach((el,k)=>el.textContent=l[k].n+(l[k].me?' (you)':''));}



/* ---------- AI rivals (Multiplayer mode) ---------- */
const AIN=['Vega','Okafor','Lindqvist','Tanaka','Moreau','Reyes','Kowalski'],AIC=[0x4fe3ff,0xffd36b,0xb07bff,0x7be3a2,0xff7ad8,0x5a8bff,0xc9ccd6];
let ais=[];
const gridSlot=k=>{const row=k>>1,col=k&1;return{s:-5-row*8-col*4,lat:col?-3.6:3.6};};
function clearAI(){for(const a of ais)disposeCar(a.car,a.label);ais=[];}
function spawnAI(li){clearAI();const base=.64+li*.052,err=Math.max(.03,.32-li*.04);const r=mkRnd(li*7+3);const slots=[0,1,2,3,4,6,7];const nem=li%7;
  for(let k=0;k<7;k++){const col=AIC[k],car=lightCar(buildCar(remoteMats(col),true)),label=nameSprite((k===nem?'★ ':'')+AIN[k],hex(col));scene.add(label);const g=gridSlot(slots[k]);
    ais.push({name:AIN[k],col,css:hex(col),car,label,s:g.s,lat:g.lat,tlat:g.lat,plat:g.lat,speed:0,skill:base*(.95+r()*.09),err,finish:null,y:0,vy:0,wingD:0,fl:0,hz:-2,fail:false,heat:0,sink:0,falling:false,tyre:null,nem:k===nem,def:clamp((li-.5)*.08,0,.55)*(.8+r()*.4)+(k===nem?.15:0),atk:0,prevRel:undefined});
    if(k===nem){const a=ais[ais.length-1];a.skill*=1.04;a.err*=.5;}}}
let tauntT=-9;function taunt(a,b){if(now-tauntT<4)return;tauntT=now;flash(a,b||'','var(--hot)');}
function aiWipe(a){a.s=Math.max(0,Math.floor(a.s/M))*M;a.lat=0;a.tlat=0;a.speed=0;a.vy=0;a.falling=false;a.fail=false;a.heat=0;a.sink=0;a.hz=-2;a.wingD=0;}
const aiS={steer:0,speed:0,wingD:0,fl:0};
function updAI(dt,running){
  const sl=lapLen/M;
  for(const a of ais){
    let i=wrap(4+Math.floor(a.s));const hz=hzAt(i);
    if(running&&a.finish==null){
      const c1=Math.abs(ang(head[wrap(i+18)],head[i])),c2=Math.abs(ang(head[wrap(i+42)],head[wrap(i+12)]));
      let tv=MAXS*a.skill*(1-clamp(c1*.8+c2*.5,0,.5));
      if(hz!==a.hz){a.hz=hz;a.fail=hz>=0&&rnd()<a.err;}
      if(hz===1&&a.fail){tv=12;a.heat+=dt/.9;emit(a.car.position,1,1);if(a.heat>=1){aiWipe(a);continue;}}else a.heat=0;
      if(hz===2&&a.fail){tv=8;a.sink+=dt/1.1;if(a.sink>=1){aiWipe(a);continue;}}else a.sink=0;
      if(hz===3&&a.fail)tv*=.62;
      let tl=clamp(ang(head[wrap(i+25)],head[i])*14,-5,5);
      for(const o of racers()){if(o===a)continue;const ds=(o.s-a.s)*sl,dl=o.lat-a.lat;
        if(ds>0&&ds<15&&Math.abs(dl)<2.8&&o.speed<a.speed+2){tl=o.lat+(a.lat>=o.lat?3.6:-3.6);if(Math.abs(tl)>6.3){tl=clamp(tl,-6.3,6.3);if(ds<7)tv=Math.min(tv,o.speed);}}}
      if(race&&race.gp&&race.state==='run'){const rel=(meR.s-a.s)*sl;
        if(rel<-3&&rel>-24&&hz<0&&!st.air)tl+=(clamp(meR.lat,-6,6)-tl)*a.def;                  // defend: cover the player's line
        if(a.prevRel!==undefined){if(a.prevRel<0&&rel>=0&&rel<30){a.atk=2+a.def*3;if(a.nem)taunt(a.name+' is fighting back');}
          else if(a.prevRel>0&&rel<=0&&rel>-30&&a.nem)taunt(a.name+' passed you','Your rival');}
        a.prevRel=rel;
        if(rel>140)tv*=1.05;else if(rel<-170)tv*=.95;                                      // keep the pack close
      }
      if(a.atk>0){a.atk-=dt;tv*=1.05+a.def*.08;}
      a.tlat=tl;
      a.speed+=clamp(tv-a.speed,-45*dt,(a.speed<20?26:17)*dt);
    }else if(running)a.speed=Math.max(0,a.speed-14*dt);
    a.plat=a.lat;a.lat+=clamp(a.tlat-a.lat,-4.5*dt,4.5*dt);
    if(running)a.s+=a.speed*dt/sl;
    if(running&&a.finish==null&&a.s>=LAPS*M)a.finish=now-race.t0;
    i=wrap(4+Math.floor(a.s));
    const f=a.s-Math.floor(a.s),j=wrap(i+1),roadY=pts[i].y*(1-f)+pts[j].y*f;
    // rifts: wings out and fly, unless this driver blew it
    let fly=false,into=-1,len=0;for(const h of HAZ){if(h.t!==0)continue;const d=((i-h.a+14)%M+M)%M;if(d<h.b-h.a+20){into=d;len=h.b-h.a+20;}}
    if(into>=0&&!(a.fail&&hzAt(i)===0)&&!a.falling){fly=true;a.y=roadY+Math.sin(clamp(into/len,0,1)*Math.PI)*5.5;}
    else if(hzAt(i)===0&&a.fail){a.falling=true;}
    if(a.falling){a.vy-=32*dt;a.y+=a.vy*dt;if(a.y<GROUND-8){aiWipe(a);continue;}}
    else if(!fly)a.y=roadY+(hz===2?(a.fail?-.9*a.sink:.42):0);
    a.wingD+=((fly?1:0)-a.wingD)*Math.min(1,dt*7);a.fl+=((hz===2&&!a.fail?1:0)-a.fl)*Math.min(1,dt*6);
    // pose
    const p0=P(i,a.lat,0),p1=P(j,a.lat,0);p0.lerp(p1,f);
    const latV=(a.lat-a.plat)/Math.max(dt,1e-3);const h=head[i]+Math.atan2(latV,Math.max(a.speed,4));
    a.car.position.set(p0.x,a.y,p0.z);a.car.rotation.y=h;
    aiS.steer=clamp(latV*.25,-1,1);aiS.speed=a.speed;aiS.wingD=a.wingD;aiS.fl=a.fl;poseCar(a.car,a.car.userData,aiS,dt,false);
    const tyre=(hz===1&&!a.fail)?mats.lavaTyre:mats.tyre,rim=(hz===3&&!a.fail)?mats.iceRim:mats.rim;
    if(a.tyre!==tyre||a.rim!==rim){a.tyre=tyre;a.rim=rim;a.car.userData.wheels.forEach(w=>{w.children[0].material=tyre;w.children[1].material=rim;});}
    a.label.position.set(p0.x,a.y+2.6,p0.z);{const d2=camera.position.distanceToSquared(a.car.position);a.label.visible=d2<90*90&&d2>16*16;}
  }
}
// everyone on track in race-distance terms
const meR={s:0,lat:0,speed:0,me:true};
function racers(){meR.s=race?race.dist:0;meR.lat=st.lat;meR.speed=st.speed;return ais.length?[meR,...ais]:[meR];}
function collide(){
  if(!ais.length||!race)return;const sl=lapLen/M;const list=racers();
  for(let x=0;x<list.length;x++)for(let y=x+1;y<list.length;y++){const a=list[x],b=list[y];
    if((a.me&&st.air)||(b.me&&st.air)||(a.y!==undefined&&a.wingD>.5)||(b.y!==undefined&&b.wingD>.5))continue;
    const ds=(b.s-a.s)*sl,dl=b.lat-a.lat;if(Math.abs(ds)>4.6||Math.abs(dl)>2.3)continue;
    const push=(2.3-Math.abs(dl))*.5*(dl>=0?1:-1);
    const rear=ds>0?a:b,front=ds>0?b:a;
    for(const [o,sg] of [[a,-1],[b,1]]){if(o.me){st.pos.addScaledVector(nrm[st.idx],push*sg);st.shake=Math.max(st.shake,.3);}else o.lat+=push*sg;}
    if(Math.abs(dl)<1.6){if(rear.me){st.speed=Math.min(st.speed,front.speed*.97);}else rear.speed=Math.min(rear.speed,front.speed*.97);}
    if(a.me||b.me){if(Math.random()<.5)emit(st.pos,2,3);if(now-st.hitT>.5){st.hitT=now;impact(.12);addDamage(.025);}}
  }
}

/* ---------- Smoke and sparks ---------- */
const PN=420,pPos=new Float32Array(PN*3).fill(-999),pVel=new Float32Array(PN*3),pLife=new Float32Array(PN),pCol=new Float32Array(PN*3);let pNext=0;
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const pMat=new THREE.PointsMaterial({size:.9,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,opacity:.75});
const parts=new THREE.Points(pGeo,pMat);parts.frustumCulled=false;scene.add(parts);
const PCOLS=[[.75,.72,.7],[1,.45,.15],[1,.85,.4]],CONF=[[1,.35,.21],[1,.83,.42],[.31,.89,1],[.48,.89,.64],[1,.48,.85],[1,1,1]],pKind=new Uint8Array(PN);
function emit(at,kind,n){for(let k=0;k<(n||1);k++){const i=pNext++%PN,j=i*3;pPos[j]=at.x+(Math.random()-.5)*1.6;pPos[j+1]=at.y+.3;pPos[j+2]=at.z+(Math.random()-.5)*1.6;
  pKind[i]=kind;const sp=kind===2?6:kind===3?4:1;pVel[j]=(Math.random()-.5)*sp;pVel[j+1]=kind===2?2+Math.random()*3:kind===3?Math.random()*2:.8+Math.random();pVel[j+2]=(Math.random()-.5)*sp;pLife[i]=kind===2?.35:kind===3?3:1.1;const c=kind===3?CONF[Math.random()*CONF.length|0]:PCOLS[kind];pCol[j]=c[0];pCol[j+1]=c[1];pCol[j+2]=c[2];}}
function updParts(dt){for(let i=0;i<PN;i++){if(pLife[i]<=0)continue;const j=i*3;pLife[i]-=dt;if(pLife[i]<=0){pPos[j+1]=-999;continue;}
  pPos[j]+=pVel[j]*dt;pPos[j+1]+=pVel[j+1]*dt;pPos[j+2]+=pVel[j+2]*dt;if(pKind[i]===3){pVel[j+1]-=1.6*dt;pVel[j]+=Math.sin(pLife[i]*9+i)*dt*2;continue;}pVel[j+1]+=(pCol[j+2]>.5&&pCol[j]<.8?.4:-6)*dt*.2;pCol[j]*=.985;pCol[j+1]*=.985;pCol[j+2]*=.985;}
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.color.needsUpdate=true;}

/* ---------- Loop ---------- */
const camPos=new V3(),camLook=new V3(),cinePos=new V3(),cineLook=new V3();let last=performance.now(),clock=0;
const baseFov=()=>camera.aspect<1?Math.min(92,62+(1-camera.aspect)*48):62;
let perfT=0,perfN=0,perfStep=0;
function perfGuard(dt){perfT+=dt;perfN++;if(perfT<3)return;const fps=perfN/perfT;perfT=0;perfN=0;
  if(fps>=42||perfStep>=3)return;perfStep++;
  if(perfStep===1){if(composer){composer=null;}else perfStep++;}
  if(perfStep===2){renderer.shadowMap.enabled=false;sunL.castShadow=false;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}
  if(perfStep===3){renderer.setPixelRatio(1);resize();}}
function render(){if(composer)composer.render();else renderer.render(scene,camera);}
const ACT=['activate wings','switch on lava tyres','switch on the boat','switch on ice studs'];
let hudDmg=-1,tutC='--accent',promptKey='',tutKey='',tutorT=-1,slowMo=false;
const TUTX=['to spread your wings and fly over the gap. '+(coarse?'Swipe up':'Press F')+' again after you land to fold them.','to switch on lava tyres before you hit the lava.','to switch on the boat before the flood.','to switch on ice studs for grip on the ice.'],TUTC=['gold','orange','blue','ice-blue'];
function updPrompt(){
  let best=null,bd=1e9,inside=null;
  for(const h of HAZ){const d=((h.a-st.idx)%M+M)%M,len=h.b-h.a;if(d<=M-len-1&&d<bd&&d<230){bd=d;best=h;}const into=((st.idx-h.a)%M+M)%M;if(into<len)inside=h;}
  const el=$('prompt');let html='',cls='';
  if(inside&&inside.t!==0){const p=PW[inside.t];
    if(st.on[inside.t])html='<span class="ph" style="color:var('+p.css+')">'+p.name+' on</span><span class="pa">'+Math.round(st.pw[inside.t])+'% left</span>';
    else{const danger=inside.t===1?st.heat:inside.t===2?st.sink:0;cls='bad';
      html='<span class="ph">'+(inside.t===1?'Tyres melting':inside.t===2?'Sinking':'No grip')+'</span>'+(danger?'<span class="pbar"><b style="width:'+Math.round(danger*100)+'%"></b></span>':'')+
        (st.pw[inside.t]>0?'<span class="pa">'+keycap(inside.t)+' '+ACT[inside.t]+'</span>':'<span class="pa">No '+p.name.toLowerCase()+' charge</span>');}}
  else if(best&&bd<230){const p=PW[best.t],m=Math.max(0,Math.round(bd*2.9/10)*10);
    html='<span class="ph" style="color:var('+p.css+')">'+p.hz+' in '+m+' m</span>';
    if(st.on[best.t])html+='<span class="pa">'+p.name+' on · '+Math.round(st.pw[best.t])+'%</span>';
    else if(st.pw[best.t]>0){html+='<span class="pa">'+keycap(best.t)+' '+ACT[best.t]+'</span>';cls=bd<90?'urgent':'';}
    else{html+='<span class="pa">Collect '+p.name.toLowerCase()+' tokens</span>';cls='bad';}}
  else if(st.on[0]&&st.air){html='<span class="ph" style="color:var(--wings)">Flying · '+Math.round(st.pw[0])+'%</span><span class="pa">'+keycap(0)+' fold wings</span>';}
  // big tutorial callout: early levels, and the first time you meet each hazard
  let tut='',tk=-1,slow=false;
  if(best&&!inside&&race&&race.state==='run'){const t=best.t,p=PW[t];
    if((race.li<=2||!prog.seen[t])&&!st.on[t]){
      if(st.pw[t]>0&&bd<120){tk=t;slow=bd<95;
        tut='<i class="ic"></i><span class="tw">'+p.hz+'</span><span class="tk">'+(coarse?'<kbd>Swipe ↑</kbd>':'<kbd>'+(t===0?'F':t+1)+'</kbd>')+p.name+'</span>';tutC=p.css;}
      else if(st.pw[t]<=0&&bd<220){tut='<i class="ic"></i><span class="tw">'+p.hz+'</span><span class="tk">Grab the <b>'+TUTC[t]+' rings</b></span>';tutC=p.css;}}}
  if(inside)for(const h of HAZ){const into=((st.idx-h.a)%M+M)%M;if(into>h.b-h.a-3&&into<h.b-h.a&&!prog.seen[h.t]){prog.seen[h.t]=1;saveProg();}}
  tutorT=tk;slowMo=slow;
  if(tut!==tutKey){tutKey=tut;$('tutor').innerHTML=tut;$('tutor').hidden=!tut;if(tut)$('tutor').style.setProperty('--c','var('+tutC+')');if(tut){$('zoneBanner').classList.remove('show');bannerT=0;}}
  if(tut)html='';
  const key=html+cls;if(key!==promptKey){promptKey=key;el.innerHTML=html;el.className=cls;el.hidden=!html;}
}
const keycap=t=>coarse?'<kbd>Swipe ↑</kbd>':'<kbd>'+(t===0?'F':t+1)+'</kbd>';
function hudPowers(){for(let k=0;k<4;k++){const b=pwEls[k];b.querySelector('.m b').style.width=st.pw[k]+'%';b.lastElementChild.textContent=st.on[k]?'ON':Math.round(st.pw[k])+'%';b.classList.toggle('has',st.pw[k]>0);b.classList.toggle('live',st.on[k]);}
  if(coarse)document.querySelectorAll('.tpw').forEach((b,k)=>{b.style.setProperty('--f',st.pw[k]+'%');b.classList.toggle('on',st.on[k]);b.classList.toggle('empty',st.pw[k]<=0);});}
function frame(t){
  requestAnimationFrame(frame);
  let dt=Math.min(.05,(t-last)/1000);last=t;perfGuard(dt);if(slowMo&&mode==='race'&&race&&!race.multi&&!paused)dt*=.55;clock+=dt;
  sky.position.copy(camera.position);skyGroup.position.copy(camera.position);
  if(!M){render();return;}
  updAmbient(clock);
  if(mode!=='race'){
    // menu fly-through along the track, passing through every world
    camT=(camT+dt*26)%M;const i=Math.floor(camT);
    cinePos.copy(P(i,Math.sin(clock*.13)*6,6.5+Math.sin(clock*.21)*2.5));cineLook.copy(P(i+38,Math.sin(clock*.1)*3,2));
    if(camPos.distanceTo(cinePos)>60){camPos.copy(cinePos);camLook.copy(cineLook);}else{camPos.lerp(cinePos,1-Math.exp(-dt*2.5));camLook.lerp(cineLook,1-Math.exp(-dt*2.5));}
    camera.position.copy(camPos);camera.lookAt(camLook);if(Math.abs(camera.fov-baseFov()+2)>.1){camera.fov=baseFov()-2;camera.updateProjectionMatrix();}
    worldUpdate(dt,i,camPos);updSparkles(dt,camPos);placeCar(dt);updTokens(dt);updRemotes(dt);updParts(dt);
    if(screen==='scrResults'&&race&&race.multi){resT-=dt;if(resT<=0){resT=.5;renderResults();}}
    if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)$('msg').style.opacity=0;}
    render();return;
  }
  const canDrive=!paused;
  if(paused&&!race.multi){render();return;}
  now+=dt;
  if(race.state==='count'){
    race.countT-=dt;const n=Math.ceil(race.countT);const el=$('count');el.hidden=false;
    if(race.countT>0){const m=Math.min(3,n);el.innerHTML='<div class="lights">'+[0,1,2].map(i=>'<i class="'+(i<4-m?'on':'')+'"></i>').join('')+'</div>'+m;}
    else{el.innerHTML='<div class="lights go"><i></i><i></i><i></i></div><span class="go">GO</span>';race.state='run';setLamps(0);if(race.gp){const nm=ais.find(a=>a.nem);if(nm)setTimeout(()=>{if(race&&race.state==='run')flash('Your rival: '+nm.name,'Beat them to the line','var(--accent)');},1800);}race.t0=now;race.lapStart=now;gPtr=0;
      $('zoneName').textContent=ZONES[SEGZ[0]].name;$('zoneSub').textContent='Level '+(race.li+1)+' · '+LEVELS[race.li].name;$('zoneBanner').classList.add('show');bannerT=2.2;setTimeout(()=>{$('count').hidden=true;},900);}
    physics(dt,false);updAI(dt,false);setLamps(race.countT);if(coarse&&$('coach').hidden)$('coach').hidden=false;
  }else if(race.state==='run'){
    const prev=physics(dt,canDrive);if(race.state==='run')lapLogic(prev);if(race.gp&&race.state==='run'){updAI(dt,true);collide();}
    if(race.state==='run'){
      updWrongWay(dt);
      const rt=now-race.t0;$('raceTime').textContent=fmt(rt);
      recT+=dt;if(recT>.1){recT=0;rec.push([+rt.toFixed(2),+st.pos.x.toFixed(1),+st.pos.y.toFixed(1),+st.pos.z.toFixed(1),+st.h.toFixed(2)]);}
      ghost.visible=!race.multi&&ghostAt(rt);
      updPrompt();
    }
  }else if(race.state==='celebrate'){ghost.visible=false;st.speed=0;$('wrongWay').hidden=true;$('prompt').hidden=true;promptKey='';const c0=race.podC;if(Math.random()<.7)emit(new V3(c0.x+(Math.random()-.5)*16,c0.y+9,c0.z+(Math.random()-.5)*16),3,2);}
  else if(race.state==='failed'){ghost.visible=false;st.speed*=Math.exp(-dt*3);if(!paused&&now-race.failT>.9)showFail();}
  else{physics(dt,false);ghost.visible=false;slowMo=false;if(race.confetti&&Math.random()<.6)emit(new V3(st.pos.x+(Math.random()-.5)*10,st.pos.y+8,st.pos.z+(Math.random()-.5)*10),3,2);$('wrongWay').hidden=true;if(!$('tutor').hidden){$('tutor').hidden=true;tutKey='';}$('prompt').hidden=true;promptKey='';if(race.gp)updAI(dt,true);}
  if(race.state==='run'&&lampsOn&&now-race.t0>1.2){setLamps(-1);}
  if(!$('coach').hidden&&race.state!=='count'&&(now-race.t0>.6||tps.size||race.state!=='run'))$('coach').hidden=true;
  placeCar(dt);updTokens(dt);updTrail();updRemotes(dt);updParts(dt);
  {const slip=Math.abs(ang(st.h,st.vh));if(!st.air&&st.speed>14&&(slip>.22||(keys.down&&st.speed>28)))emit(st.pos,0,1);if(hzAt(st.idx)===1&&!st.on[1]&&!st.air)emit(st.pos,1,2);}
  worldUpdate(dt,st.idx,st.pos);updSparkles(dt,st.pos);
  // camera
  const fwd=new V3(Math.sin(st.h),0,Math.cos(st.h));const c=st.pos;let want,look,lerp;
  if(race.state==='celebrate'){const a=(now-race.celT)*.5,c0=race.podC;want=new V3(c0.x+Math.sin(a+head[st.idx])*14,c0.y+4.5,c0.z+Math.cos(a+head[st.idx])*14);look=c0.clone();lerp=2.5;}
  else if(race.state==='done'&&!race.multi){const a=(now-race.doneT)*.9+st.h+Math.PI;want=new V3(c.x+Math.sin(a)*7,c.y+2.4,c.z+Math.cos(a)*7);look=c.clone();look.y+=.6;lerp=3;}
  else if(camMode===0){want=c.clone().addScaledVector(fwd,-7.2);want.y+=2.2;look=c.clone().addScaledVector(fwd,5);look.y+=.8;lerp=6;if(st.air){want.y+=1.4;want.addScaledVector(fwd,-1.5);}}
  else if(camMode===1){want=c.clone().addScaledVector(fwd,-.3);want.y+=1.08;look=c.clone().addScaledVector(fwd,25);look.y+=1;lerp=40;}
  else{want=c.clone().addScaledVector(fwd,-26);want.y+=34;look=c.clone().addScaledVector(fwd,10);lerp=3;}
  const k=1-Math.exp(-dt*lerp);camPos.lerp(want,k);camLook.lerp(look,Math.min(1,k*1.6));
  if(camPos.distanceTo(want)>60){camPos.copy(want);camLook.copy(look);}
  camera.position.copy(camPos);st.shake*=Math.exp(-dt*6);const sh=st.shake*.35+(st.onCurb?Math.min(1,Math.abs(st.speed)/40)*.06:0);
  camera.position.x+=(Math.random()-.5)*sh;camera.position.y+=(Math.random()-.5)*sh;camera.lookAt(camLook);
  const fov=baseFov()+Math.max(0,st.speed)/MAXS*14+(st.boost>0?8:0);if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*Math.min(1,dt*5);camera.updateProjectionMatrix();}
  // HUD
  const kmh=Math.round(Math.abs(st.speed)*5.76);$('speed').textContent=kmh;
  const r=Math.max(0,st.speed)/MAXS*5.4,g=Math.min(5,Math.floor(r));const within=Math.min(1,r-g);
  $('gear').textContent=st.speed<-0.5?'R':(Math.abs(st.speed)<.5?'N':String(g+1));$('revFill').style.width=(st.speed<=0.5?10:20+within*80)+'%';
  if(ac&&soundOn){const T=ac.currentTime,f=48+within*110+g*10;osc1.frequency.setTargetAtTime(f,T,.03);osc2.frequency.setTargetAtTime(f,T,.03);filt.frequency.setTargetAtTime(500+within*900+(keys.up?500:0),T,.05);
    if(g>lastGear&&st.speed>5){gain.gain.setValueAtTime(.015,T);gain.gain.setTargetAtTime(.05,T+.05,.06);}lastGear=g;
    const run=race.state==='run'||race.state==='count',sp=Math.min(1.4,Math.abs(st.speed)/MAXS),slip=Math.abs(ang(st.h,st.vh));
    windG.gain.setTargetAtTime(run?sp*sp*.06:0,T,.1);
    squealG.gain.setTargetAtTime(run&&!st.air&&st.speed>14&&(slip>.2||(keys.down&&st.speed>28))?.03:0,T,.05);
    const dS=Math.min(st.idx,M-st.idx);crowdG.gain.setTargetAtTime(Math.max(0,1-dS/90)*(race.state==='count'?.035:.06)*(.75+.25*Math.sin(now*2.3)),T,.2);}
  hudPowers();
  {const v=race.state==='run'?clamp((Math.abs(st.speed)-44)/16,0,1)*.35+(st.boost>0?.3:0):0,el=$('speedLines');if(Math.abs((+el.dataset.v||0)-v)>.02||v>0){el.dataset.v=v;el.style.opacity=v.toFixed(2);if(v>0)el.style.transform='rotate('+(Math.random()*6).toFixed(1)+'deg)';}}
  {const d=Math.round(st.dmg*100);if(d!==hudDmg){hudDmg=d;const b=$('dmgFill');b.style.width=d+'%';b.style.background=d>=65?'var(--hot)':d>=38?'var(--accent)':'var(--good)';}}
  if(st.dmg>.5&&!st.air&&Math.random()<st.dmg*.4)emit(st.pos,0,1);
  if(race.gp){boardT-=dt;if(boardT<=0){boardT=.25;updBoard();}}
  if(race.multi){setP({x:+st.pos.x.toFixed(1),y:+st.pos.y.toFixed(1),z:+st.pos.z.toFixed(1),a:+st.h.toFixed(2),w:+st.wingD.toFixed(2),fl:+st.fl.toFixed(2),lp:race.lapsDone,p:myProgress()});
    boardT-=dt;if(boardT<=0){boardT=.25;updBoard();}}
  if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)$('msg').style.opacity=0;}
  if(bannerT>0){bannerT-=dt;if(bannerT<=0)$('zoneBanner').classList.remove('show');}
  render();drawMap();
}
let ROT=false,AW=innerWidth,AH=innerHeight;
function layout(){const vw=innerWidth,vh=innerHeight;ROT=coarse&&vh>vw;AW=ROT?vh:vw;AH=ROT?vw:vh;const app=$('app');
  document.body.classList.toggle('rot',ROT);
  if(ROT){app.style.width=AW+'px';app.style.height=AH+'px';app.style.transform='translate('+vw+'px,0) rotate(90deg)';}else{app.style.width=app.style.height=app.style.transform='';}
  document.documentElement.style.setProperty('--appw',AW+'px');document.body.classList.toggle('narrow',AW<=560);document.body.classList.toggle('short',AH<=520);}
function resize(){layout();const w=AW,h=AH;renderer.setSize(w,h,false);if(composer)composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();sizeMap();}
window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,250));
// boot: the title fly-through uses the four-world level
buildLevel(4);placeOnGrid(0);show('scrTitle');resize();worldUpdate(0,0,st.pos);refreshEnv();
requestAnimationFrame(frame);
})();
