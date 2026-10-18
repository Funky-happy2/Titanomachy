import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Sky} from 'three/addons/objects/Sky.js';

// ================= core =================
const V3=THREE.Vector3,{clamp,lerp,smoothstep}=THREE.MathUtils,PI=Math.PI,TAU=PI*2;
const rand=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.random()*a.length|0],$=id=>document.getElementById(id);
const angD=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),turn=(a,b,k)=>a+angD(b,a)*Math.min(1,k);
const _v=new V3();

const renderer=new THREE.WebGLRenderer({powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,3000);
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(1,1,{samples:4,type:THREE.HalfFloatType}));
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.7,.5,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)}
addEventListener('resize',resize);resize();

const hemi=new THREE.HemisphereLight(),sun=new THREE.DirectionalLight();scene.add(hemi,sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:220});
sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;
const fill=new THREE.PointLight(0xfff0dc,30,20,1.3);scene.add(fill);const sky=new Sky();sky.scale.setScalar(2500);const skyScene=new THREE.Scene(),pmrem=new THREE.PMREMGenerator(renderer);let envRT;

// ================= procedural textures / materials =================
const hash=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)};
function vn(x,y,P=1e6){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),h=(a,b)=>hash(((a%P)+P)%P,((b%P)+P)%P);
 return lerp(lerp(h(ix,iy),h(ix+1,iy),ux),lerp(h(ix,iy+1),h(ix+1,iy+1),ux),uy)}
function fbm(x,y,P=1e6){let v=0,a=.5;for(let i=0;i<5;i++){v+=a*vn(x,y,P);x*=2;y*=2;P*=2;a*=.5}return v/.97}
function canvasTex(fn,size=256,srgb){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),im=g.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=fn(x/size,y/size),i=(y*size+x)*4;im.data[i]=p[0];im.data[i+1]=p[1];im.data[i+2]=p[2];im.data[i+3]=255}
 g.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
const NOI=canvasTex((u,v)=>{const n=fbm(u*8,v*8,8)*255;return[n,n,n]});
const DET=canvasTex((u,v)=>{const n=140+fbm(u*8+3,v*8+7,8)*115;return[n,n,n]},256,1);
const LAVA=canvasTex((u,v)=>{const n=fbm(u*4,v*4,4),k=1-smoothstep(Math.abs(n-.5),0,.06),b=fbm(u*16,v*16,16);return[255*(.25+.75*k)*(.6+.4*b),255*(.08+.5*k*k),20*k]},256,1);
const GLOW=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
 r.addColorStop(0,'#fff');r.addColorStop(.3,'rgba(255,255,255,.5)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
function mat(c,o={}){return new THREE.MeshStandardMaterial({color:c,map:o.f?null:DET,bumpMap:o.f?null:NOI,bumpScale:o.b??.6,
 roughness:o.r??.9,metalness:o.m??0,emissive:o.e??0,emissiveIntensity:o.ei??1,transparent:o.op!=null,opacity:o.op??1,vertexColors:!!o.vc,side:o.ds?2:0})}
const glow=(c,k=3,op)=>new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(k),transparent:op!=null,opacity:op??1,
 blending:op!=null?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:op==null,side:2});
function uvS(g,su,sv){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);return g}
function boxGeo(w,h,d){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,D=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
 for(let i=0;i<uv.count;i++){const[a,b]=D[i>>2];uv.setXY(i,uv.getX(i)*a/4,uv.getY(i)*b/4)}return g}
const mesh=(g,m,cs=true)=>{const o=new THREE.Mesh(g,m);o.castShadow=cs;o.receiveShadow=true;return o};
const ORB=new THREE.SphereGeometry(.22,12,8);
const colA=(c,k=2)=>{const x=new THREE.Color(c);return[x.r*k,x.g*k,x.b*k]};

// ================= particles =================
const PN=5000,pg=new THREE.BufferGeometry(),pPos=new Float32Array(PN*3),pCol=new Float32Array(PN*4),pSz=new Float32Array(PN);
pg.setAttribute('position',new THREE.BufferAttribute(pPos,3));pg.setAttribute('col',new THREE.BufferAttribute(pCol,4));pg.setAttribute('size',new THREE.BufferAttribute(pSz,1));
const pts=new THREE.Points(pg,new THREE.ShaderMaterial({uniforms:{map:{value:GLOW}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:'attribute float size;attribute vec4 col;varying vec4 c;void main(){c=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*600./-mv.z;gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform sampler2D map;varying vec4 c;void main(){gl_FragColor=vec4(c.rgb,c.a*texture2D(map,gl_PointCoord).a);}'}));
pts.frustumCulled=false;scene.add(pts);
const pL=new Float32Array(PN),pML=new Float32Array(PN),pV=new Float32Array(PN*3),pG=new Float32Array(PN),pS0=new Float32Array(PN),pC=new Float32Array(PN*3);let pI=0;
function emit(p,n,o={}){const c=o.c||[2,1,.3],sp=o.spd??4,l=o.life??.6,r=o.r||0;
 for(let k=0;k<n;k++){const i=pI++%PN,a=rand(0,TAU),u=rand(-1,1),s=Math.sqrt(1-u*u),q=rand(.3,1)*sp;pL[i]=pML[i]=l*rand(.6,1.3);
  pPos[i*3]=p.x+rand(-r,r);pPos[i*3+1]=p.y+rand(-r,r)*.5;pPos[i*3+2]=p.z+rand(-r,r);
  pV[i*3]=s*Math.cos(a)*q+(o.v?.x||0);pV[i*3+1]=u*q+(o.up||0)+(o.v?.y||0);pV[i*3+2]=s*Math.sin(a)*q+(o.v?.z||0);
  pG[i]=o.g??-6;pS0[i]=(o.size||.3)*rand(.6,1.3);pC[i*3]=c[0];pC[i*3+1]=c[1];pC[i*3+2]=c[2]}}
function updParticles(dt){for(let i=0;i<PN;i++){if(pL[i]>0){pL[i]-=dt;const k=Math.max(pL[i]/pML[i],0);pV[i*3+1]+=pG[i]*dt;
  pPos[i*3]+=pV[i*3]*dt;pPos[i*3+1]+=pV[i*3+1]*dt;pPos[i*3+2]+=pV[i*3+2]*dt;pSz[i]=pS0[i]*(.3+.7*k);
  pCol[i*4]=pC[i*3];pCol[i*4+1]=pC[i*3+1];pCol[i*4+2]=pC[i*3+2];pCol[i*4+3]=Math.min(k*2,1)}else pSz[i]=0}
 pg.attributes.position.needsUpdate=pg.attributes.col.needsUpdate=pg.attributes.size.needsUpdate=true}

// ================= state =================
const S0={lvl:0,xen:0,hub:0,weapon:'pick',stance:0,align:null,dr:0,potions:2,maxHp:100,atk:1,merchant:false,spark:false,dash:false,grapple:false,
 melt:false,miasma:false,unified:false,nymphs:false,helios:false,post:false,ending:null,skin:0,gaunt:false,sh:[],name:'Spark-bearer',sex:'m',skinT:2,hairS:1,hairC:0,house:0,xp:0,plv:1};
const HOUSES=[{n:'House of the Flame',p:'Prometheus',c:0xb3261a,d:0x4a1a14,t:'+15% Spark Blast damage',q:'You steal fire from those who hoard it.'},
 {n:'House of the Owl',p:'Athena',c:0x2a56b0,d:0x1a2a4a,t:'+15% damage resistance, wider parry window',q:'You see the blow before it falls.'},
 {n:'House of the Hunt',p:'Artemis',c:0x2a8a46,d:0x1a3a22,t:'+10% speed, faster stamina recovery',q:'You run where others stumble.'},
 {n:'House of the Anvil',p:'Hephaestus',c:0xc08020,d:0x4a3418,t:'+15% melee damage',q:'You were forged, not born.'}];
const SKINS=[0xf1c7a5,0xd9a57e,0xb67a52,0x8d5a3b,0x5e3b26,0x3b2418],HAIRC=[0x1a120c,0x4a2a14,0x8a5a2a,0xd8b060,0xa8a8a8,0x8a1a10],HAIRS=['Shaved','Short','Long','Ponytail','Curls','Topknot'];
const load=()=>{try{return JSON.parse(localStorage.getItem('titano'))}catch(e){return null}};
let S=Object.assign(structuredClone(S0),load()||{}),Sstart='{}';
let PID=(()=>{try{let i=localStorage.getItem('titano_id');if(!i){i=crypto.randomUUID();localStorage.setItem('titano_id',i)}return i}catch(e){return null}})();
const API=/^https?:/.test(location.protocol);
const save=()=>{S.t=Date.now();try{localStorage.setItem('titano',JSON.stringify(S))}catch(e){}if(API&&PID)fetch('/api/save/'+PID,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(S)}).catch(()=>{})};
async function cloudLoad(force){if(API&&PID)try{const r=await fetch('/api/save/'+PID);if(r.ok){const d=await r.json();if(d&&(force||(d.t||0)>(S.t||0))){S=Object.assign(structuredClone(S0),d);try{localStorage.setItem('titano',JSON.stringify(S))}catch(e){}}}}catch(e){}
 $('cont').style.display=S.lvl>0||S.post?'':'none'}
const xpNeed=()=>80+S.plv*40;function gainXP(n){S.xp+=n;while(S.xp>=xpNeed()){S.xp-=xpNeed();S.plv++;S.maxHp+=8;S.atk*=1.04;pl.hp=S.maxHp;pop('LEVEL '+S.plv);emit(new V3(pl.pos.x,pl.pos.y+1,pl.pos.z),120,{c:[3,2.4,.8],spd:5,up:3,life:1})}}
const WEAP={pick:{col:0xc0c8d0,st:[{n:'Pickaxe',dmg:11,rng:2.4,arc:2,spd:.45,heavy:2.2}]},
 staff:{col:0x60d8ff,st:[{n:'Sword Stance',dmg:13,rng:2.9,arc:1.7,spd:.3,heavy:2},{n:'Whip Stance',dmg:10,rng:6.5,arc:2.8,spd:.48,heavy:2.1}]},
 aegis:{col:0xffa040,st:[{n:'Shield Stance',dmg:12,rng:2.6,arc:2.2,spd:.45,heavy:2,guard:.5},{n:'Axe Stance',dmg:22,rng:3.2,arc:2.4,spd:.7,heavy:2.4,armor:1.6}]},
 claws:{col:0xc070ff,st:[{n:'Dagger Stance',dmg:8,rng:2.3,arc:2,spd:.2,heavy:2},{n:'Dart Stance',dmg:12,rng:10,arc:.6,spd:.42,heavy:1.6,pull:1}]}};
const stance=()=>{const w=WEAP[S.weapon];return w.st[S.stance%w.st.length]};
const wcol=()=>[WEAP[S.weapon].col,0xffc860,0x9a80ff][S.skin]||WEAP[S.weapon].col;

// ================= world =================
const W={},FX=[];
function resetWorld(){if(W.grp){scene.remove(W.grp);W.grp.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose())})}
 scene.remove(sky);Object.assign(W,{grp:new THREE.Group(),cols:[],enemies:[],proj:[],haz:[],anchors:[],inter:[],emitters:[],lights:[],spin:[],waiters:[],
  tick:null,time:0,grav:1,boss:null,floor:true,R:40,floorY:0,killY:-20,water:null,lava:null,amb:null,acc:0});FX.length=0;scene.add(W.grp)}
const add=(o,x=0,y=0,z=0)=>{o.position.set(x,y,z);W.grp.add(o);return o};
function block(x,y,z,w,h,d,m,solid=true){const o=add(mesh(boxGeo(w,h,d),m),x,y,z);if(solid)W.cols.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,bot:y-h/2,top:y+h/2});return o}
function cyl(x,y,z,r,h,m,solid=true,seg=20,rb=r){const o=add(mesh(uvS(new THREE.CylinderGeometry(r,rb,h,seg),r*1.5,Math.max(h/4,r/2)),m),x,y,z);if(solid)W.cols.push({cyl:1,x,z,r,bot:y-h/2,top:y+h/2});return o}
const rock=(x,y,z,s,m)=>{const o=add(mesh(new THREE.DodecahedronGeometry(s,1),m),x,y,z);o.scale.set(rand(.7,1.3),rand(.5,1),rand(.7,1.3));o.rotation.set(rand(0,3),rand(0,3),0);return o};
function column(x,z,h,m){cyl(x,h/2,z,.65,h,m,true,16,.75);block(x,.25,z,1.8,.5,1.8,m,false);block(x,h,z,1.8,.4,1.8,m,false)}
function torch(x,z,col=0xff7a30,y=0){cyl(x,y+1.1,z,.07,2.2,mat(0x2a2018),false,6);cyl(x,y+2.25,z,.32,.22,mat(0x3a3028,{m:.6,r:.4}),false,10,.15);
 const fp=new V3(x,y+2.5,z);W.emitters.push({p:fp,rate:30,o:{c:colA(col,2.2),spd:.7,up:2,g:1,life:.7,size:.32,r:.15}});
 if(W.lights.length<6){const L=new THREE.PointLight(col,40,26,1.5);L.position.copy(fp);W.grp.add(L);W.lights.push(L)}}
function anchor(x,y,z){const o=add(mesh(new THREE.TorusGeometry(.55,.08,8,24),glow(0xffc040,4),false),x,y,z);W.spin.push(o);W.anchors.push({pos:o.position});
 W.emitters.push({p:o.position,rate:6,o:{c:[2,1.4,.4],spd:.5,g:0,life:.8,size:.15,r:.4}})}
function terrain(t){const N=150,SZ=420,g=new THREE.PlaneGeometry(SZ,SZ,N,N);g.rotateX(-PI/2);const p=g.attributes.position,col=[],a=new THREE.Color(t.g1),b=new THREE.Color(t.g2),c=new THREE.Color();
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),d=Math.hypot(x,z),n=fbm(x*.04,z*.04),m=smoothstep(d,t.R,t.R+35);
  p.setY(i,(n-.5)*.35*(1-m)+m*(t.wall??30)*(.35+fbm(x*.015+5,z*.015))+(t.fy??0));c.copy(a).lerp(b,clamp(n*1.3-.2+m*.4,0,1));col.push(c.r,c.g,c.b)}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();uvS(g,SZ/5,SZ/5);add(mesh(g,mat(0xffffff,{vc:1}),false))}
function base(t){if(t.cave){const m=mat(0x1a1612,{ds:1});add(mesh(new THREE.SphereGeometry(85,32,16),m,false));
  for(let i=0;i<40;i++){const a=rand(0,TAU),r=rand(15,60),s=add(mesh(new THREE.ConeGeometry(rand(.4,1.4),rand(3,9),7),mat(0x2a2420)),Math.cos(a)*r,rand(16,24),Math.sin(a)*r);s.rotation.x=PI}}
 if(t.void){const g=new THREE.BufferGeometry(),v=[];for(let i=0;i<2500;i++){const d=new V3().randomDirection().multiplyScalar(rand(300,900));v.push(d.x,d.y,d.z)}
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));W.grp.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xc8b8ff,size:1.6,sizeAttenuation:false})))}
 else terrain(t);
 if(t.water){const g=new THREE.PlaneGeometry(500,500,90,90);g.rotateX(-PI/2);W.water=add(mesh(g,new THREE.MeshStandardMaterial({color:0x0a3a58,roughness:.12,metalness:.3,transparent:true,opacity:.92}),false),0,-.6,0);W.water.userData.y0=Float32Array.from(g.attributes.position.array)}
 if(t.lava){const g=new THREE.PlaneGeometry(500,500);g.rotateX(-PI/2);uvS(g,25,25);W.lava=add(mesh(g,new THREE.MeshStandardMaterial({color:0x1a0804,emissive:0xff5010,emissiveMap:LAVA,emissiveIntensity:2.2,roughness:.6}),false),0,-.4,0)}}
function applyTheme(t){const post=S.post&&!t.cave&&!t.void,s=post?{e:38,a:(t.sky||{}).a??180,t:2,r:.6}:(t.sky||{e:15,a:180,t:10,r:2});
 scene.fog=new THREE.FogExp2(post?0x9ab8d8:t.bg,post?t.fog*.3:t.fog*.7);scene.background=new THREE.Color(t.bg);
 hemi.color.set(post?0xd8e4ff:t.hemi[0]);hemi.groundColor.set(t.hemi[1]);hemi.intensity=t.hemi[2]*(S.post?1.5:1)*(t.cave?2.8:1.8);sun.color.set(post?0xfff0d8:t.sun[0]);sun.intensity=post?2.8:Math.max(t.sun[1]*1.3,t.cave?1.1:.9);
 W.sunDir=new V3().setFromSphericalCoords(1,(90-s.e)*PI/180,s.a*PI/180);const u=sky.material.uniforms;
 u.turbidity.value=s.t;u.rayleigh.value=s.r;u.mieCoefficient.value=.005;u.mieDirectionalG.value=.8;u.sunPosition.value.copy(W.sunDir);
 skyScene.add(sky);envRT?.dispose();envRT=pmrem.fromScene(skyScene,0,.1,10000);scene.environment=envRT.texture;scene.environmentIntensity=Math.max(t.env??.5,.45);
 if(t.sky||post)scene.add(sky);renderer.toneMappingExposure=(t.exp??1)*1.2*(S.post?1.1:1);bloom.strength=t.bloom??.7;W.amb=t.amb}

// ================= characters =================
function humanoid(o){const M=[],mk=(c,x={})=>{const m=mat(c,o.ghost?{...x,e:o.ghost,ei:.6,op:.82}:x);M.push(m);return m};
 const f=o.sex=='f',b=o.bulk??1,ab=b*(f?.85:1),P=(geo,m,x,y,z,p,sc)=>{const q=mesh(geo,m);q.position.set(x,y,z);if(sc)q.scale.set(...sc);p.add(q);return q},
  Sp=(r,m,x,y,z,p,sc)=>P(new THREE.SphereGeometry(r,18,14),m,x,y,z,p,sc),
  La=(pts,m,p,k)=>{const q=P(new THREE.LatheGeometry(pts.map(([r,h])=>new THREE.Vector2(r*k*b,h)),28),m,0,0,0,p);q.scale.z=.74;return q};
 const skin=mk(o.skin??0xc08a68,{r:.55,b:.2}),cloth=mk(o.cloth??0x553322,{ds:1,r:.95}),arm=mk(o.armor??0x8a7a5a,{m:.85,r:.35,ds:1}),hm=mk(o.hair??0x1a120c,{r:.75,b:2}),boot=mk(o.boot??0x3a2618,{r:.7});
 const g=new THREE.Group(),hips=new THREE.Group();hips.position.y=1;g.add(hips);
 const prof=f?[[0,-.08],[.18,-.06],[.215,.04],[.18,.16],[.145,.27],[.17,.37],[.185,.45],[.165,.51],[.09,.56],[.05,.6]]:[[0,-.08],[.165,-.06],[.19,.05],[.18,.18],[.17,.27],[.21,.38],[.235,.46],[.215,.52],[.11,.57],[.055,.6]];
 La(prof,cloth,hips,1);if(f)for(const x of[-.075,.075])Sp(.068,cloth,x,.41,.1,hips,[1,1,.85]);
 if(o.armor!=null&&!o.robe)La(prof.slice(3,9),arm,hips,1.08);
 P(new THREE.TorusGeometry(.185*b,.022,8,28),mk(o.belt??0x3a2414,{r:.6}),0,.07,0,hips,[1,.74,1]).rotation.x=PI/2;
 P(new THREE.CylinderGeometry(.19*b,(o.robe?.4:.26)*b,o.robe?1.02:.38,24,1,true),cloth,0,o.robe?-.43:-.1,0,hips,[1,1,.8]);
 P(new THREE.CylinderGeometry(.05*ab,.058*ab,.14,12),skin,0,.6,0,hips);
 const head=new THREE.Group();head.position.y=.78;hips.add(head);
 Sp(.115,skin,0,0,0,head,[.9,1.08,1]);Sp(f?.074:.086,skin,0,-.06,.03,head,[1,.8,1]);
 P(new THREE.ConeGeometry(.019,.055,6),skin,0,-.008,.115,head).rotation.x=PI/2;for(const x of[-.104,.104])Sp(.024,skin,x,0,0,head,[.5,1,.8]);
 const eyeM=o.eye?glow(o.eye,5):mk(0x15100c,{r:.2,f:1});
 if(o.cyclops){Sp(.042,eyeM,0,.02,.098,head);P(boxGeo(.11,.016,.02),hm,0,.06,.1,head)}
 else for(const x of[-.04,.04]){Sp(.015,eyeM,x,.02,.098,head);P(boxGeo(.045,.01,.015),hm,x,.047,.103,head)}
 const hs=o.hs??(o.helm||o.hood?-1:1),cap=k=>{const c=P(new THREE.SphereGeometry(.125*k,18,10,0,TAU,0,PI*.55),hm,0,.016,-.012,head);c.rotation.x=-.22;return c};
 if(hs>=1&&hs<=3||hs==5)cap(1);if(hs==4)cap(1.2).scale.y=1.08;
 if(hs==2)P(new THREE.CylinderGeometry(.118,.14,.34,18,1,true,PI/2,PI),hm,0,-.15,-.012,head);
 if(hs==3){Sp(.055,hm,0,.02,-.13,head);P(new THREE.ConeGeometry(.045,.32,8),hm,0,-.15,-.15,head).rotation.x=PI-.25}
 if(hs==5)Sp(.065,hm,0,.13,-.05,head);
 if(o.beard)Sp(.088,hm,0,-.095,.035,head,[1,o.beard,.85]);
 if(o.snakes)for(let i=0;i<10;i++){const a=i/10*TAU,s=P(new THREE.ConeGeometry(.022,.24,6),mk(0x3a6a20),Math.cos(a)*.09,.07,Math.sin(a)*.09-.02,head);s.rotation.set(Math.sin(a)*1.1,0,-Math.cos(a)*1.1)}
 if(o.helm){P(new THREE.SphereGeometry(.135,18,10,0,TAU,0,PI*.62),arm,0,.012,0,head);for(const x of[-.09,.09])P(boxGeo(.03,.1,.08),arm,x,-.05,.06,head);
  P(new THREE.CylinderGeometry(.19,.19,.03,18,1,false,0,PI),mk(o.crest??0x8a1a1a,{r:.95}),0,.12,-.02,head).rotation.set(0,0,PI/2)}
 if(o.hood){P(new THREE.SphereGeometry(.15,18,10,0,TAU,0,PI*.62),cloth,0,.012,-.015,head);P(new THREE.ConeGeometry(.12,.26,14,1,true),cloth,0,-.03,-.14,head).rotation.x=-PI/2-.4}
 if(o.crown)for(let i=0;i<7;i++){const a=i/7*TAU;P(new THREE.ConeGeometry(.03,.2,5),glow(0xffc040,3),Math.cos(a)*.12,.17,Math.sin(a)*.12,head)}
 if(o.halo)P(new THREE.TorusGeometry(.32,.02,8,48),glow(0xffd060,4),0,.06,-.2,head);
 const limb=(x,y,l1,l2,r1,r2,m1,m2)=>{const p=new THREE.Group();p.position.set(x,y,0);hips.add(p);P(new THREE.CylinderGeometry(r1,r1*.82,l1,14),m1,0,-l1/2,0,p);
  const j=new THREE.Group();j.position.y=-l1;p.add(j);Sp(r1*.82,m1,0,0,0,j);P(new THREE.CylinderGeometry(r2,r2*.75,l2,14),m2,0,-l2/2,0,j);const e=new THREE.Group();e.position.y=-l2;j.add(e);return[p,j,e]};
 const sw=(f?.18:.205)*b,[aL,eL,handL]=limb(-sw,.49,.29,.26,.058*ab,.046*ab,skin,o.armor!=null?arm:skin),[aR,eR,hand]=limb(sw,.49,.29,.26,.058*ab,.046*ab,skin,o.armor!=null?arm:skin);
 for(const[a,h]of[[aL,handL],[aR,hand]]){Sp(.07*ab,o.armor!=null?arm:skin,0,0,0,a,o.armor!=null?[1.4,1,1.3]:null);Sp(.042*ab,skin,0,-.04,0,h,[.75,1.15,.5])}
 let lL,lR,kL,kR,tail=null;
 if(o.tail){lL=new THREE.Group();lR=new THREE.Group();kL=new THREE.Group();kR=new THREE.Group();tail=new THREE.Group();hips.add(tail);const tm=mk(o.skin,{r:.5,m:.2});
  for(let i=0;i<16;i++){const t=i/15,sg=Sp(.21*(1-t*.8)*b,tm,0,lerp(-.1,-.88,Math.min(1,t*2.2)),-Math.max(0,t*2.2-1)*1.9,tail);sg.scale.set(1,.85,1.2)}}
 else{[lL,kL]=limb(-.1*b,-.02,.46,.44,.088*b,.062*b,o.pants?cloth:skin,o.armor!=null?arm:skin);[lR,kR]=limb(.1*b,-.02,.46,.44,.088*b,.062*b,o.pants?cloth:skin,o.armor!=null?arm:skin);
  for(const k of[kL,kR]){P(new THREE.CylinderGeometry(.062*b,.058*b,.2,14),boot,0,-.34,0,k);P(boxGeo(.085*b,.06,.22*b),boot,0,-.47,.045,k)}}
 let wings=null;if(o.wings){wings=new THREE.Group();hips.add(wings);const wm=mk(o.wings,{ds:1});
  for(const s of[-1,1]){const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(.6,.35);sh.lineTo(1.7,.75);sh.lineTo(1.55,.1);sh.lineTo(1.3,-.35);sh.lineTo(.9,-.2);sh.lineTo(.7,-.6);sh.lineTo(.4,-.35);sh.lineTo(.15,-.45);
   const w=mesh(new THREE.ShapeGeometry(sh),wm);w.scale.x=s;w.position.set(s*.1,.46,-.15);wings.add(w)}}
 g.scale.setScalar(o.s||1);return{g,hips,head,aL,aR,lL,lR,eL,eR,kL,kR,hand,handL,M,wings,tail}}
function animH(H,ph,amt,arm,armL){const s=Math.sin(ph)*amt,c=Math.sin(ph-1.3);H.lL.rotation.x=s*.75;H.lR.rotation.x=-s*.75;H.kL.rotation.x=Math.max(0,c)*amt*1.2;H.kR.rotation.x=Math.max(0,-c)*amt*1.2;
 H.aL.rotation.x=armL??-s*.6;H.aR.rotation.x=arm??s*.6;H.aL.rotation.z=-.08;H.aR.rotation.z=.08;H.eL.rotation.x=armL!=null?-.5:-.2-Math.max(0,s)*.5;H.eR.rotation.x=arm!=null?-.4:-.2-Math.max(0,-s)*.5;
 H.hips.position.y=1+Math.abs(Math.cos(ph))*amt*.06-.03*amt+Math.sin(W.time*2)*.006;if(H.tail)H.tail.rotation.y=Math.sin(W.time*2.5)*.35;
 if(H.wings)H.wings.children.forEach((w,i)=>w.rotation.y=(i?-1:1)*Math.sin(W.time*9)*.5)}
function eWeap(H,k,shield){const m=mat(0x9a9aa0,{m:.9,r:.3}),w=mat(0x3a2414),G=new THREE.Group();H.hand.add(G);
 const A=(geo,mm,x,y,z,rx=PI/2,g=G)=>{const q=mesh(geo,mm);q.position.set(x,y,z);q.rotation.x=rx;g.add(q);return q};
 if(k=='sword'){A(boxGeo(.06,.025,.9),m,0,-.04,.5,0);A(boxGeo(.26,.04,.05),mat(0xa07830,{m:.9,r:.3}),0,-.04,.06,0)}
 if(k=='spear'){A(new THREE.CylinderGeometry(.022,.022,2.4,8),w,0,-.04,.35);A(new THREE.ConeGeometry(.05,.3,6),m,0,-.04,1.68)}
 if(k=='club')A(new THREE.CylinderGeometry(.13,.05,1.3,8),w,0,-.04,.55);
 if(k=='hammer'){A(new THREE.CylinderGeometry(.05,.05,1.4),w,0,-.04,.5);A(boxGeo(.8,.4,.45),m,0,-.04,1.2,0)}
 if(k=='bow')A(new THREE.TorusGeometry(.6,.02,6,20,PI),w,0,-.04,.05,0).rotation.set(0,PI/2,PI/2);
 if(k=='trident'){A(new THREE.CylinderGeometry(.03,.03,2.6),m,0,-.04,.6);for(const x of[-.13,0,.13])A(new THREE.ConeGeometry(.035,.4,5),m,x,-.04,2.05)}
 if(k=='scythe'){A(new THREE.CylinderGeometry(.04,.04,3.4),w,0,-.04,.6);A(new THREE.TorusGeometry(.9,.06,6,24,PI*.8),glow(0xffcc55,2.5),0,.81,2.1,0).rotation.y=PI/2}
 if(k=='scim')for(const h of[H.hand,H.handL]){const g=new THREE.Group();h.add(g);A(new THREE.TorusGeometry(.7,.04,4,16,PI*.55),glow(0x90ff60,2),0,-.64,.15,0,g).rotation.y=PI/2}
 if(shield){const g=new THREE.Group();H.handL.add(g);const br=mat(0xb07a3a,{m:.95,r:.3});A(new THREE.CylinderGeometry(.42,.42,.05,28),br,0,.12,.1,PI/2,g);A(new THREE.TorusGeometry(.42,.03,6,28),br,0,.12,.13,0,g);
  A(new THREE.CircleGeometry(.15,20),mat(0x7a1010),0,.12,.131,0,g)}}
// ---- static enemy models
function oreM(){const g=new THREE.Group(),m=mat(0x1a1c24,{m:.7,r:.4,e:0x2050ff,ei:.7});for(let i=0;i<5;i++){const q=mesh(new THREE.OctahedronGeometry(rand(.3,.6)),m);q.position.set(rand(-.5,.5),rand(.3,.9),rand(-.5,.5));q.rotation.set(rand(0,3),rand(0,3),0);q.scale.y=1.8;g.add(q)}return g}
function eyeM(){const g=new THREE.Group();g.add(mesh(new THREE.SphereGeometry(.6,24,16),mat(0xe8dcc0,{r:.3})));const i=mesh(new THREE.CircleGeometry(.3,24),glow(0xff8010,4),false);i.position.z=.59;g.add(i);
 const r=mesh(new THREE.TorusGeometry(.85,.06,8,32),mat(0xb08030,{m:.9,r:.3}));r.rotation.x=PI/2;g.add(r);return g}
function towerM(){const g=new THREE.Group(),b=mat(0x8a6a30,{m:.9,r:.35});const c=mesh(new THREE.CylinderGeometry(.8,1.4,7,8),b);c.position.y=3.5;g.add(c);
 const l=mesh(new THREE.SphereGeometry(.9,24,16),glow(0xffd050,4));l.position.y=7.8;l.scale.z=.4;g.add(l);const r=mesh(new THREE.TorusGeometry(1.1,.12,8,24),b);r.position.y=7.8;g.add(r);return g}
function pylonM(){const g=new THREE.Group(),o=mesh(boxGeo(1.2,5,1.2),mat(0x1a1626,{m:.5,r:.5}));o.position.y=2.5;g.add(o);
 for(const y of[1.5,3.5]){const r=mesh(new THREE.TorusGeometry(1.1,.07,8,32),glow(0xa060ff,3),false);r.position.y=y;r.rotation.x=PI/2;g.add(r);W.spin.push(r)}return g}
function gateM(){const g=new THREE.Group(),i=mat(0x1c1a1e,{m:.8,r:.4}),gd=mat(0xa07830,{m:1,r:.3});const d=mesh(boxGeo(10,9,1.2),i);d.position.y=4.5;g.add(d);
 for(let k=-4;k<=4;k+=2){const b=mesh(boxGeo(.3,8.6,1.4),gd);b.position.set(k,4.5,0);g.add(b)}const e=mesh(new THREE.CircleGeometry(1.3,6),glow(0xff4010,2),false);e.position.set(0,6,.75);g.add(e);return g}

// ================= enemies =================
const ET={
 grunt:{hp:40,spd:3.6,dmg:10,rng:2.4,wind:.6,cd:1.5,gold:5,h:{cloth:0x6a1a14,armor:0xa07a3a,eye:0xff5010,helm:1,crest:0x7a1010},w:'spear',sh:1},
 brute:{hp:140,spd:2.6,dmg:22,rng:3,wind:.9,cd:2,gold:15,armor:1,h:{s:1.5,bulk:1.5,cloth:0x3a2a1a,skin:0x8a7a68,cyclops:1,eye:0xffa020,hs:0,beard:1.2},w:'club'},
 archer:{hp:30,spd:3.2,dmg:9,rng:16,wind:.9,cd:2.2,gold:6,ranged:1,h:{cloth:0x3a3424,armor:0x5a4a30,eye:0xffaa20,hood:1},w:'bow'},
 shade:{hp:38,spd:5,dmg:9,rng:2.2,wind:.5,cd:1.2,gold:6,h:{ghost:0x401060,cloth:0x10081a,armor:0x1a1028,skin:0x10081a,eye:0xb040ff,hood:1,robe:1},w:'sword'},
 harpy:{hp:26,spd:6,dmg:8,rng:2.2,wind:.6,cd:1.8,gold:6,fly:1,h:{s:.85,sex:'f',cloth:0x3a2a40,skin:0x9a8aaa,eye:0xff40c0,wings:0x5a3a6a,hair:0x2a1a3a,hs:2}},
 ore:{hp:24,st:1,gold:3,build:oreM,cy:.6,r:.7},eye:{hp:30,st:1,gold:10,build:eyeM,cy:0,r:.8,opt:1},
 tower:{hp:160,st:1,armor:1,gold:20,build:towerM,cy:4,r:1.4,tick:towerT},pylon:{hp:120,st:1,gold:15,build:pylonM,cy:2.5,r:.9},
 gate:{hp:450,st:1,armor:1,gold:50,build:gateM,cy:4.5,r:5,noGrap:1},
 warden:{boss:'THE IRON WARDEN',hp:420,spd:3.2,dmg:18,cd:1.6,gold:100,armor:1,h:{s:2.2,bulk:1.5,cloth:0x1a1818,armor:0x3a3a40,eye:0xff6a00,helm:1,crest:0xff5000},w:'hammer',m1:['swipe','slam','charge'],m2:['swipe','slam','charge','wave']},
 general:{boss:"OCEANUS' ELITE GENERAL",hp:320,spd:3.6,dmg:14,cd:1.5,gold:60,h:{s:1.7,bulk:1.2,cloth:0x123040,armor:0x2a6a7a,eye:0x40e0ff,helm:1,crest:0x20a0c0,beard:1,hair:0x1a3a4a},w:'trident',m1:['swipe','volley','charge'],m2:['swipe','volley','charge','wave']},
 kampe:{boss:'WARDEN KAMPE',hp:850,spd:4.5,dmg:16,cd:1.1,gold:200,h:{s:2.3,sex:'f',cloth:0x1a2a18,armor:0x2a4a2a,skin:0x4a6a40,eye:0x80ff40,wings:0x2a3a20,tail:1,snakes:1,hs:0},w:'scim',m1:['swipe','swipe','charge','slam'],m2:['volley','dive','wave','volley'],homing:1},
 kronos:{boss:'KRONOS, THE TITAN KING',hp:1100,spd:4,dmg:20,cd:1.2,gold:500,armor:1,h:{s:2.6,bulk:1.25,cloth:0x2a1a08,armor:0x8a6a20,skin:0x9a8a7a,eye:0xffd040,crown:1,halo:1,robe:1,beard:1.7,hair:0xd8d0c0,hs:2},w:'scythe',m1:['swipe','swipe','rewind','charge'],m2:['zones','wave','swipe','rewind','volley']}};
const warnTex=c=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d');g.fillStyle=c;g.beginPath();g.moveTo(32,3);g.lineTo(61,59);g.lineTo(3,59);g.closePath();g.fill();
 g.fillStyle='#000';g.font='bold 40px sans-serif';g.textAlign='center';g.fillText('!',32,55);return new THREE.CanvasTexture(cv)};
const WY=new THREE.SpriteMaterial({map:warnTex('#ffd23a'),depthTest:false}),WR=new THREE.SpriteMaterial({map:warnTex('#ff3a2a'),depthTest:false}),WT={swipe:[1.2,WY],volley:[.6,WY],slam:[.9,WR],charge:[1.2,WR],wave:[.7,WR],dive:[1.1,WR]};
const BBG=new THREE.SpriteMaterial({color:0,transparent:true,opacity:.6,depthTest:false}),BFG=new THREE.SpriteMaterial({color:0xff4040,depthTest:false});
function spawn(t,x,z,y,hard){const T=ET[t],H=T.build?null:humanoid(T.h);if(H&&(T.w||T.sh))eWeap(H,T.w,T.sh);const s=T.h?.s||1;
 const e={t,T,H,root:H?H.g:T.build(),pos:new V3(x,y??Math.max(groundAt(x,z,60),0),z),vel:new V3(),hp:T.hp*(hard?1.6:1),state:'chase',tt:rand(.5,1.5),py:0,
  face:Math.atan2(pl.pos.x-x,pl.pos.z-z),flash:0,r:T.r||.45*s,h:1.9*s,stun:0,ph:0,spd:hard?1.35:1,mt:1.5,fly:T.fly,hc:0,ca:0,as:0,grounded:0,M:[]};
 e.mhp=e.hp;e.cy=T.cy??e.h*.55;e.root.traverse(o=>{if(o.material?.emissive){o.material.userData.e=o.material.emissive.clone();e.M.push(o.material)}});
 W.grp.add(e.root);e.root.position.copy(e.pos);W.enemies.push(e);
 if(!T.boss&&!T.st){e.bb=new THREE.Sprite(BBG);e.bf=new THREE.Sprite(BFG);e.bf.center.set(0,.5);e.bb.renderOrder=e.bf.renderOrder=9;W.grp.add(e.bb,e.bf)}
 if(!T.st){e.wn=new THREE.Sprite(WY);e.wn.visible=false;e.wn.renderOrder=10;e.wn.scale.setScalar(.6*Math.max(1,s*.6));W.grp.add(e.wn)}
 if(T.boss)W.boss=e;if(!T.st)emit(new V3(x,e.pos.y+1,z),30,{c:[1.5,.4,.2],spd:4,life:.6});return e}
const ec=e=>new V3(e.pos.x,e.pos.y+e.cy,e.pos.z);
function hurtE(e,d,kb=0,am){if(e.dead)return;if(e.T.armor)d*=am||.75;e.hp-=d;e.flash=.1;e.hc++;emit(ec(e),10,{c:[2,1.6,.8],spd:6,life:.35,size:.18});
 if(kb&&!e.T.boss&&!e.T.st){const dx=e.pos.x-pl.pos.x,dz=e.pos.z-pl.pos.z,l=Math.hypot(dx,dz)||1;e.vel.x+=dx/l*kb;e.vel.z+=dz/l*kb;if(kb>3){e.stun=.5;if(e.state=='wind'){e.state='rec';e.tt=.6}}}
 pl.meter=Math.min(100,pl.meter+d*.22);if(e.hp<=0)kill(e)}
function kill(e){if(e.dead)return;e.dead=true;e.dt=0;S.dr+=e.T.gold||0;emit(ec(e),e.T.boss?200:60,{c:e.T.boss?[2.5,1.8,.6]:[1.8,.5,.2],spd:e.T.boss?10:7,life:.9,size:.3});
 if(e.bb)W.grp.remove(e.bb,e.bf);if(e.wn)W.grp.remove(e.wn);gainXP(Math.round(e.mhp*.6));if(W.boss===e)W.boss=null;if(e.col)W.cols=W.cols.filter(c=>c!==e.col)}
function towerT(e,dt){e.tt-=dt;const lens=new V3(e.pos.x,e.pos.y+7.8,e.pos.z);
 if(e.tt<=0&&lens.distanceTo(pl.pos)<45){e.tt=rand(3.5,5);hz({k:'beam',a:lens,b:new V3(pl.pos.x,pl.pos.y+.9,pl.pos.z).addScaledVector(pl.vel,.35),w:1.3,delay:1,dmg:18})}}
function meleeHit(e,rng,arc,dmg,big){const dx=pl.pos.x-e.pos.x,dz=pl.pos.z-e.pos.z,d=Math.hypot(dx,dz);slash(e.pos,e.face,rng,arc,big?0xff3010:0xff5020,e.h*.45);
 if(d<rng+.4&&Math.abs(angD(Math.atan2(dx,dz),e.face))<arc/2+.2&&Math.abs(pl.pos.y-e.pos.y)<3)hurtP(dmg,0,e,1)}
function updEnemy(e,dt){const T=e.T;
 if(e.dead){e.dt+=dt;e.root.position.y-=dt*.8;e.root.scale.multiplyScalar(1-dt*1.2);if(e.dt>1.2&&!e.gone){e.gone=1;W.grp.remove(e.root)}return}
 const fl=e.flash>0;e.flash-=dt;if(fl!==e.fl){e.fl=fl;for(const m of e.M)fl?m.emissive.setRGB(1,1,1):m.emissive.copy(m.userData.e)}
 T.tick?.(e,dt);
 if(T.st){if(e.t=='eye')e.pos.y+=Math.sin(W.time*2+e.pos.x)*dt*.5;e.root.position.copy(e.pos);if(e.t=='eye')e.root.lookAt(pl.pos.x,pl.pos.y+1,pl.pos.z);return}
 const dx=pl.pos.x-e.pos.x,dz=pl.pos.z-e.pos.z,d=Math.hypot(dx,dz),ty=Math.atan2(dx,dz);e.stun-=dt;e.grounded-=dt;e.as-=dt;e.mv=0;let arm=null;
 if(T.boss)bossAI(e,dt,d,ty);
 else if(e.stun<=0){if(e.state=='chase'){e.face=turn(e.face,ty,dt*8);
   if(T.ranged){e.mv=d>T.rng*.8?1:d<T.rng*.4?-1:0;if(d<T.rng&&(e.tt-=dt)<=0){e.state='wind';e.tt=T.wind}}
   else{e.mv=d>T.rng*.8?1:0;if(d<T.rng+.3&&Math.abs(pl.pos.y-e.pos.y)<2.5){e.state='wind';e.tt=T.wind}}}
  else if(e.state=='wind'){e.face=turn(e.face,ty,dt*4);arm=-2.5;e.tt-=dt;if(Math.random()<.4)emit(e.H.hand.getWorldPosition(_v),1,{c:[3,.4,.1],spd:.5,g:0,life:.3,size:.25});
   if(e.tt<=0){e.state='rec';e.tt=T.cd*rand(.8,1.2);e.as=.25;
    if(T.ranged){const o=new V3(e.pos.x,e.pos.y+1.5,e.pos.z),tg=new V3(pl.pos.x,pl.pos.y+1,pl.pos.z);shoot(o,tg.sub(o).normalize(),{spd:20,col:0xff8030,pc:[2,.8,.2],dmg:T.dmg})}
    else meleeHit(e,T.rng,2,T.dmg)}}
  else{e.tt-=dt;e.mv=d>5?.5:0;e.face=turn(e.face,ty,dt*3);if(e.tt<=0){e.state='chase';e.tt=rand(.3,1)}}}
 if(e.as>0)arm=-.2;
 const sp=(T.spd||0)*e.spd*(e.mv||0);let sx=0,sz=0;
 for(const o of W.enemies){if(o===e||o.dead||o.T.st)continue;const ox=e.pos.x-o.pos.x,oz=e.pos.z-o.pos.z,od=Math.hypot(ox,oz),mn=e.r+o.r+.2;if(od<mn&&od>1e-3){sx+=ox/od*(mn-od);sz+=oz/od*(mn-od)}}
 if(d<e.r+.45&&d>1e-3&&Math.abs(pl.pos.y-e.pos.y)<2){const k=e.r+.45-d;if(T.boss){pl.pos.x+=dx/d*k;pl.pos.z+=dz/d*k}else{sx-=dx/d*k;sz-=dz/d*k}}
 const kk=1-Math.exp(-6*dt);if(!e.charging){e.vel.x=lerp(e.vel.x,Math.sin(e.face)*sp+sx*5,kk);e.vel.z=lerp(e.vel.z,Math.cos(e.face)*sp+sz*5,kk)}
 const flying=e.fly&&!(e.grounded>0)&&!e.dive;e.py=e.pos.y;
 if(flying){const hy=T.boss?W.floorY+5:pl.pos.y+(e.state=='wind'?.2:3.2);e.pos.y=lerp(e.pos.y,hy,1-Math.exp(-3*dt));e.vel.y=0;e.pos.x+=e.vel.x*dt;e.pos.z+=e.vel.z*dt}
 else{if(!e.charging&&groundAt(e.pos.x+e.vel.x*.2,e.pos.z+e.vel.z*.2,e.pos.y+.6)<e.pos.y-1.2){e.vel.x*=-.3;e.vel.z*=-.3}
  e.vel.y=Math.max(e.vel.y-26*dt,-30);e.pos.addScaledVector(e.vel,dt);collide(e,e.r,e.h);if(e.pos.y<W.killY-3)kill(e)}
 e.root.position.copy(e.pos);e.root.rotation.y=e.face;
 if(e.H){const hs=Math.hypot(e.vel.x,e.vel.z);e.ph+=dt*hs*1.8;const ta=T.boss?e.arm:arm;e.ca=lerp(e.ca,ta??0,1-Math.exp(-18*dt));
  animH(e.H,e.ph,flying?.15:Math.min(hs/3,1.2),ta!=null||Math.abs(e.ca)>.05?e.ca:null,T.w=='scim'&&ta!=null?e.ca:null)}
 if(e.wn){let w=null;if(T.boss){const m=e.move,tl=m&&WT[m.n];if(tl&&m.t<tl[0])w=tl[1]}else if(e.state=='wind')w=WY;
  e.wn.visible=!!w&&e.stun<=0;if(w){e.wn.material=w;e.wn.position.set(e.pos.x,e.pos.y+e.h+.55*(e.root.scale.x||1),e.pos.z)}}
 if(e.bb){const show=e.hp<e.mhp;e.bb.visible=e.bf.visible=show;if(show){const y=e.pos.y+e.h+.4,cr=_v.setFromMatrixColumn(camera.matrixWorld,0);
  e.bb.position.set(e.pos.x,y,e.pos.z);e.bb.scale.set(1.2,.1,1);e.bf.position.copy(e.bb.position).addScaledVector(cr,-.6);e.bf.scale.set(1.2*Math.max(e.hp,0)/e.mhp,.1,1)}}}
// ---- bosses
const X=(m,t)=>m.pt<t&&m.t>=t;
const MOVES={
 swipe(e,m,dt,d,ty){e.mv=d>2.5?.7:0;e.face=turn(e.face,ty,dt*6);const p=((m.t+.1)%.35)/.35;e.arm=p<.6?lerp(0,-2.6,p/.6):lerp(-2.6,-.2,(p-.6)/.4);
  for(const t of[.45,.8,1.15])if(X(m,t))meleeHit(e,e.r+2.6,2.4,e.T.dmg,1);return m.t>1.35},
 slam(e,m){if(!m.i){m.i=1;hz({k:'circle',pos:e.pos.clone().setY(e.fly?W.floorY:e.pos.y),r:6.5,delay:.9,dmg:e.T.dmg*1.5})}e.arm=m.t<.9?-2.9:-.1;if(X(m,.9))shake(.6);return m.t>1.5},
 charge(e,m,dt,d,ty){if(m.t<.6){e.face=turn(e.face,ty,dt*6);e.arm=-1.5;emit(ec(e),2,{c:[3,.5,.1],spd:2,life:.3})}
  else if(m.t<1.25){e.charging=1;e.vel.set(Math.sin(e.face)*20,e.vel.y,Math.cos(e.face)*20);emit(e.pos,3,{c:[.8,.7,.6],spd:2,life:.5,g:0});if(!m.h&&d<e.r+1.3){m.h=1;hurtP(e.T.dmg*1.2);pl.vel.y=8}}
  else e.charging=0;if(m.t>1.5){e.charging=0;return true}},
 wave(e,m){e.arm=m.t<.7?-2.8:0;if(X(m,.7)){hz({k:'wave',pos:e.pos.clone().setY(e.fly?W.floorY:e.pos.y),spd:13,max:32,dmg:e.T.dmg});shake(.5)}return m.t>1.2},
 volley(e,m,dt,d,ty){e.face=turn(e.face,ty,dt*6);e.arm=-1.6;if(X(m,.6)){const o=ec(e);for(let k=-2;k<=2;k++){const a=e.face+k*.22;
  shoot(o,new V3(Math.sin(a),(pl.pos.y+.9-o.y)/Math.max(d,1),Math.cos(a)).normalize(),{spd:15,col:0x80ff60,pc:[1,2.5,.6],dmg:e.T.dmg*.7,home:e.phase2&&e.T.homing,life:4,sz:1.5})}}return m.t>1.1},
 rewind(e,m){if(!m.i){m.i=1;e.hc=0;toast('⏳ KRONOS REWINDS TIME — strike fast to interrupt!')}e.arm=-2;emit(ec(e),4,{c:[3,2.4,.8],spd:3,life:.8,r:2,g:0});
  if(e.hc>=6){e.stun=2.2;toast('Rewind interrupted!');shake(.4);return true}if(m.t>3.2){e.hp=Math.min(e.mhp,e.hp+e.mhp*.12);emit(ec(e),120,{c:[3,2.5,1],spd:8});return true}},
 zones(e,m){e.arm=-2.5;if(X(m,.5))for(let i=0;i<2;i++)hz({k:'zone',pos:new V3(pl.pos.x+rand(-4,4),W.floorY,pl.pos.z+rand(-4,4)),r:5,life:9});return m.t>1},
 dive(e,m){if(!m.i){m.i=1;e.dive=1;m.s=e.pos.clone();m.tg=pl.pos.clone();hz({k:'circle',pos:m.tg.clone(),r:4.5,delay:1.1,dmg:e.T.dmg*1.4})}
  const k=Math.min(m.t/1.1,1);e.pos.lerpVectors(m.s,m.tg,k*k);e.vel.set(0,0,0);e.arm=-2.8;if(m.t>=1.1){e.dive=0;e.grounded=2.5}return m.t>1.4}};
function bossAI(e,dt,d,ty){const T=e.T;
 if(!e.phase2&&e.hp<e.mhp*.5){e.phase2=1;e.mt=1;emit(ec(e),150,{c:[3,1,.4],spd:9});shake(.8);
  if(e.t=='kampe'){e.H.wings.visible=true;e.fly=1;toast('Kampe takes wing! Grapple [G] onto her to drag her down!')}
  else if(e.t=='kronos')toast('Kronos warps time — slow zones bend your swings. Jump the shockwaves, grapple out!');else toast(T.boss+' is enraged!')}
 if(e.stun>0){e.arm=.3;return}
 if(e.move){const m=e.move;m.pt=m.t;m.t+=dt*e.spd;if(MOVES[m.n](e,m,dt,d,ty)){e.move=null;e.arm=null;e.mt=T.cd*rand(.7,1.2)/e.spd}return}
 e.face=turn(e.face,ty,dt*5);e.mv=d>3.4?1:0;
 if((e.mt-=dt)<=0){const l=(e.phase2&&T.m2||T.m1).filter(n=>n!='rewind'||e.hp<e.mhp*.85);e.move={n:pick(l),t:0,pt:0}}}

// ================= hazards / projectiles / fx =================
function fx(o,life,fn){W.grp.add(o);FX.push({o,l:life,ml:life,fn})}
function slash(pos,yaw,r,arc,col,y=1){const m=mesh(new THREE.RingGeometry(r*.35,r,24,1,-PI/2-arc/2,arc).rotateX(-PI/2),glow(col,3,.8),false);
 m.position.set(pos.x,pos.y+y,pos.z);m.rotation.y=yaw;fx(m,.18,(o,k)=>{o.material.opacity=.8*(1-k);o.scale.setScalar(1+k*.25)})}
function hz(h){h.t=0;const red=glow(h.col??0xff2200,2.5,.5);
 if(h.k=='circle'){h.m=add(mesh(new THREE.RingGeometry(h.r*.93,h.r,40).rotateX(-PI/2),red,false),h.pos.x,h.pos.y+.06,h.pos.z);
  h.f=add(mesh(new THREE.CircleGeometry(h.r,40).rotateX(-PI/2),glow(h.col??0xff2200,1.5,.25),false),h.pos.x,h.pos.y+.05,h.pos.z);
  if(h.rock)h.rk=add(mesh(new THREE.DodecahedronGeometry(1.3),mat(0x2a2624)),h.pos.x,h.pos.y+25,h.pos.z)}
 if(h.k=='wave')h.m=add(mesh(new THREE.CylinderGeometry(1,1,.9,48,1,true),glow(h.col??0xffaa40,2.5,.6),false),h.pos.x,h.pos.y+.45,h.pos.z);
 if(h.k=='beam'){h.b=h.a.clone().add(h.b.clone().sub(h.a).normalize().multiplyScalar(60));h.m=mesh(new THREE.CylinderGeometry(.05,.05,1,6).rotateX(PI/2),red,false);
  W.grp.add(h.m);h.m.position.copy(h.a).lerp(h.b,.5);h.m.lookAt(h.b);h.m.scale.z=60}
 if(h.k=='zone')h.m=add(mesh(new THREE.SphereGeometry(h.r,32,16,0,TAU,0,PI/2),glow(0x8040ff,1.2,.18),false),h.pos.x,h.pos.y,h.pos.z);
 W.haz.push(h);return h}
const segDist=(p,a,b)=>{const ab=b.clone().sub(a),t=clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(ab,t))};
const inZone=p=>W.haz.some(h=>h.k=='zone'&&Math.hypot(p.x-h.pos.x,p.z-h.pos.z)<h.r);
function updHaz(dt){for(const h of W.haz){h.t+=dt;const pd=h.pos?Math.hypot(pl.pos.x-h.pos.x,pl.pos.z-h.pos.z):0;
  if(h.k=='circle'){const k=Math.min(h.t/h.delay,1);h.f.scale.setScalar(Math.max(k,.01));if(h.rk)h.rk.position.y=h.pos.y+25*(1-k*k);
   if(h.t>=h.delay&&!h.done){h.done=1;if(pd<h.r&&Math.abs(pl.pos.y-h.pos.y)<2.5)hurtP(h.dmg);emit(h.pos,40,{c:h.rock?[.9,.7,.5]:[2.5,.7,.2],spd:8,up:4,r:h.r*.5});shake(.25)}
   if(h.t>h.delay+.25)h.dead=1}
  else if(h.k=='wave'){const R=h.t*h.spd;h.m.scale.set(R,1,R);h.m.material.opacity=.6*(1-R/h.max);if(!h.hit&&Math.abs(pd-R)<.8&&pl.pos.y-h.pos.y<.9){h.hit=1;hurtP(h.dmg)}if(R>h.max)h.dead=1}
  else if(h.k=='beam'){if(h.t>=h.delay&&!h.done){h.done=1;h.m.scale.x=h.m.scale.y=12;h.m.material.color.set(0xffdd88).multiplyScalar(4);h.m.material.opacity=.9;
    if(segDist(new V3(pl.pos.x,pl.pos.y+.9,pl.pos.z),h.a,h.b)<h.w)hurtP(h.dmg);shake(.2)}if(h.t>h.delay+.3)h.dead=1}
  else if(h.k=='zone'){h.m.material.opacity=.18*Math.min(1,h.life-h.t);if(h.t>h.life)h.dead=1}
  if(h.dead){W.grp.remove(h.m);h.f&&W.grp.remove(h.f);h.rk&&W.grp.remove(h.rk)}}W.haz=W.haz.filter(h=>!h.dead)}
function shoot(from,dir,o){const m=add(mesh(ORB,glow(o.col,4),false),from.x,from.y,from.z);m.scale.setScalar(o.sz||1);W.proj.push({...o,pos:from.clone(),vel:dir.clone().multiplyScalar(o.spd),m,life:o.life||3})}
function updProj(dt){for(const p of W.proj){p.life-=dt;const pc=new V3(pl.pos.x,pl.pos.y+.9*W.grav,pl.pos.z);
  if(p.home)p.vel.lerp(pc.clone().sub(p.pos).normalize().multiplyScalar(p.spd),dt*1.6);p.pos.addScaledVector(p.vel,dt);p.m.position.copy(p.pos);
  emit(p.pos,1,{c:p.pc,spd:.4,life:.3,size:(p.sz||1)*.3,g:0});let boom=p.life<=0||p.pos.y<groundAt(p.pos.x,p.pos.z,p.pos.y);
  if(p.pl){for(const e of W.enemies)if(!e.dead&&ec(e).distanceTo(p.pos)<e.r+.8){boom=true;break}}
  else{if((pl.barrier>0||pl.parry>0)&&pc.distanceTo(p.pos)<2){if(pl.barrier<=0)parried(null);Object.assign(p,{pl:1,home:0,life:2,aoe:2.5});p.vel.negate();continue}if(pc.distanceTo(p.pos)<.9){hurtP(p.dmg);boom=true}}
  if(boom){p.dead=1;W.grp.remove(p.m);emit(p.pos,p.pl?50:15,{c:p.pc,spd:p.pl?8:4,life:.5,size:.3});
   if(p.pl){for(const e of W.enemies)if(!e.dead&&ec(e).distanceTo(p.pos)<p.aoe+e.r)hurtE(e,p.dmg,4);shake(.2)}}}W.proj=W.proj.filter(p=>!p.dead)}

// ================= collision =================
function collide(o,r,h){const inv=o===pl&&W.grav<0,y=o.pos.y,lo=inv?y-h:y,hi=inv?y:y+h,plo=inv?o.py-h:o.py,phi=inv?o.py:o.py+h;let sup=inv?Infinity:-Infinity;o.onGround=false;
 if(W.floor&&!inv){const d=Math.hypot(o.pos.x,o.pos.z);if(d<W.R+1)sup=W.floorY;if(d>W.R-r){const k=(W.R-r)/d;o.pos.x*=k;o.pos.z*=k}}
 for(const c of W.cols){let nx,nz,dist;
  if(c.cyl){nx=o.pos.x-c.x;nz=o.pos.z-c.z;const l=Math.hypot(nx,nz)||1e-4;dist=l-c.r;nx/=l;nz/=l}
  else{const cx=clamp(o.pos.x,c.x0,c.x1),cz=clamp(o.pos.z,c.z0,c.z1);nx=o.pos.x-cx;nz=o.pos.z-cz;const l=Math.hypot(nx,nz);
   if(l<1e-4){const dd=[o.pos.x-c.x0,c.x1-o.pos.x,o.pos.z-c.z0,c.z1-o.pos.z],m=Math.min(...dd),i=dd.indexOf(m);nx=[-1,1,0,0][i];nz=[0,0,-1,1][i];dist=-m}else{dist=l;nx/=l;nz/=l}}
  if(dist>=r)continue;
  if(!inv&&(lo>=c.top-.5||plo>=c.top-.05)){if(c.top>sup)sup=c.top;continue}
  if(inv&&(hi<=c.bot+.5||phi<=c.bot+.05)){if(c.bot<sup)sup=c.bot;continue}
  if(hi<=c.bot||lo>=c.top)continue;
  if(!inv&&o.vel.y>0&&phi<=c.bot+.05){o.pos.y=c.bot-h;o.vel.y=0;continue}
  o.pos.x+=nx*(r-dist);o.pos.z+=nz*(r-dist)}
 if(!inv){if(o.pos.y<=sup+.05&&o.vel.y<=0){o.pos.y=sup;o.vel.y=0;o.onGround=true}}
 else if(o.pos.y>=sup-.05&&o.vel.y>=0){o.pos.y=sup;o.vel.y=0;o.onGround=true}}
function groundAt(x,z,y){let s=-Infinity;if(W.floor&&Math.hypot(x,z)<W.R+1)s=W.floorY;
 for(const c of W.cols){const inn=c.cyl?Math.hypot(x-c.x,z-c.z)<c.r:x>=c.x0&&x<=c.x1&&z>=c.z0&&z<=c.z1;if(inn&&c.top<=y+.5&&c.top>s)s=c.top}return s}

// ================= player =================
const pl={pos:new V3(),vel:new V3(),py:0,face:PI,hp:100,st:100,sp:100,inv:0,dodge:0,dd:new V3(),atk:null,combo:0,ct:0,buf:0,grap:null,air:1,gcd:0,barrier:0,fs:false,onGround:false,ph:0,safe:new V3(),safeT:0,wg:[]};
let PH;const tether=mesh(new THREE.CylinderGeometry(.035,.035,1,6).rotateX(PI/2),glow(0xffd070,4),false),barrierM=mesh(new THREE.SphereGeometry(1.7,32,16),glow(0x60a0ff,1.2,.25),false),fireOrbs=new THREE.Group();
for(let i=0;i<3;i++){const o=mesh(new THREE.SphereGeometry(.18,10,8),glow(0xff7020,5),false);fireOrbs.add(o)}const parryM=mesh(new THREE.TorusGeometry(1.1,.04,8,48),glow(0x80c8ff,4,.9),false);parryM.rotation.x=PI/2;scene.add(tether,barrierM,fireOrbs,parryM);parryM.visible=false;barrierM.visible=fireOrbs.visible=tether.visible=false;
function buildPlayer(){if(PH)scene.remove(PH.g);PH=humanoid({sex:S.sex,skin:SKINS[S.skinT],hair:HAIRC[S.hairC],hs:S.hairS,cloth:S.spark?HOUSES[S.house].d:0x6b5a48,armor:S.spark?0x8a6a3a:null,pants:1,boot:S.spark?0x2a1a10:0x4a3a2a});scene.add(PH.g);
 const cg=new THREE.CylinderGeometry(.26,.4,1.05,12,4,true,PI*.72,PI*.56).translate(0,-.52,.08);PH.cape=mesh(cg,mat(S.spark?HOUSES[S.house].c:0x4a3a2a,{ds:1}));PH.cape.position.set(0,.52,-.15);PH.hips.add(PH.cape);
 if(S.spark){const c=mesh(new THREE.SphereGeometry(.07,10,8),glow(S.miasma?0x60ff30:0x80d8ff,6),false);c.position.set(0,.43,.17);PH.hips.add(c)}buildWeapon()}
function buildWeapon(){for(const g of pl.wg)g.parent?.remove(g);pl.wg=[];const w=S.weapon,st=S.stance,c=wcol(),k=S.unified?5:3,G=glow(c,k),GT=glow(c,k*.6,.4),iron=mat(0x24262c,{m:.9,r:.3}),brz=mat(0xb07a3a,{m:.95,r:.25});
 const grp=h=>{const g=new THREE.Group();h.add(g);pl.wg.push(g);return g},A=(g,geo,m,x,y,z,rx=PI/2)=>{const q=mesh(geo,m);q.position.set(x,y,z);q.rotation.x=rx;g.add(q);return q};
 const g=grp(PH.hand);pl.tip=new THREE.Object3D();g.add(pl.tip);pl.dode=null;
 if(w=='pick'){A(g,new THREE.CylinderGeometry(.035,.035,1),mat(0x4a3020),0,0,.35);A(g,new THREE.ConeGeometry(.06,.9,6),iron,0,0,.85,0).rotation.z=PI/2;pl.tip.position.set(.45,0,.85)}
 if(w=='staff'){A(g,new THREE.CylinderGeometry(.03,.03,2.4),iron,0,0,.3);pl.dode=A(g,new THREE.DodecahedronGeometry(.26),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(k),wireframe:true}),0,0,1.6,0);
  A(g,new THREE.SphereGeometry(.09,8,6),G,0,0,1.6,0);if(st==0){A(g,boxGeo(.07,.015,1.3),GT,0,0,2.4,0);pl.tip.position.set(0,0,3)}
  else{for(let i=0;i<5;i++)A(g,new THREE.TetrahedronGeometry(.1),G,Math.cos(i*1.26)*.5,Math.sin(i*1.26)*.5,1.6,0);pl.tip.position.set(0,0,1.6)}}
 if(w=='aegis'){const gl=grp(PH.handL);for(const h of[g,gl])A(h,boxGeo(.24,.5,.24),brz,0,.25,0,0);
  if(st==0){A(gl,new THREE.CylinderGeometry(.75,.75,.04,6),GT,0,.1,.3);A(gl,new THREE.TorusGeometry(.75,.035,4,6),G,0,.1,.33,0);pl.tip.position.set(0,0,.3)}
  else{A(g,new THREE.CylinderGeometry(.04,.04,1.5),iron,0,0,.5);A(g,new THREE.CylinderGeometry(.55,.55,.05,20,1,false,0,PI),GT,0,0,1.1,0);pl.tip.position.set(.55,0,1.1)}}
 if(w=='claws')for(const h of[PH.hand,PH.handL]){const gg=grp(h);A(gg,boxGeo(.2,.3,.2),iron,0,.1,0,0);for(const i of[-1,0,1])A(gg,new THREE.ConeGeometry(.035,st?.5:.75,4),G,i*.07,0,.45);pl.tip.position.set(0,0,.8)}}
function player(x,z,y){pl.pos.set(x,y??Math.max(groundAt(x,z,60),0),z);pl.safe.copy(pl.pos);pl.vel.set(0,0,0);pl.face=cam.yaw=PI;cam.pitch=.3;cam.pos.set(x,pl.pos.y+4,z+7)}
function inputDir(){const f=new V3(Math.sin(cam.yaw),0,Math.cos(cam.yaw)),m=new V3();if(K.KeyW)m.add(f);if(K.KeyS)m.sub(f);
 if(K.KeyD){m.x-=f.z;m.z+=f.x}if(K.KeyA){m.x+=f.z;m.z-=f.x}return m.lengthSq()?m.normalize():m}
function parried(src){pl.parry=0;pl.meter=Math.min(100,pl.meter+20);hitstop=.12;shake(.35);pop('PERFECT PARRY');emit(new V3(pl.pos.x,pl.pos.y+1.1,pl.pos.z),40,{c:[.6,1.4,3],spd:7,life:.4});
 if(src&&!src.dead){src.stun=src.T.boss?1.2:1.8;src.charging=0;if(src.T.boss){src.move=null;src.arm=null;src.mt=1.4}else{src.state='rec';src.tt=1.6}hurtE(src,20*S.atk,5,2)}}
function parry(){if(pl.pcd>0||pl.dead)return;pl.parry=S.house==1?.42:.3;pl.pcd=.65;pl.atk=null}
function sight(){if(pl.scd>0)return;pl.scd=6;pl.sight=8;const r=mesh(new THREE.RingGeometry(.9,1,64).rotateX(-PI/2),glow(0x60d0ff,3,.8),false);r.position.set(pl.pos.x,pl.pos.y+.3,pl.pos.z);fx(r,1,(o,k)=>{o.scale.setScalar(1+k*40);o.material.opacity=.8*(1-k)})}
function hurtP(d,force,src,blk){if(pl.dead)return;if(!force&&blk&&pl.parry>0)return parried(src);if(!force&&(pl.inv>0||pl.barrier>0))return;let k=stance().guard||1;if(pl.fs)k*=.6;if(S.house==1)k*=.85;pl.hp-=d*k;pl.inv=.35;shake(.3);
 document.body.classList.add('hurt');setTimeout(()=>document.body.classList.remove('hurt'),180);emit(new V3(pl.pos.x,pl.pos.y+1,pl.pos.z),15,{c:[2,.2,.2],spd:4,life:.4});if(pl.hp<=0)die()}
const atkMul=()=>(inZone(pl.pos)?.5:1)*(W.boss?.t=='kronos'&&W.boss.phase2?.8:1);
function attack(heavy){if(pl.dodge>0||pl.grap)return;if(pl.atk){pl.buf=heavy?2:1;return}const s=stance(),cost=heavy?18:5;if(pl.st<cost)return;pl.st-=cost;
 let best=null,bd=s.rng+4;for(const e of W.enemies){if(e.dead)continue;const d=Math.hypot(e.pos.x-pl.pos.x,e.pos.z-pl.pos.z)-e.r;
  if(d<bd&&Math.abs(angD(Math.atan2(e.pos.x-pl.pos.x,e.pos.z-pl.pos.z),cam.yaw))<1.4){bd=d;best=e}}
 pl.face=best?Math.atan2(best.pos.x-pl.pos.x,best.pos.z-pl.pos.z):cam.yaw;
 pl.atk={heavy,t:0,dur:s.spd*(heavy?1.7:1)/atkMul(),n:pl.combo};pl.combo=(pl.combo+1)%3;pl.ct=.9;if(heavy&&s.pull&&best)startGrapple({e:best})}
function doHit(a){const s=stance(),col=S.melt?0xff6a20:wcol(),dmg=s.dmg*(a.heavy?s.heavy:1)*S.atk*(S.melt?1.2:1)*(S.unified?1.25:1)*(a.n==2?1.3:1)*(S.house==3?1.15:1);
 slash(pl.pos,pl.face,s.rng,s.arc,col,W.grav>0?1.1:-1.1);if(S.melt)emit(pl.tip.getWorldPosition(new V3()),20,{c:[3,1,.2],spd:3,life:.5,up:1});let hit=0;
 for(const e of W.enemies){if(e.dead)continue;const dx=e.pos.x-pl.pos.x,dz=e.pos.z-pl.pos.z,d=Math.hypot(dx,dz)-e.r;if(d>s.rng)continue;
  if(Math.abs(e.pos.y+e.cy-(pl.pos.y+.9*W.grav))>Math.max(2,e.h*.6))continue;if(d>.5&&Math.abs(angD(Math.atan2(dx,dz),pl.face))>s.arc/2)continue;hurtE(e,dmg,a.heavy?7:2.5,s.armor);hit++}
 if(hit){hitstop=a.heavy?.09:.05;shake(a.heavy?.35:.15)}}
function grapTarget(){const cf=camera.getWorldDirection(new V3());let best=null,bs=.94;
 for(const c of[...W.anchors.map(a=>({p:a.pos})),...W.enemies.filter(e=>!e.dead&&!e.T.noGrap).map(e=>({p:ec(e),e}))]){const pd=c.p.distanceTo(pl.pos);if(pd>38||pd<2.5)continue;
  const dot=c.p.clone().sub(camera.position).normalize().dot(cf);if(dot>bs){bs=dot;best=c}}return best}
function startGrapple(c){pl.grap={c,t:0};pl.atk=null;tether.visible=true}
function updPlayer(dt){const p=pl,g=W.grav,sl=inZone(p.pos)?.5:1;p.inv-=dt;p.gcd-=dt;p.barrier-=dt;p.ct-=dt;if(p.ct<0)p.combo=0;
 p.sp=Math.min(100,p.sp+(S.unified?15:9)*dt);const mv=inputDir(),moving=mv.lengthSq()>0,spr=K.ShiftLeft&&moving&&p.st>5&&!p.atk&&p.onGround;
 p.st=clamp(p.st+(spr?-20:(p.atk?6:26)*(S.house==2?1.25:1))*dt,0,100);p.parry-=dt;p.pcd-=dt;p.sight-=dt;p.scd-=dt;p.py=p.pos.y;
 if(p.grap){const G=p.grap;G.t+=dt;p.inv=.15;const tp=G.c.e?ec(G.c.e):G.c.p,to=tp.clone().sub(new V3(p.pos.x,p.pos.y+.9*g,p.pos.z)),dist=to.length();
  tether.position.copy(PH.hand.getWorldPosition(new V3())).lerp(tp,.5);tether.lookAt(tp);tether.scale.z=tether.position.distanceTo(tp)*2;
  if(dist<(G.c.e?G.c.e.r+1.4:1.4)||G.t>1.6||G.c.e?.dead){if(G.c.e&&!G.c.e.dead){const e=G.c.e;hurtE(e,25*S.atk*(e.T.boss?1.6:1),3);if(e.fly&&e.T.boss){e.grounded=3;toast('Kampe crashes down!')}p.vel.set(0,6*g,0);hitstop=.08;shake(.4)}
   else{p.vel.copy(to.normalize()).multiplyScalar(8);p.vel.y=Math.max(p.vel.y*g,8)*g}p.grap=null;p.air=1;tether.visible=false}
  else{p.vel.copy(to.normalize()).multiplyScalar(32);p.face=Math.atan2(to.x,to.z)}}
 else if(p.dodge>0){p.dodge-=dt;p.vel.set(p.dd.x,0,p.dd.z);if(S.dash)emit(new V3(p.pos.x,p.pos.y+1*g,p.pos.z),3,{c:[.4,1.2,2.5],spd:1,life:.5,g:0,size:.25})}
 else{const sp=(spr?10.5:6.5)*sl*(p.atk?.3:1)*(S.house==2?1.1:1),a=1-Math.exp(-(p.onGround?14:4)*dt);p.vel.x=lerp(p.vel.x,mv.x*sp,a);p.vel.z=lerp(p.vel.z,mv.z*sp,a);p.vel.y=clamp(p.vel.y-26*g*dt,-32,32)}
 p.pos.addScaledVector(p.vel,dt);collide(p,.42,1.8);
 if(p.onGround){p.air=1;if(g>0&&(p.safeT-=dt)<=0){p.safe.copy(p.pos);p.safeT=.5}}
 if(p.pos.y<W.killY||p.pos.y>60){hurtP(12,1);emit(p.pos,40,{c:[1,1,2],spd:5});p.pos.copy(p.safe);p.vel.set(0,0,0);p.grap=null;tether.visible=false}
 if(moving&&!p.atk&&!p.grap&&p.dodge<=0)p.face=turn(p.face,Math.atan2(mv.x,mv.z),dt*12);
 if(p.atk){const a=p.atk;a.t+=dt;if(!a.hit&&a.t>=a.dur*.42){a.hit=1;doHit(a)}if(a.t>=a.dur){p.atk=null;if(p.buf){const b=p.buf;p.buf=0;attack(b==2)}}}
 if(pl.fs){fireOrbs.visible=true;fireOrbs.position.set(p.pos.x,p.pos.y+1,p.pos.z);fireOrbs.children.forEach((o,i)=>{const a=W.time*4+i*TAU/3;o.position.set(Math.cos(a)*1.6,0,Math.sin(a)*1.6)});
  if(Math.random()<.5)emit(fireOrbs.children[0].getWorldPosition(new V3()),1,{c:[3,1,.2],spd:.3,life:.4,up:1});
  for(const e of W.enemies)if(!e.dead&&!e.T.st&&e.pos.distanceTo(p.pos)<2.4){e.hp-=30*dt;if(e.hp<=0)kill(e)}}else fireOrbs.visible=false;
 parryM.visible=p.parry>0;parryM.position.set(p.pos.x,p.pos.y+1*W.grav,p.pos.z);parryM.scale.setScalar(1+(.3-Math.max(p.parry,0))*1.5);
 if(p.sight>0&&Math.random()<.3){for(const i of W.inter)emit(new V3(i.p.x,i.p.y+.5,i.p.z),2,{c:[.5,1.4,3],spd:.3,up:5,g:0,life:1,size:.3});for(const e of W.enemies)if(!e.dead)emit(ec(e).add(new V3(0,e.h*.6,0)),1,{c:[3,.5,.3],spd:.2,g:0,life:.5,size:.3})}
 barrierM.visible=p.barrier>0;barrierM.position.set(p.pos.x,p.pos.y+.9,p.pos.z);
 if(S.post&&S.skin==2&&Math.random()<.4)emit(pl.tip.getWorldPosition(new V3()),1,{c:[1.5,1.3,3],spd:.4,g:0,life:.8,size:.12});
 if(pl.dode)pl.dode.rotation.y+=dt*2;
 // animation
 const hs=Math.hypot(p.vel.x,p.vel.z);p.ph+=dt*hs*1.6;let arm=null;PH.hips.rotation.x=0;
 if(p.atk){const k=p.atk.t/p.atk.dur,sd=p.atk.n%2?-1:1;arm=k<.35?lerp(0,-2.5,k/.35):k<.6?lerp(-2.5,-.2,(k-.35)/.25):-.2*(1-(k-.6)/.4);PH.hips.rotation.y=(k<.35?-.5*k/.35:lerp(-.5,.6,clamp((k-.35)/.25,0,1)))*sd}
 else PH.hips.rotation.y*=.8;if(p.grap)arm=-1.6;if(p.dodge>0&&!S.dash)PH.hips.rotation.x=(1-p.dodge/.28)*TAU;if(p.dodge>0&&S.dash)PH.hips.rotation.x=.6;
 animH(PH,p.ph,p.onGround?Math.min(hs/6,1.3):.3,arm,S.weapon=='aegis'&&S.stance==0?-1.2:null);
 PH.cape.rotation.x=.12+Math.min(hs/10,1)*.8+Math.sin(W.time*6)*.05;PH.g.position.copy(p.pos);PH.g.rotation.set(0,p.face,g<0?PI:0);
 PH.g.visible=!(p.inv>0&&p.dodge<=0&&!p.grap&&Math.floor(W.time*30)%2)}
// actions
function jump(){if(pl.onGround){pl.vel.y=10*W.grav;pl.onGround=false}else if(S.post&&!pl.grap){pl.vel.y=9*W.grav;emit(pl.pos,20,{c:[2,1.6,.6],spd:3})}}
function dodge(){const p=pl;if(p.dodge>0||p.grap||p.st<18)return;const air=!p.onGround;if(air&&!S.dash&&!S.post)return;if(air&&p.air<=0&&!S.post)return;if(air)p.air--;
 let d=inputDir();if(!d.lengthSq())d.set(Math.sin(p.face),0,Math.cos(p.face));p.dodge=S.dash?.3:.28;p.dd.copy(d).multiplyScalar(S.dash?24:15);p.inv=S.dash?.45:.32;p.st-=18;p.atk=null;p.face=Math.atan2(d.x,d.z)}
function spark(){if(!S.spark)return;if(S.miasma){toast('The Miasma smothers your Spark…');return}if(pl.sp<25)return;pl.sp-=25;const cf=camera.getWorldDirection(new V3()),o=PH.hand.getWorldPosition(new V3());
 shoot(o,camera.position.clone().addScaledVector(cf,60).sub(o).normalize(),{spd:36,col:wcol(),pc:colA(wcol(),2),dmg:40*(S.unified?1.5:1)*S.atk*(S.house==0?1.15:1),aoe:3.5,pl:1,sz:1.5});emit(o,20,{c:colA(wcol(),3),spd:4,life:.3})}
function grapple(){if(!S.grapple||pl.grap)return;const t=grapTarget();if(t)startGrapple(t)}
function stanceSw(){if(WEAP[S.weapon].st.length<2)return;S.stance^=1;buildWeapon();toast(stance().n);emit(new V3(pl.pos.x,pl.pos.y+1,pl.pos.z),40,{c:colA(wcol(),3),spd:4,life:.4})}
function interact(){let b=null,bd=2.8;for(const i of W.inter){const d=Math.hypot(i.p.x-pl.pos.x,i.p.z-pl.pos.z);if(d<bd&&Math.abs(i.p.y-pl.pos.y)<3){bd=d;b=i}}
 if(!b)return;if(b.keep)return b.fn();W.inter.splice(W.inter.indexOf(b),1);if(b.o)W.grp.remove(b.o);b.r()}
function god(){if(pl.meter<100)return;pl.meter=0;pop(S.align=='athena'?'AEGIS BARRIER':S.align=='ares'?'PLASMA ERUPTION':'PRIMORDIAL SURGE');if(S.align!='athena'){const c=new V3(pl.pos.x,pl.pos.y+.5,pl.pos.z);emit(c,250,{c:[3,1,.3],spd:14,up:3,life:1,size:.5});shake(.9);hitstop=.1;
  const r=mesh(new THREE.RingGeometry(.5,1,48).rotateX(-PI/2),glow(0xff6020,4,.9),false);r.position.copy(c);fx(r,.5,(o,k)=>{o.scale.setScalar(1+k*9);o.material.opacity=.9*(1-k)});
  for(const e of W.enemies)if(!e.dead&&e.pos.distanceTo(pl.pos)<9+e.r)hurtE(e,90*S.atk,8,2)}else{pl.barrier=5;toast('Aegis Barrier — invulnerable & reflecting!')}}
function potion(){if(S.potions<1||pl.hp>=S.maxHp)return;S.potions--;pl.hp=Math.min(S.maxHp,pl.hp+60);emit(pl.pos,60,{c:[.4,2.5,.6],spd:2,up:2,life:1})}

// ================= camera =================
const cam={yaw:PI,pitch:.3,dist:6.5,shake:0,pos:new V3()};let hitstop=0;const shake=k=>cam.shake=Math.max(cam.shake,k);
function updCam(dt){const g=W.grav||1,tgt=new V3(pl.pos.x,pl.pos.y+1.6*g,pl.pos.z),cp=Math.cos(cam.pitch),f=new V3(Math.sin(cam.yaw)*cp,-Math.sin(cam.pitch)*g,Math.cos(cam.yaw)*cp),
 r=new V3(-Math.cos(cam.yaw),0,Math.sin(cam.yaw)),want=tgt.clone().addScaledVector(f,-cam.dist).addScaledVector(r,.7);
 if(g>0){const gy=groundAt(want.x,want.z,want.y+2);if(want.y<gy+.4)want.y=gy+.4}
 cam.pos.lerp(want,1-Math.exp(-dt*14));camera.position.copy(cam.pos);if(cam.shake>.01){camera.position.x+=rand(-1,1)*cam.shake*.3;camera.position.y+=rand(-1,1)*cam.shake*.3}
 cam.shake*=Math.exp(-dt*7);camera.lookAt(tgt.addScaledVector(r,.7).addScaledVector(f,8))}

// ================= script helpers =================
let RUN=0,mode='menu',lockT=0;
const pend=setup=>{const id=RUN;return new Promise(r=>setup(v=>{if(id===RUN)r(v)}))};
const until=c=>pend(r=>W.waiters.push({c,r})),wait=s=>{const t=W.time+s;return until(()=>W.time>=t)},killAll=l=>until(()=>l.every(e=>e.dead));
const inter=(p,label,o,opt)=>pend(r=>W.inter.push({p,label,o,r,opt}));
const ui=Object.fromEntries(['hud','hp','st','sp','info','keys','obj','boss','bossN','bossHp','prompt','gm','toasts','dlg','dlgS','dlgT','modal','card','fade','flash','menu','hub','pause','dead','pop','compass','mtr','xp','creator'].map(k=>[k,$(k)]));
const obj=t=>ui.obj.textContent=t,toast=t=>{const d=document.createElement('div');d.className='t';d.innerHTML=t.replace(/[<>&]/g,'').replace(/\[(\w+)\]/g,'<span class=kb>$1</span>');ui.toasts.appendChild(d);setTimeout(()=>d.remove(),6000)},tip=t=>toast(t),pop=t=>{ui.pop.textContent=t;ui.pop.classList.remove('show');void ui.pop.offsetWidth;ui.pop.classList.add('show')};
const fade=v=>pend(r=>{ui.fade.style.opacity=v;setTimeout(r,700)});
function flash(){ui.flash.animate([{opacity:.9},{opacity:0}],{duration:600})}
const lock=()=>{lockT=performance.now();try{renderer.domElement.requestPointerLock()?.catch?.(()=>{})}catch(e){}};
const D={q:[],r:null};
function say(lines){return pend(r=>{D.q=lines.slice();D.r=r;mode='dlg';ui.dlg.style.display='block';nextLine()})}
function nextLine(){const l=D.q.shift();if(!l){ui.dlg.style.display='none';mode='play';if(!document.pointerLockElement)lock();const r=D.r;D.r=null;r?.();return}
 ui.dlgS.textContent=l[0];ui.dlgT.textContent=l[1];ui.dlgT.style.animation='none';ui.dlgT.offsetWidth;ui.dlgT.style.animation='';ui.dlg.classList.toggle('narr',!l[0])}
function choose(title,text,opts){return pend(r=>{mode='modal';document.exitPointerLock();
 ui.modal.innerHTML=`<h2>${title}</h2><p>${text}</p><div class=opts>${opts.map((o,i)=>`<button data-i=${i}><b>${i+1}. ${o[0]}</b><span>${o[1]}</span></button>`).join('')}</div>`;
 ui.modal.style.display='flex';ui.modal.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;ui.modal.style.display='none';mode='play';lock();r(+b.dataset.i)}})}
function portal(x,y,z){const g=new THREE.Group();g.add(mesh(new THREE.TorusGeometry(1.6,.12,12,48),glow(0x80c0ff,4),false),mesh(new THREE.CircleGeometry(1.55,40),glow(0x4080ff,1.2,.5),false));
 add(g,x,y+1.9,z);g.userData.face=1;W.spin.push(g);W.emitters.push({p:g.position,rate:40,o:{c:[.6,1,3],spd:1.5,g:0,life:1,r:1.2,size:.2}});
 return until(()=>Math.hypot(pl.pos.x-x,pl.pos.z-z)<2.2&&Math.abs(pl.pos.y-y)<3).then(complete)}
function npc(x,z,o,flame){const H=humanoid(o);add(H.g,x,Math.max(groundAt(x,z,60),0),z);H.g.rotation.y=Math.atan2(-x,-z);
 if(flame)W.emitters.push({p:new V3(x,H.g.position.y+2.0*(o.s||1),z),rate:25,o:{c:colA(flame,2.5),up:2,g:1,spd:.5,life:.6,size:.3,r:.12}});return H}
function ichor(x,y,z){if(!S.nymphs||S.sh.includes(W.idx))return;const o=add(mesh(new THREE.OctahedronGeometry(.35),glow(0xffd060,3),false),x,y+1.2,z);W.spin.push(o);
 inter(new V3(x,y,z),'Take Ichor Shard',o,1).then(()=>{S.sh.push(W.idx);S.maxHp+=10;pl.hp+=10;toast('Ichor Shard — +10 Max HP')})}
const isle=(x,z,r)=>{cyl(x,-4,z,r,8,mat(0x5a5448),true,32,r*.7);cyl(x,.03,z,r*.97,.06,mat(0x4a6a38),false,32);for(let i=0;i<4;i++){const a=rand(0,TAU);rock(x+Math.cos(a)*r*.8,.2,z+Math.sin(a)*r*.8,rand(.4,1),mat(0x6a6458))}};

// ================= levels =================
const LV=[
{act:'Act I · The Sparks of Rebellion',name:'The Iron Siphon',th:{bg:0x140d08,fog:.032,hemi:[0xb08060,0x100804,.5],sun:[0xffa060,.3],env:.12,g1:0x221a14,g2:0x403226,R:30,wall:40,cave:1,amb:{c:[1.6,.6,.2],n:20,g:.5,life:4,size:.1,spd:.3}},
async run(){for(let i=0;i<6;i++){const a=i/6*TAU+.3;torch(Math.cos(a)*22,Math.sin(a)*22)}
 const wood=mat(0x4a3220),iron=mat(0x3a3a40,{m:.8,r:.4});for(let i=0;i<7;i++){const a=rand(0,TAU),r=rand(12,24);block(Math.cos(a)*r,.5,Math.sin(a)*r,1.2,1,1.2,wood)}
 for(const x of[-14,-12.6])block(x,.08,0,.15,.15,40,iron,false);player(0,12);
 await say([['Overseer','Swing, slave! Every vein of Stygian Iron feeds the forges of Kronos.'],['You','(The trench has no sky. No name. Only the pick.)']]);
 tip('[WASD] move · [Shift] sprint · [Space] jump');tip('[LMB] light attack · [RMB] heavy attack');tip('Follow the ◆ on the compass to your objective');
 const ores=[[7,2],[-9,-4],[2,-11]].map(([x,z])=>spawn('ore',x,z));
 await until(()=>{const n=ores.filter(e=>e.dead).length;obj(`Mine the Stygian Iron veins — ${n}/3`);return n==3});
 shake(1.5);flash();emit(new V3(0,8,-8),300,{c:[3,3,4],spd:14,life:1.2,size:.5});
 await say([['Zeus','OLYMPIANS! Tear Othrys from its roots!'],['','Lightning splits the trench. The floor collapses — you plunge into an ancient vault below…']]);
 await fade(1);W.lights.forEach(L=>L.color.set(0x5080ff));W.emitters.forEach(e=>e.o.c=[.6,1,2.6]);scene.fog.color.set(0x070a14);scene.background.set(0x070a14);
 for(let i=0;i<14;i++)rock(rand(-22,22),0,rand(-8,22),rand(.5,1.4),mat(0x2a2a30));
 const cz=-20,bars=[];block(0,1.6,cz-2.5,8.5,3.2,.5,iron);for(const x of[-4.2,4.2])block(x,1.6,cz,.4,3.2,5,iron);block(0,3.3,cz,8.6,.3,5.4,iron);
 for(let i=0;i<9;i++)bars.push(cyl(-4+i,1.6,cz+2.3,.07,3.2,iron,false,6));const cageCol={x0:-4.2,x1:4.2,z0:cz+2.1,z1:cz+2.5,bot:0,top:3.2};W.cols.push(cageCol);
 const kids=[-2,0,2].map(x=>npc(x,cz,{s:.55,cloth:0x5a4a3a,skin:0xc08a68,hs:x?1:3}));kids.forEach(k=>k.g.rotation.y=0);
 player(0,12);await fade(0);tip('[Q] dodge roll — invulnerable while rolling');tip('When a yellow ! flashes over a foe press [C] to parry and counter. Red ! — dodge!');obj('Survive the Vault Sentinels');
 await killAll([spawn('grunt',-6,-4),spawn('grunt',6,-4),spawn('grunt',0,-8)]);
 obj('Investigate the sealed cell');await inter(new V3(0,0,cz+3.5),'Inspect the cell');
 const c=await choose('Mortal Fates','Children of the trench huddle behind iron bars. A dead guard nearby clutches a glowing core. Above you, the tunnel is collapsing.',
  [['Path of Xenia','Pry open their cell. (+Xenia · a Mortal Merchant joins your hub and sells cheaper potions)'],['Path of Hubris','Leave them. Take the glowing core. (+Hubris · permanent +20% attack power)']]);
 if(c==0){S.xen++;S.merchant=true;bars.forEach(b=>W.grp.remove(b));W.cols.splice(W.cols.indexOf(cageCol),1);kids.forEach(k=>fx(k.g,3,o=>{o.position.z+=.12;o.rotation.y=0}));
  await say([['Child','You came back for us… we will remember. Our family will remember!']])}
 else{S.hub++;S.atk*=1.2;emit(new V3(pl.pos.x,1,pl.pos.z),80,{c:[3,1,.3],spd:5});await say([['You','(The core burns in your palm. Their cries fade behind you.)']])}
 obj('Escape through the rift');await portal(0,0,18)}},
{act:'Act I · The Sparks of Rebellion',name:'Altar of Ignition',th:{bg:0x080a12,fog:.03,hemi:[0x6080b0,0x080604,.5],sun:[0x8090ff,.3],env:.15,g1:0x1a1c24,g2:0x3a342c,R:32,wall:40,cave:1,amb:{c:[.5,.9,2.5],n:18,g:.2,life:4,size:.1,spd:.3}},
async run(){for(let i=0;i<6;i++){const a=i/6*TAU;torch(Math.cos(a)*20,Math.sin(a)*20,0x4a80ff)}const st=mat(0x4a4a52,{r:.7}),mt=mat(0x202024,{m:.9,r:.3});
 cyl(0,.25,-6,3.2,.5,st);block(0,1,-6,1.4,1,.8,mt);block(0,1.65,-6,2.4,.3,1,mt);const rr=add(mesh(new THREE.TorusGeometry(2.8,.05,6,64).rotateX(PI/2),glow(0x60a0ff,3),false),0,.55,-6);
 for(let i=0;i<8;i++){const a=i/8*TAU+.2;column(Math.cos(a)*14,Math.sin(a)*14,9,st)}player(0,14);
 await say([['','A vault older than the Titans. At its heart, an anvil hums with a light that has no source.']]);
 obj('Touch the primordial anvil');await inter(new V3(0,0,-4.4),'Touch the anvil');
 S.spark=true;buildPlayer();shake(1.2);flash();emit(new V3(0,1.8,-6),300,{c:[1,2,4],spd:10,life:1.4,size:.4});rr.material.color.set(0xffffff).multiplyScalar(5);
 await say([['???','…a spark from before Time. It has chosen you.'],['','Cosmic fire floods your veins. THE FIRST SPARK is awake.']]);
 tip('[F] Spark Blast — aim with the camera');tip('[T] Spark Sight — reveal secrets and foes nearby');tip('Fighting fills the gold meter — [X] unleashes a Primordial Surge');
 const hades=npc(10,-14,{cloth:0x14141e,skin:0xb0a8a0,hair:0x101010,robe:1,beard:1,hs:2},0x4060ff);
 await say([['Hades','You — mortal! If that light is what I think it is… USE IT!']]);obj('Save the hooded god from the Titan Wardens');
 await killAll([spawn('grunt',6,-8),spawn('grunt',14,-6),spawn('archer',4,-18),spawn('brute',12,-18)]);
 await say([['Hades','Hades, eldest son of Kronos. And you… you are the prophecy my father fears.'],['Hades','Hold still—']]);
 await fade(1);W.lights.forEach(L=>L.color.set(0xffb060));W.emitters.forEach(e=>e.o.c=[2.5,1.2,.4]);scene.fog.color.set(0x140c06);scene.background.set(0x140c06);
 hades.g.position.set(5,0,4);W.emitters.at(-1).p.set(5,2.4,4);npc(-5,4,{cloth:0xe8e0d0,hair:0xdadada,robe:1,beard:1.5,hs:2},0x80c0ff);player(0,12);await fade(0);
 await say([['','The OLYMPUS BUNKER — a war-camp hidden inside a storm.'],['Zeus',`Swear it, ${S.name} of the ${HOUSES[S.house].n.slice(9)}. Swear your fire to the rebellion.`],['You','I swear it.'],['Hades','Then the forge is yours. Choose — it will carry your Spark to the end of Time.']]);
 const w=await choose('The Forge','Choose your signature weapon. Each has two stances — switch any time with R.',[
  ['Aetheric Dodecahedron Staff','Sword Stance: rapid energy-blade thrusts. Whip Stance: long laser tethers that slice whole groups.'],
  ['Aegis Sektor','Shield Stance: hard-light tower shield (−50% damage taken). Axe Stance: heavy shield-shattering armor damage.'],
  ['Stygian Claws','Dagger Stance: ultra-fast dual slashes. Dart Stance: long-range rope-dart — heavy attack pulls you to the target.']]);
 S.weapon=['staff','aegis','claws'][w];S.stance=0;buildWeapon();tip('[R] switch weapon stance');shake(.8);
 await say([['Hades','The IRON WARDEN followed my shadow-path! Show it what you are!']]);
 const b=spawn('warden',0,-16);obj('Defeat THE IRON WARDEN');await killAll([b]);
 await say([['Zeus','The Warden falls! Every chained mortal on Othrys will hear of this.']]);obj('Enter the rift');await portal(0,0,-8)}},
{act:'Act II · The Elemental Forges',name:'Tempest Bastion',th:{bg:0x7a8a98,fog:.011,hemi:[0xa0b8d0,0x203040,.9],sun:[0xe0ecff,1.8],sky:{e:14,a:200,t:10,r:2},env:.7,g1:0x3a4a3a,g2:0x6a6a58,R:110,wall:60,fy:-12,floor:0,killY:-1.2,water:1,amb:{c:[.7,.9,1.2],n:25,g:-1,life:3,size:.07,spd:2}},
async run(){isle(0,0,12);isle(0,-32,14);block(0,-.5,-15,4,1,8,mat(0x5a4030));isle(0,-62,6);isle(24,-60,5);isle(0,-90,9);
 for(const[x,z]of[[14,-20],[-15,-48],[12,-78],[-13,-80]]){const t=add(mesh(new THREE.TorusGeometry(3,.25,8,48).rotateX(PI/2),glow(0xc0f0ff,1.5,.35),false),x,-.5,z);W.spin.push(t);W.emitters.push({p:t.position,rate:15,o:{c:[.8,1,1.3],spd:2,g:0,life:1,r:2.5,size:.25}})}
 for(let i=0;i<5;i++){const s=add(new THREE.Group(),rand(-60,60),-.6,rand(-130,-100));s.add(mesh(boxGeo(2,1,7),mat(0x3a2a18)),mesh(boxGeo(.15,5,.15),mat(0x3a2a18)));s.children[1].position.y=2.5}
 anchor(0,6,-49);anchor(0,6,-77);anchor(12,6,-57);player(0,6);
 await say([['Zeus','Oceanus has caged Poseidon’s fleet behind living whirlpools.'],['Zeus','His Elite General holds the bastion. Break him, and your weapon will drink the fury of the sea.']]);
 let nym=0;for(const[x,z]of[[6,4],[-9,-38],[24,-60]]){const o=add(mesh(new THREE.SphereGeometry(.35,16,12),glow(0x60e0ff,3),false),x,1.2,z);W.emitters.push({p:o.position,obj:o,rate:12,o:{c:[.5,1.5,2.5],spd:.6,g:.5,life:1,size:.2}});
  inter(new V3(x,0,z),'Free the Nymph',o,1).then(()=>{nym++;toast(`Nymph freed (${nym}/3)`);if(nym==3){S.nymphs=true;S.maxHp+=30;pl.hp=S.maxHp;toast('The Nymphs reveal hidden ICHOR SHARDS across the world! +30 Max HP')}})}
 tip('Side Quest: The Lost Nymphs of Arcadia — free 3 water spirits');obj('Defeat Oceanus’ Elite General');
 await killAll([spawn('general',0,-38),spawn('grunt',-5,-30),spawn('grunt',5,-30),spawn('archer',-8,-40),spawn('archer',8,-42)]);
 S.dash=S.grapple=true;shake(.8);emit(new V3(pl.pos.x,1,pl.pos.z),200,{c:[.4,1.4,3],spd:8,life:1});
 await say([['','Seawater floods your weapon core. It drinks the tide.'],['','AQUATIC DASH and GRAPPLE HOOK unlocked.']]);
 tip('[Q] in mid-air — Aquatic Dash');tip('[G] grapple to the golden ring you aim at — or onto an enemy');
 obj('Grapple across the whirlpool gaps to the far shore');await portal(0,0,-92)}},
{act:'Act II · The Elemental Forges',name:'The Obsidian Crags',th:{bg:0x5a2414,fog:.015,hemi:[0xffa070,0x401008,.7],sun:[0xffb080,2.2],sky:{e:5,a:110,t:20,r:3},env:.5,exp:.95,g1:0x1a1210,g2:0x3a2a20,R:70,wall:45,fy:-3,floor:0,killY:-.2,lava:1,bloom:.9,amb:{c:[2,.7,.2],n:40,g:.8,life:3,size:.1,spd:.5}},
async run(){const bas=mat(0x24201e,{r:.9}),plat=(x,z,w,top)=>block(x,top-1.5,z,w,3,w,bas),towers=[],eyes=[];plat(0,0,16,0);
 for(let k=0;k<3;k++){const a=k*TAU/3-PI/2,P=r=>[Math.cos(a)*r,Math.sin(a)*r];plat(...P(12.5),4,.4);if(k<2)plat(...P(19),4,.8);else{const[x,z]=P(18);anchor(x,6,z)}
  plat(...P(27),10,1.2);towers.push(spawn('tower',...P(29.5)));if(k==0){spawn('grunt',...P(25));spawn('grunt',...P(26))}if(k==1){spawn('archer',...P(25));spawn('grunt',...P(26))}if(k==2)spawn('brute',...P(25));
  const b=a+PI/3;eyes.push(spawn('eye',Math.cos(b)*20,Math.sin(b)*20,5.5))}
 for(let i=0;i<30;i++){const a=rand(0,TAU),r=rand(40,70);rock(Math.cos(a)*r,0,Math.sin(a)*r,rand(1,4),bas)}ichor(...[Math.cos(PI/6)*27,1.2,Math.sin(PI/6)*27]);player(0,4);
 await say([['Demeter','Hyperion’s solar lenses have burned my fields to glass. Shatter his towers!'],['Helios','…Psst. Spark-bearer. Kronos watches me through his spy-eyes. Blind them, and I’ll make your road to Othrys… cooler.']]);
 tip('Side Quest: Helios’s Blindspot — destroy the 3 floating spy-eyes (Spark Blast or Grapple)');
 until(()=>eyes.every(e=>e.dead)).then(()=>{S.helios=true;toast('Helios: “The eyes are dark. I will remember this at Othrys.”')});
 await until(()=>{const n=towers.filter(e=>e.dead).length;obj(`Destroy Hyperion’s solar towers — ${n}/3`);return n==3});
 S.melt=true;buildWeapon();emit(new V3(pl.pos.x,1,pl.pos.z),200,{c:[3,1,.2],spd:8,life:1});await say([['','Solar fire pours into your weapon. MELTING STANCE infused — your strikes now burn.']]);
 const c=await choose('Rebellion Strategy','The war council splits. Whose doctrine will shape your Spark?',[['Align with Ares','Offensive god power: PLASMA ERUPTION (X) — a massive burst around you.'],['Align with Athena','Defensive god power: AEGIS BARRIER (X) — 5s of invulnerability that reflects projectiles.']]);
 S.align=c?'athena':'ares';tip('[X] '+(c?'Aegis Barrier':'Plasma Eruption')+' — now powers your full gold meter');obj('Return to the rift');await portal(0,0,-5)}},
{act:'Act III · The Tartarus Jailbreak',name:'The Inverted Vaults',th:{bg:0x06040e,fog:.012,hemi:[0x8060d0,0x100820,.8],sun:[0xb0a0ff,1.3],env:.3,void:1,floor:0,killY:-30,bloom:.9,amb:{c:[.8,.5,2],n:30,g:0,life:3,size:.1,spd:.6}},
async run(){const vs=mat(0x2a2638,{r:.8,m:.2}),rune=glow(0x9060ff,2.5);
 for(const[x,t,z,w,d]of[[0,0,0,12,12],[0,2,-16,8,8],[12,4,-27,6,6],[-12,5,-28,6,6],[0,7,-40,10,10],[16,9,-46,6,6],[26,11,-36,8,8],[-14,9,-46,6,6]]){block(x,t-1,z,w,2,d,vs);add(mesh(boxGeo(w*1.02,.08,d*1.02),rune,false),x,t-2,z)}
 block(0,23,-28,56,2,56,vs);for(let i=0;i<30;i++){const s=add(mesh(new THREE.ConeGeometry(rand(.3,.8),rand(1.5,4),6),glow(0x7040ff,1.5)),rand(-26,26),20.5,rand(-54,0));s.rotation.x=PI}
 for(const p of[[6,7,-22],[-6,9,-36],[20,15,-42],[0,16,-28],[-14,15,-46]])anchor(...p);
 const py=[spawn('pylon',0,-42),spawn('pylon',26,-36),spawn('pylon',-10,-20,22)];py[2].root.rotation.z=PI;py[2].cy=-2.5;ichor(16,9,-46);player(0,4);
 W.gt=12;W.ht=3;W.tick=dt=>{W.gt-=dt;if(W.grav>0&&W.gt<2&&!W.warn){W.warn=1;toast('⚠ Gravity inverting!')}
  if(W.gt<=0){W.grav*=-1;W.gt=W.grav>0?12:8;W.warn=0;shake(.5);pl.vel.y=0;toast(W.grav<0?'Gravity inverted — walk the ceiling!':'Gravity restored!')}
  if((W.ht-=dt)<=0&&W.enemies.filter(e=>!e.dead&&e.t=='harpy').length<5){W.ht=6;spawn('harpy',pl.pos.x+rand(-15,15),pl.pos.z+rand(-15,15),pl.pos.y+8*W.grav)}};
 await say([['Hades','Tartarus. Down here, even gravity serves the Titans.'],['Hades','Three seal-pylons bind the Elder Giants. One hangs from the vault ceiling — wait for the inversion, or blast it from below.']]);
 await until(()=>{const n=py.filter(e=>e.dead).length;obj(`Shatter the seal-pylons — ${n}/3`);return n==3});
 W.tick=null;if(W.grav<0){W.grav=1;toast('Gravity restored!')}obj('Descend to the Warden’s Cage');await portal(0,7,-40)}},
{act:'Act III · The Tartarus Jailbreak',name:'The Warden’s Cage',th:{bg:0x12040a,fog:.018,hemi:[0xd06070,0x200508,.7],sun:[0xff7080,1.5],env:.3,void:1,R:24,killY:-30,bloom:.9,amb:{c:[2,.3,.3],n:25,g:.6,life:3,size:.1,spd:.5}},
async run(){arena(0x2a2024,0xff3030);for(let i=0;i<3;i++){const a=i/3*TAU+PI/2,H=humanoid({s:5,bulk:1.5,cloth:0x2a2a2a,skin:0x5a4a40,eye:0xff4020,beard:1.3,hs:4});add(H.g,Math.cos(a)*42,-6,Math.sin(a)*42);H.g.rotation.y=Math.atan2(-Math.cos(a),-Math.sin(a));H.hips.rotation.x=.4}
 player(0,14);await say([['Kampe','The Spark-bearer… the prophecy crawls into MY cage?'],['Kampe','I will unmake you thread by thread!']]);
 tip('Kampe is relentless up close — dodge her combos and punish the gaps.');const b=spawn('kampe',0,-10);b.H.wings.visible=false;obj('Defeat WARDEN KAMPE');await killAll([b]);
 await say([['','Kampe shatters. The master chains scream — and break.'],['Kampe','(dying) You… freed them… but my poison… is already in your blood… MIASMA…'],['','Black ichor seeps into your veins. Your Spark gutters like a dying candle.'],['Giants','WE ARE FREE. WE WILL FORGE THE WEAPONS OF THE GODS.']]);
 S.miasma=true;buildPlayer();document.body.classList.add('miasma');toast('Cursed by MIASMA — Spark Blast sealed');obj('Enter the rift');await portal(0,0,0)}},
{act:'Act IV · The Shadow of Miasma',name:'The Ash-Weeping Ascent',th:{bg:0x5a5652,fog:.018,hemi:[0xa0a0a8,0x302820,.8],sun:[0xd8d0c8,1.2],sky:{e:20,a:160,t:20,r:4},env:.5,g1:0x3a3632,g2:0x5a5450,R:60,wall:70,fy:-35,floor:0,killY:-12,amb:{c:[.7,.7,.7],n:60,g:-.6,life:5,size:.12,spd:.6}},
async run(){const rk=mat(0x4a4642,{r:.95}),col=(x,z,w,top)=>block(x,(top-40)/2,z,w,top+40,w,rk);col(0,22,8,0);const L=[];
 for(let i=1;i<=12;i++){const a=PI/2+i*.48,x=Math.cos(a)*18,z=Math.sin(a)*18;col(x,z,6,i*1.5);L.push([x,z])}col(0,0,12,19.5);anchor(4.5,23,7.8);anchor(-14,10,0);
 for(let i=0;i<5;i++){const a=rand(0,TAU);rock(Math.cos(a)*5,19.5,Math.sin(a)*5,rand(.4,.9),rk)}
 ichor(L[9][0],15,L[9][1]);player(0,22);
 await say([['Athena','The Miasma devours your Spark. No blasts — only steel, dash and hook.'],['Athena','Climb to Hestia’s temple at the summit of Parnassus. Her hearth can burn the curse out.']]);
 const w1=[spawn('shade',...L[3]),spawn('shade',...L[4])],w2=[spawn('shade',...L[7]),spawn('shade',...L[8]),spawn('brute',...L[10])];
 obj('Ascend Mount Parnassus');await until(()=>pl.pos.y>19&&Math.hypot(pl.pos.x,pl.pos.z)<7);
 obj('Defeat the shadow sentries');await killAll([...w1,...w2,spawn('shade',3,-3),spawn('shade',-3,-3),spawn('shade',0,4)]);
 await say([['Athena','The temple stands just beyond the ash. Go.']]);obj('Enter the rift');await portal(0,19.5,0)}},
{act:'Act IV · The Shadow of Miasma',name:'The Eternal Pyre',th:{bg:0x2a1e28,fog:.02,hemi:[0x7068a0,0x201810,.7],sun:[0xffb070,1],sky:{e:2,a:250,t:8,r:3},env:.4,g1:0x3a3434,g2:0x6a6058,R:30,wall:30,amb:{c:[1.8,.8,.3],n:30,g:1,life:3,size:.1,spd:.4}},
async run(){const mb=mat(0xd8d0c4,{r:.45}),st=mat(0x5a5048);cyl(0,.02,0,27,.04,mb,false,64);for(let i=0;i<12;i++){const a=i/12*TAU;column(Math.cos(a)*18,Math.sin(a)*18,9,mb)}
 cyl(0,.4,0,2.4,.8,st);W.emitters.push({p:new V3(0,1,0),rate:120,o:{c:[3,1.4,.4],spd:1.2,up:4,g:1,life:1,size:.6,r:1}});torch(0,0,0xffffff,-1.5);
 for(const[x,z]of[[10,10],[-10,10],[10,-10],[-10,-10]])torch(x,z,0xff9040);
 const PC=new V3(0,0,-24),lit=[1,0,1,0],bz=[];npc(0,-27.5,{cloth:0x6a5030,skin:0xb08060,hair:0x3a2a1a,beard:1,hs:4},0xff8020);
 for(let i=0;i<4;i++){const a=i/4*TAU,x=PC.x+Math.cos(a)*3.5,z=PC.z+Math.sin(a)*3.5;cyl(x,.5,z,.35,1,st,true,8);cyl(x,1.1,z,.5,.2,mat(0x8a6a30,{m:.9,r:.3}),false,12,.3);
  const em={p:new V3(x,1.4,z),rate:0,o:{c:[3,1.2,.3],spd:.6,up:2,g:1,life:.6,size:.35,r:.15}};W.emitters.push(em);bz.push({p:em.p,em})}
 const sync=()=>bz.forEach((b,i)=>b.em.rate=lit[i]?40:0);sync();let solved=false;
 bz.forEach((b,i)=>W.inter.push({p:new V3(b.p.x,0,b.p.z),label:'Stir the flame',keep:1,opt:1,fn:()=>{if(solved)return;for(const j of[i,(i+1)%4,(i+3)%4])lit[j]^=1;sync();
  if(lit.every(x=>x)){solved=true;W.fs=true;W.inter=W.inter.filter(x=>!x.keep);emit(PC,150,{c:[3,1.2,.3],spd:6});toast('Prometheus: “Take my ember — it will shield you in the trial.”')}}}));
 player(0,20);await say([['Hestia','You carry the Underworld in your veins, child. My hearth can burn it out — but it will burn you too.'],['Hestia','Plunge your weapon and your hands into the Eternal Pyre. The shadows will come for you while it burns.']]);
 tip('Side Quest: Prometheus’s Hidden Ember — light all four braziers in the south chamber. Each flame stirs its neighbours.');
 obj('Plunge your weapon into the Eternal Pyre');await inter(new V3(0,0,2.6),'Plunge into the flame');
 if(W.fs){pl.fs=true;toast('Prometheus’s ember circles you!')}let T=45;W.st=0;
 W.tick=dt=>{T-=dt;obj(`Endure the purification — ${Math.ceil(Math.max(T,0))}s`);if((W.st-=dt)<=0&&W.enemies.filter(e=>!e.dead).length<9){W.st=2.2;const a=rand(0,TAU);spawn(Math.random()<.15?'brute':'shade',Math.cos(a)*22,Math.sin(a)*22)}};
 await until(()=>T<=0);W.tick=null;pl.fs=false;W.enemies.forEach(e=>kill(e));flash();shake(1.5);emit(new V3(0,2,0),400,{c:[3,2.4,1.5],spd:14,life:1.5,size:.5});
 S.miasma=false;S.unified=true;document.body.classList.remove('miasma');buildPlayer();
 await say([['','The white flame roars through you. The Miasma screams — and is gone.'],['Hestia','Your Spark and your weapon are one now. Go, and end this war.']]);toast('Miasma purged · Spark unified with your weapon');obj('Enter the rift');await portal(0,0,10)}},
{act:'Act V · The Fall of Othrys',name:'Citadel Collapse',th:{bg:0x2a2a34,fog:.016,hemi:[0x6a6a90,0x1a1010,.6],sun:[0xa0a8ff,1.2],sky:{e:8,a:300,t:20,r:5},env:.4,exp:.9,g1:0x1a1818,g2:0x2a2626,R:46,wall:50,bloom:.9,amb:{c:[2,.6,.2],n:30,g:.8,life:3,size:.1,spd:.5}},
async run(){const ob=mat(0x18161a,{m:.4,r:.6});for(let i=0;i<22;i++){const a=i/22*TAU;if(Math.abs(angD(a,-PI/2))<.3)continue;const w=add(mesh(boxGeo(13,16,3),ob),Math.cos(a)*48,8,Math.sin(a)*48);w.rotation.y=-a+PI/2}
 for(const[x,z]of[[20,-20],[-20,-20],[24,14],[-24,14]]){cyl(x,9,z,3,18,ob,true,12);anchor(x,21,z)}for(const x of[-7,7])cyl(x,7,-40,2.2,14,ob,true,12);
 const gate=spawn('gate',0,-40);gate.col={x0:-5,x1:5,z0:-40.6,z1:-39.4,bot:0,top:9};W.cols.push(gate.col);for(let i=0;i<10;i++)rock(rand(-30,30),0,rand(-25,25),rand(.5,1.5),ob);
 const vents=S.helios?[]:[[10,0],[-10,-6],[0,-16],[16,-24],[-16,8]];for(const[x,z]of vents)cyl(x,.1,z,1.2,.2,mat(0x3a1a10,{e:0xff3000,ei:1}),false);
 W.dt=2;W.vt=3;W.lt=4;W.tick=dt=>{if((W.dt-=dt)<=0){W.dt=2.4;hz({k:'circle',pos:new V3(pl.pos.x+rand(-5,5),0,pl.pos.z+rand(-5,5)),r:3,delay:1.3,dmg:20,rock:1})}
  if((W.vt-=dt)<=0){W.vt=3.2;for(const[x,z]of vents)hz({k:'circle',pos:new V3(x,0,z),r:2.6,delay:1,dmg:15,col:0xff8000})}
  if((W.lt-=dt)<=0){W.lt=rand(3,7);flash();hemi.intensity=3;setTimeout(()=>hemi.intensity=.6*(S.post?1.5:1),120)}};
 player(0,30);await say([['Zeus','This is it! Every god, every Giant, every freed mortal — CHARGE!'],['Zeus',`${S.name} — you are the tip of the spear. Break the gates of Othrys!`]]);
 toast(S.helios?'Helios kept his word — the fire traps lie dark.':'Helios’s fire vents still burn — watch the ground!');
 obj('Shatter the outer battalion');await killAll([spawn('grunt',-6,10),spawn('grunt',6,10),spawn('grunt',0,6),spawn('archer',-12,0),spawn('archer',12,0),spawn('grunt',0,0)]);
 obj('Break the Titan vanguard');await killAll([spawn('brute',-8,-10),spawn('brute',8,-10),spawn('grunt',0,-14),spawn('grunt',-4,-18),spawn('archer',10,-22),spawn('archer',-10,-22)]);
 obj('Shatter the Citadel Gate');await killAll([gate]);shake(2);flash();await say([['','The black gates of Othrys crack — and fall.']]);obj('Storm the throne room');await portal(0,0,-40)}},
{act:'Act V · The Fall of Othrys',name:'The Eye of Chronology',th:{bg:0x0e0a06,fog:.02,hemi:[0xc0a060,0x100804,.6],sun:[0xffd890,.6],env:.3,cave:1,g1:0x2a2014,g2:0x4a3a20,R:28,wall:40,bloom:1,amb:{c:[2,1.6,.6],n:25,g:.1,life:4,size:.1,spd:.3}},
async run(){const gd=mat(0x8a6a2a,{m:.9,r:.35}),dk=mat(0x1a1612,{m:.3,r:.6});cyl(0,.02,0,27,.04,dk,false,64);add(mesh(new THREE.TorusGeometry(20,.08,6,96).rotateX(PI/2),glow(0xffc040,2),false),0,.06,0);
 for(let i=0;i<10;i++){const a=i/10*TAU;column(Math.cos(a)*24,Math.sin(a)*24,14,gd)}block(0,.5,-25,10,1,5,gd);block(0,2.5,-26.5,3,4,1,gd);
 const clk=add(mesh(new THREE.TorusGeometry(7,.25,12,96),glow(0xffc040,3),false),0,9,-27);W.spin.push(clk);for(let i=0;i<6;i++){const a=i/6*TAU;torch(Math.cos(a)*21,Math.sin(a)*21,0xffb040)}
 add(mesh(new THREE.SphereGeometry(5,32,24),glow(0x60e0ff,1,.12),false),0,1.5,15);
 [[-2.5,0xd8d0c0],[0,0x1a4a6a],[2.5,0x101018]].forEach(([x,c])=>{const H=npc(x,15,{cloth:c,armor:0xa08040,beard:1.3,hs:2,hair:0xb0a8a0});H.g.rotation.y=PI;H.aR.rotation.x=-2.6});
 player(0,22);cam.yaw=PI;
 await say([['Kronos','Children. You came all this way to die in my hour.'],['','Kronos raises his scythe. Time SHATTERS — Zeus, Poseidon and Hades freeze mid-strike inside a bubble of stopped seconds.'],
  ['Kronos','…And yet you move. Of course. Your Spark was born in the void outside of Time.'],['You','Then Time has no claim on me.']]);
 tip('Phase 1: switch to your FASTEST stance — interrupt his time-rewind with rapid hits!');const b=spawn('kronos',0,-14);obj('Defeat KRONOS, THE TITAN KING');await killAll([b]);
 await say([['','Your weapon’s tethers coil around the scythe. You RIP it from his grasp and shatter his temporal core.'],['Kronos','No— not the void— not TARTARUS—'],['','Time resumes. The gods stagger free. Kronos is cast into the abyss.']]);
 const c=await choose('The Final Choice',`The broken scythe lies at your feet. The gods look to you. (Xenia ${S.xen} · Hubris ${S.hub})`,[
  ['The Vanguard Protector'+(S.xen>=S.hub?' ★':''),'Decline the throne. Return to the mortal realm as its eternal guardian, so the gods never abuse humanity.'],
  ['The Overlord of Time'+(S.hub>S.xen?' ★':''),'The Olympians are no better than the Titans. Banish Zeus, claim the scythe, rule as Emperor of Time.']]);
 S.ending=c;S.post=true;
 await choose(c?'The Overlord of Time':'The Vanguard Protector',c?'Zeus is cast down from the mountain he won. You sit upon the throne of Othrys, the broken scythe across your knees, and every clock in the cosmos ticks to your will.':
  'You lay the scythe at Zeus’s feet and walk back down the mountain. Wherever mortals cry out against the cruelty of gods, a spark of light answers.',[['Continue','The storm clears over Greece. ASCENDED OLYMPUS awaits — Chrono-Blink unlocked (infinite air-jumps & dashes), radiant replays, and the Memory Pool.']]);
 await complete()}},
{act:'Echoes of Othrys',name:'The Memory Pool',th:{bg:0x0a1420,fog:.012,hemi:[0xa0c0ff,0x102030,.8],sun:[0xffe0b0,1.6],env:.5,void:1,R:24,killY:-30,bloom:1,amb:{c:[1.5,1.6,2.5],n:25,g:.2,life:4,size:.1,spd:.4}},
async run(){arena(0x2a3440,0x60c0ff);player(0,14);await say([['','The Memory Pool ripples. Old enemies rise from it — faster, crueler, remembered wrong.']]);
 for(const[t,n]of[['warden','IRON WARDEN · ECHO'],['kampe','KAMPE · ECHO'],['kronos','KRONOS · ECHO']]){const b=spawn(t,0,-12,undefined,true);b.T={...b.T,boss:n};if(t=='kampe')b.H.wings.visible=false;
  obj('Conquer the Echoes: '+n);await killAll([b]);pl.hp=Math.min(S.maxHp,pl.hp+S.maxHp*.5);await wait(2)}
 S.gaunt=true;await say([['','The pool stills. In its reflection: a mortal child in the iron trench, looking up at a sky they have never seen — and a single spark falling toward them.'],['','(Secret ending unlocked · Constellation weapon skin unlocked)']]);await complete()}}];
function arena(c,rc){cyl(0,-1,0,24,2,mat(c,{r:.6,m:.3}),false,64);add(mesh(new THREE.TorusGeometry(20,.1,6,96).rotateX(PI/2),glow(rc,2.5),false),0,.05,0);
 for(let i=0;i<8;i++){const a=i/8*TAU;cyl(Math.cos(a)*29,4,Math.sin(a)*29,1.4,26,mat(c),false,12);
  const ch=mesh(new THREE.CylinderGeometry(.12,.12,1,6).rotateX(PI/2),glow(rc,1.5),false);add(ch,Math.cos(a)*15,10,Math.sin(a)*15);ch.lookAt(Math.cos(a)*29,16,Math.sin(a)*29);ch.scale.z=16}}

// ================= flow =================
function loadLevel(i){RUN++;W.idx=i;Sstart=JSON.stringify(S);resetWorld();const L=LV[i],t=L.th;applyTheme(t);base(t);
 W.floor=t.floor??true;W.R=t.R;W.killY=t.killY??-20;Object.assign(pl,{hp:S.maxHp,st:100,sp:100,dead:false,atk:null,grap:null,dodge:0,barrier:0,fs:false,gcd:0,meter:0,parry:0,pcd:0,sight:0,scd:0});tether.visible=false;
 buildPlayer();document.body.classList.toggle('miasma',S.miasma);[ui.menu,ui.hub,ui.dead,ui.modal].forEach(e=>e.style.display='none');ui.hud.style.display='block';ui.toasts.innerHTML='';
 ui.card.innerHTML=`<small>${L.act.toUpperCase()}</small><h1>${L.name}</h1>`;ui.card.classList.remove('show');void ui.card.offsetWidth;ui.card.classList.add('show');
 mode='play';obj('');lock();L.run().catch(e=>console.error(e))}
async function complete(){if(!S.post&&W.idx<9)S.lvl=W.idx+1;save();await fade(1);showHub();fade(0)}
function die(){pl.dead=true;mode='dead';document.exitPointerLock();ui.dead.style.display='flex'}
$('retry').onclick=()=>{S=JSON.parse(Sstart);loadLevel(W.idx)};
function showHub(){RUN++;mode='hub';document.exitPointerLock();ui.hud.style.display='none';menuScene();const cost=S.merchant?15:30,post=S.post;
 ui.hub.innerHTML=`<h1>${post?'Ascended Olympus Palace':'Olympus Bunker'}</h1>
 <div class=st>${S.name} · ${HOUSES[S.house].n} · Level ${S.plv}<br>${WEAP[S.weapon].st[0].n=='Pickaxe'?'Mining Pickaxe':{staff:'Aetheric Dodecahedron Staff',aegis:'Aegis Sektor',claws:'Stygian Claws'}[S.weapon]} · Max HP ${S.maxHp} · Attack ×${S.atk.toFixed(1)}${S.align?' · Aligned with '+S.align[0].toUpperCase()+S.align.slice(1):''}<br>
 Xenia ${S.xen} · Hubris ${S.hub} · ${S.dr} drachma · ${S.potions} potions${post?'<br>Ending: '+(S.ending?'The Overlord of Time':'The Vanguard Protector'):''}</div>
 <div><button data-a=buy>Buy Potion — ${cost} dr</button>${S.merchant?'<br><small>The Mortal Merchant you freed gives you a discount.</small>':''}</div>
 ${post?`<p style="margin:16px 0 6px;color:#c9a24a" class=cin>Replay with radiant skies · Chrono-Blink active</p><div class=grid>${LV.slice(0,10).map((l,i)=>`<button data-l=${i}>${i+1}. ${l.name}</button>`).join('')}</div>
 <div><button class=go data-l=10>⚔ The Memory Pool — Echoes of Othrys</button></div><div>Skin: ${['Standard','Radiant Gold','Constellation'].map((n,i)=>i<2||S.gaunt?`<button data-s=${i}>${S.skin==i?'▸ ':''}${n}</button>`:'').join('')}</div>`
 :`<div><button class=go data-l=${S.lvl}>Continue → ${LV[S.lvl].name}</button></div>`}<div><button data-a=menu>Main Menu</button></div>`;ui.hub.style.display='flex'}
ui.hub.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.a=='buy'){const c=S.merchant?15:30;if(S.dr>=c){S.dr-=c;S.potions++;save()}showHub()}
 if(d.a=='menu'){ui.hub.style.display='none';ui.menu.style.display='flex';mode='menu'}
 if(d.s){S.skin=+d.s;save();showHub()}if(d.l)loadLevel(+d.l)};
$('newg').onclick=()=>{S=structuredClone(S0);creator()};
$('cloud').onclick=async()=>{if(!API)return alert('Cloud saves need the online server.');const c=prompt('Your cloud save code — enter it on another device to continue there.\nPaste a different code to load that save:',PID);
 if(c&&c.trim()!==PID&&/^[\w-]{8,64}$/.test(c.trim())){PID=c.trim();try{localStorage.setItem('titano_id',PID)}catch(e){}await cloudLoad(true)}};
const hex=c=>'#'+c.toString(16).padStart(6,'0');
function creator(){mode='create';[ui.menu,ui.hub].forEach(e=>e.style.display='none');menuScene();buildPlayer();PH.g.position.set(9,0,6);ui.creator.style.display='flex';renderCreator()}
function renderCreator(msg=''){const B=(k,v,lab,on,st='',cl='')=>`<button class="${cl} ${on?'on':''}" data-k=${k} data-v=${v} ${st}>${lab}</button>`;
 ui.creator.innerHTML=`<div class=pan><h2>Forge Your Mortal</h2><label>Name</label><input id=nm maxlength=16 value="${S.name}">
 <label>Body</label><div>${B('sex','m','Masculine',S.sex=='m')}${B('sex','f','Feminine',S.sex=='f')}</div>
 <label>Skin tone</label><div>${SKINS.map((c,i)=>B('skinT',i,'',S.skinT==i,`style="background:${hex(c)}"`,'sw')).join('')}</div>
 <label>Hair</label><div>${HAIRS.map((n,i)=>B('hairS',i,n,S.hairS==i)).join('')}</div>
 <label>Hair colour</label><div>${HAIRC.map((c,i)=>B('hairC',i,'',S.hairC==i,`style="background:${hex(c)}"`,'sw')).join('')}</div>
 <label>House of the Rebellion</label>${HOUSES.map((h,i)=>B('house',i,`<b>${h.n}</b><span>Patron: ${h.p} · ${h.t}</span>`,S.house==i,`style="--c:${hex(h.c)}"`,'hs')).join('')}
 <button data-k=oracle>☉ Let the Oracle of Delphi choose</button><div class=orc>${msg}</div><button class=go data-k=begin>Begin the Rebellion</button></div>`}
ui.creator.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;const k=b.dataset.k,v=b.dataset.v;S.name=($('nm').value.replace(/[^\p{L}\p{N} '\-]/gu,'').trim()||'Spark-bearer').slice(0,16);let msg='';
 if(k=='begin'){ui.creator.style.display='none';save();loadLevel(0);return}
 if(k=='oracle'){S.house=Math.random()*4|0;msg=`The Pythia breathes the vapours… “${HOUSES[S.house].n}. ${HOUSES[S.house].q}”`}else S[k]=k=='sex'?v:+v;
 buildPlayer();PH.g.position.set(9,0,6);renderCreator(msg)};
function goal(){const po=W.spin.find(s=>s.userData.face);if(po)return po.position;if(W.boss)return W.boss.pos;let b=null,bd=1e9;const ck=p=>{const d=p.distanceToSquared(pl.pos);if(d<bd){bd=d;b=p}};
 for(const i of W.inter)if(!i.opt)ck(i.p);if(b)return b;for(const e of W.enemies)if(!e.dead&&!e.T.opt)ck(e.pos);return b}
function compass(){let h='';const at=(a,c,t)=>{const r=angD(a,cam.yaw);if(Math.abs(r)<1.6)h+=`<span class=${c} style="left:${50-r/1.6*50}%">${t}</span>`};
 for(const[l,a]of[['N',PI],['E',PI/2],['S',0],['W',-PI/2]])at(a,'',l);const br=p=>Math.atan2(p.x-pl.pos.x,p.z-pl.pos.z);
 if(pl.sight>0)for(const i of W.inter)if(i.opt)at(br(i.p),'rv','✦');const g=goal();if(g){const r=angD(br(g),cam.yaw);h+=`<span class=gm style="left:${50-clamp(r/1.6,-1,1)*50}%">◆<small>${Math.round(Math.hypot(g.x-pl.pos.x,g.z-pl.pos.z))}m</small></span>`}
 ui.compass.innerHTML=h}
$('cont').onclick=()=>{if(S.lvl>0||S.post)showHub();else loadLevel(0)};
ui.pause.onclick=()=>{ui.pause.style.display='none';mode='play';lock()};
function menuScene(){resetWorld();const t=S.post?{...LV[7].th,sky:{e:30,a:200,t:2,r:.6}}:LV[7].th;applyTheme(t);base(t);W.floor=true;W.R=30;
 const mb=mat(0xd8d0c4,{r:.45});cyl(0,.02,0,27,.04,mb,false,64);for(let i=0;i<12;i++){const a=i/12*TAU;column(Math.cos(a)*18,Math.sin(a)*18,9,mb)}
 W.emitters.push({p:new V3(0,1,0),rate:120,o:{c:[3,1.4,.4],spd:1.2,up:4,g:1,life:1,size:.6,r:1}});torch(0,0,0xff9a50,-1.5);if(PH)PH.g.visible=false}

// ================= input =================
const K={};
addEventListener('keydown',e=>{if(e.repeat)return;K[e.code]=1;if(e.target.tagName=='INPUT')return;if(e.code=='Space'||e.code=='Tab')e.preventDefault();
 if(mode=='dlg'){if(['Enter','Space','KeyE'].includes(e.code))nextLine();return}
 if(mode=='modal'){const b=ui.modal.querySelectorAll('button')[+e.code.slice(-1)-1];if(e.code.startsWith('Digit')&&b)b.click();return}
 if(mode=='play')({Space:jump,KeyQ:dodge,KeyF:spark,KeyG:grapple,KeyR:stanceSw,KeyE:interact,KeyX:god,KeyH:potion,KeyC:parry,KeyT:sight})[e.code]?.()});
addEventListener('keyup',e=>K[e.code]=0);addEventListener('blur',()=>{for(const k in K)K[k]=0});
document.addEventListener('mousedown',e=>{if(mode=='dlg'){nextLine();return}if(mode=='play'&&document.pointerLockElement)attack(e.button==2)});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{if(document.pointerLockElement&&(mode=='play'||mode=='dlg')){cam.yaw-=e.movementX*.0022;cam.pitch=clamp(cam.pitch+e.movementY*.0022,-.5,1.2)}});

// ================= loop =================
let last=performance.now(),hudT=0;
function frame(now){requestAnimationFrame(frame);let dt=clamp((now-last)/1000,0,.05);last=Math.max(last,now);
 if(mode=='play'&&!document.pointerLockElement&&now-lockT>1500){mode='pause';ui.pause.style.display='flex'}
 if(mode=='play'){if(hitstop>0){hitstop-=dt;dt*=.08}W.time+=dt;updPlayer(dt);for(const e of W.enemies)updEnemy(e,dt);W.enemies=W.enemies.filter(e=>!e.gone);
  updProj(dt);updHaz(dt);W.tick?.(dt);W.waiters=W.waiters.filter(w=>{if(w.c()){w.r();return false}return true});pl.gt=S.grapple?grapTarget():null}
 else if(mode!='pause')W.time+=dt;
 for(const f of FX){f.l-=dt;f.fn?.(f.o,1-f.l/f.ml,dt);if(f.l<=0)W.grp.remove(f.o)}for(let i=FX.length;i--;)if(FX[i].l<=0)FX.splice(i,1);
 W.emitters=W.emitters.filter(em=>!(em.obj&&!em.obj.parent));for(const em of W.emitters){em.acc=(em.acc||0)+em.rate*dt;const n=em.acc|0;em.acc-=n;if(n)emit(em.p,n,em.o)}
 if(W.amb&&mode!='pause'){const a=W.amb;W.acc+=a.n*dt;const n=W.acc|0;W.acc-=n;for(let i=0;i<n;i++)emit(new V3(camera.position.x+rand(-25,25),camera.position.y+rand(-8,12),camera.position.z+rand(-25,25)),1,{c:a.c,spd:a.spd,g:a.g,life:a.life,size:a.size})}
 for(const s of W.spin){if(s.userData.face)s.lookAt(camera.position.x,s.position.y,camera.position.z);else s.rotation.y+=dt*1.5}
 if(W.water){const p=W.water.geometry.attributes.position,y0=W.water.userData.y0,t=W.time;for(let i=0;i<p.count;i++){const x=y0[i*3],z=y0[i*3+2];p.setY(i,Math.sin(x*.15+t*1.2)*.35+Math.sin(z*.2+t*.9)*.3+Math.sin((x+z)*.4+t*2)*.08)}
  p.needsUpdate=true;W.water.geometry.computeVertexNormals()}
 if(W.lava){LAVA.offset.x=W.time*.01;LAVA.offset.y=W.time*.006;W.lava.material.emissiveIntensity=2+Math.sin(W.time*1.7)*.3}
 updParticles(dt);
 if(mode=='create'){camera.position.set(8.2+Math.sin(W.time*.15)*.4,1.45,9.2);camera.lookAt(8.4,1.05,6);PH.g.rotation.y=Math.sin(W.time*.4)*.9;animH(PH,0,0,null,null)}
 else if(mode=='menu'||mode=='hub'){const a=W.time*.08;camera.position.set(Math.sin(a)*14,4.5,Math.cos(a)*14);camera.lookAt(0,3,0)}else updCam(dt);
 const sp=mode=='play'||mode=='dlg'||mode=='modal'?pl.pos:camera.position;fill.position.copy(camera.position).lerp(sp,.4);fill.position.y+=1.5;if(W.sunDir){sun.position.copy(sp).addScaledVector(W.sunDir,90);sun.target.position.copy(sp)}
 if(mode=='play'&&(hudT-=dt)<=0){hudT=.05;hud()}if(!window.__nr)composer.render()}
function hud(){ui.hp.style.width=Math.max(pl.hp,0)/S.maxHp*100+'%';ui.st.style.width=pl.st+'%';ui.sp.style.width=(S.spark?pl.sp:0)+'%';ui.sp.parentNode.style.opacity=S.miasma?.3:1;
 ui.mtr.style.width=pl.meter+'%';ui.mtr.classList.toggle('full',pl.meter>=100);ui.xp.style.width=S.xp/xpNeed()*100+'%';compass();
 ui.info.textContent=`Lv ${S.plv} · HP ${Math.ceil(Math.max(pl.hp,0))}/${S.maxHp} · ${stance().n}${S.melt?' (Melting)':''} · ${S.dr} dr`;
 const b=W.boss;ui.boss.style.display=b?'block':'none';if(b){ui.bossN.textContent=b.T.boss;ui.bossHp.style.width=Math.max(b.hp,0)/b.mhp*100+'%'}
 let near=null;for(const i of W.inter)if(Math.hypot(i.p.x-pl.pos.x,i.p.z-pl.pos.z)<2.8&&Math.abs(i.p.y-pl.pos.y)<3)near=i;ui.prompt.innerHTML=near?'<span class=kb>E</span>'+near.label:'';
 if(pl.gt&&!pl.grap){const p=pl.gt.p.clone().project(camera);ui.gm.style.display='block';ui.gm.style.left=(p.x+1)/2*innerWidth+'px';ui.gm.style.top=(1-p.y)/2*innerHeight+'px'}else ui.gm.style.display='none';
 const k=(key,n,on=true)=>`<div class=${on?'':'off'}>${n}<kbd>${key}</kbd></div>`;
 ui.keys.innerHTML=k('LMB','Light')+k('RMB','Heavy')+k('Q',S.dash?'Aquatic Dash':'Dodge')+(S.spark?k('F',S.miasma?'Spark (sealed)':'Spark Blast',!S.miasma&&pl.sp>=25):'')+
  (S.grapple?k('G','Grapple',!!pl.gt):'')+(WEAP[S.weapon].st.length>1?k('R','Stance'):'')+k('C','Parry',pl.pcd<=0)+k('T','Spark Sight',pl.scd<=0)+k('X',(S.align=='athena'?'Aegis Barrier':S.align=='ares'?'Plasma Eruption':'Primordial Surge')+(pl.meter<100?` ${pl.meter|0}%`:' READY'),pl.meter>=100)+k('H',`Potion ×${S.potions}`,S.potions>0)}
menuScene();$('cont').style.display=S.lvl>0||S.post?'':'none';cloudLoad();requestAnimationFrame(frame);window.dbg={get W(){return W},pl,get S(){return S},loadLevel,LV,kill,get mode(){return mode},nolock(){lockT=1e15},frame};
