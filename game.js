import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { clamp, expSmoothing, WEAPONS, INFECTED, makeDirector, directorStep, moveCircle, lineBlocked, raySphereDistance, rayBoxDistance, chooseAimTarget, formatTime } from './core.js';

const $=id=>document.getElementById(id);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
const canvas=$('game');
let renderer,scene,camera,clock,loader;
let envRoot,templates={},mixers=[],rain,reticle,flashlight,flashlightTarget,extractGroup,envMeshes=[],moveColliders=[],cameraColliders=[];
let player,enemies=[],fx=[],decals=[],director=makeDirector();
let running=false,paused=false,qualityHigh=true,startedAt=0,arenaTime=0,kills=0,specialKills=0,waveCount=0,extractionOpen=false,gameOver=false;
let move={x:0,y:0,id:null},aim={x:0,y:0,id:null},fireHeld=false,lastFpsAt=0,frames=0,screenShake=0,lowFpsSeconds=0;
let cameraYaw=-0.78,cameraPitch=-0.08,cameraDistance=3.65,shoulderSide=1,recoilPitch=0,recoilYaw=0,currentCameraDistance=3.65;
let audioCtx=null,noiseBuffer=null;
const BOUNDS={minX:-12,maxX:12,minZ:-10,maxZ:10};
const EXTRACTION=new THREE.Vector3(8,0,-6);
const SPAWN_POINTS=[[-11,-8],[-4,-10],[5,-10],[11,-6],[12,3],[8,10],[0,10],[-9,9],[-12,1]];
const DIRECT={environment:'https://cdn.3dassets.dev/assets/32711/v1/model.glb',survivor:'https://cdn.3dassets.dev/assets/32901/v1/model.glb',runner:'https://cdn.3dassets.dev/assets/32707/v1/model.glb',bloated:'https://cdn.3dassets.dev/assets/32706/v1/model.glb',stalker:'https://cdn.3dassets.dev/assets/32708/v1/model.glb'};

initRenderer();
setupUI();
loadAssets();

function initRenderer(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.84;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x05090a,1);
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x071011);
  scene.fog=new THREE.FogExp2(0x0b1412,.034);
  camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.055,120);
  clock=new THREE.Clock();
  loader=new GLTFLoader();
  resize();addEventListener('resize',resize,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(resize,200));
  setupLights();setupRain();setupExtraction();
  requestAnimationFrame(loop);
}
function resize(){
  const dpr=qualityHigh?Math.min(devicePixelRatio||1,1.35):Math.min(devicePixelRatio||1,1.0);
  renderer?.setPixelRatio(dpr);renderer?.setSize(innerWidth,innerHeight,false);if(camera){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
}
function setupLights(){
  const hemi=new THREE.HemisphereLight(0x8fa9b4,0x172016,1.05);scene.add(hemi);
  const moon=new THREE.DirectionalLight(0xc5e1e6,2.2);moon.position.set(-8,15,9);moon.castShadow=true;moon.shadow.mapSize.set(512,512);moon.shadow.camera.left=-18;moon.shadow.camera.right=18;moon.shadow.camera.top=18;moon.shadow.camera.bottom=-18;moon.shadow.camera.near=.5;moon.shadow.camera.far=45;moon.shadow.bias=-.0007;scene.add(moon);
  const fire=new THREE.PointLight(0xff8a42,18,9,2);fire.position.set(-1,1.1,1.5);scene.add(fire);fire.userData.flicker=true;
  const flood=new THREE.SpotLight(0xd7f2ff,30,24,Math.PI*.22,.55,1.4);flood.position.set(4,8,4);flood.target.position.set(1,0,-2);scene.add(flood,flood.target);
}
function setupRain(){
  const count=qualityHigh?430:240,pos=new Float32Array(count*3);
  for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*35;pos[i*3+1]=Math.random()*15;pos[i*3+2]=(Math.random()-.5)*30}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:0xb8d5d8,size:.022,transparent:true,opacity:.44,depthWrite:false});rain=new THREE.Points(geo,mat);scene.add(rain);
}
function setupExtraction(){
  extractGroup=new THREE.Group();extractGroup.position.copy(EXTRACTION);scene.add(extractGroup);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1.04,48),new THREE.MeshBasicMaterial({color:0x7de155,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;extractGroup.add(ring);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.2,10),new THREE.MeshBasicMaterial({color:0x9bff73,transparent:true,opacity:.18}));core.position.y=1.1;extractGroup.add(core);
  const light=new THREE.PointLight(0x80ff65,0,8,2);light.position.y=1.4;extractGroup.add(light);extractGroup.userData.light=light;extractGroup.visible=false;
}

async function loadAssets(){
  const sequence=[['environment','Building forest extraction…'],['survivor','Loading survivor…'],['runner','Loading common infected…'],['stalker','Loading special infected…'],['bloated','Loading heavy infected…']];
  try{
    let done=0;
    for(const [name,label] of sequence){
      $('loadText').textContent=label;
      const gltf=await loadAsset(name);
      if(name==='environment'){envRoot=gltf.scene;configureEnvironment(envRoot);scene.add(envRoot)}
      else templates[name]={scene:gltf.scene,animations:gltf.animations};
      done++;$('loadBar').style.width=Math.round(done/sequence.length*100)+'%';
    }
    $('loadText').textContent='Visual gate ready';$('startBtn').disabled=false;$('startBtn').textContent='ENTER EXTRACTION';
  }catch(err){
    console.error(err);$('fatalText').textContent=(err?.message||String(err))+' — the game did not fall back to placeholder art.';$('boot').classList.add('hidden');$('fatal').classList.remove('hidden');
  }
}
function loadAsset(name){
  const proxy='/api/asset?name='+encodeURIComponent(name);
  return new Promise((resolve,reject)=>{
    loader.load(proxy,resolve,undefined,()=>loader.load(DIRECT[name],resolve,undefined,e=>reject(new Error('Could not load '+name+' model'))));
  });
}
function configureEnvironment(root){
  envMeshes=[];moveColliders=[];cameraColliders=[];root.updateMatrixWorld(true);
  root.traverse(o=>{if(o.isMesh){
    o.receiveShadow=true;o.castShadow=false;envMeshes.push(o);
    if(o.material){o.material.envMapIntensity=.28;if('roughness' in o.material)o.material.roughness=Math.max(.42,o.material.roughness??.7);o.material.needsUpdate=true}
    o.geometry?.computeBoundingBox?.();const box=new THREE.Box3().setFromObject(o);if(box.isEmpty())return;
    const sx=box.max.x-box.min.x,sy=box.max.y-box.min.y,sz=box.max.z-box.min.z;
    const c={minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y,minZ:box.min.z,maxZ:box.max.z,name:o.name||'mesh'};
    const huge=sx>24||sz>24,flat=sy<.18&&box.max.y<.35;
    if(!huge&&!flat&&box.max.y>.18&&box.min.y<2.0&&(sx<8||sz<8)) moveColliders.push({...c,minX:c.minX-.05,maxX:c.maxX+.05,minZ:c.minZ-.05,maxZ:c.maxZ+.05});
    if(!huge&&!flat&&sy>.12&&(sx<14||sz<14)) cameraColliders.push(c);
  }});root.position.set(0,0,0);
  console.info('[Hobile] colliders',moveColliders.length,'camera',cameraColliders.length,'meshes',envMeshes.length);
}
function configureCharacter(root,shadow=true){
  root.traverse(o=>{if(o.isMesh){o.castShadow=shadow;o.receiveShadow=shadow;if(o.material){o.material.envMapIntensity=.22;o.material.needsUpdate=true}}});
}
function cloneTemplate(name,shadow=true){const src=templates[name];if(!src)throw new Error('Missing template '+name);const root=cloneSkeleton(src.scene);configureCharacter(root,shadow);return{root,animations:src.animations}}
function makeBlobShadow(radius=.42,opacity=.30){const m=new THREE.Mesh(new THREE.CircleGeometry(radius,18),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.022;return m}
function attachWeaponRig(root){
  const rig=new THREE.Group(),dark=new THREE.MeshStandardMaterial({color:0x202427,roughness:.62,metalness:.42}),metal=new THREE.MeshStandardMaterial({color:0x50575b,roughness:.4,metalness:.68});
  const body=new THREE.Mesh(new THREE.BoxGeometry(.10,.10,.62),dark);body.position.z=.20;rig.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.42,8),metal);barrel.rotation.x=Math.PI/2;barrel.position.z=.68;rig.add(barrel);
  const stock=new THREE.Mesh(new THREE.BoxGeometry(.12,.13,.22),dark);stock.position.z=-.22;rig.add(stock);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(.08,.22,.12),dark);mag.position.set(0,-.13,.15);mag.rotation.x=.16;rig.add(mag);
  let hand=null;root.traverse(o=>{const n=(o.name||'').toLowerCase();if(!hand&&(n.includes('hand_r')||n.includes('righthand')||n.includes('hand.r')||n.includes('right_hand')))hand=o});
  if(hand){hand.add(rig);rig.position.set(.02,-.02,.05);rig.rotation.set(0,0,0);rig.scale.setScalar(.8)}else{root.add(rig);rig.position.set(.32,1.08,.28);rig.rotation.set(0,0,0)}
  return rig;
}
function playClip(entity,prefer){
  if(!entity?.mixer||!entity?.clips?.length)return;
  let clip=entity.clips.find(c=>prefer.some(k=>c.name.toLowerCase().includes(k)))||entity.clips[0];
  if(entity.activeClip===clip.name)return;entity.activeAction?.fadeOut(.14);const a=entity.mixer.clipAction(clip);a.reset().fadeIn(.14).play();entity.activeAction=a;entity.activeClip=clip.name;
}

async function requestImmersive(){
  try{if(document.documentElement.requestFullscreen&&!document.fullscreenElement)await document.documentElement.requestFullscreen()}catch{}
  try{await screen.orientation?.lock?.('landscape')}catch{}
}
function startGame(){
  ensureAudio();requestImmersive();resetGame();$('boot').classList.add('hidden');$('fatal').classList.add('hidden');$('hud').classList.remove('hidden');$('controls').classList.remove('hidden');running=true;paused=false;clock.getDelta();banner('EXTRACTION ZONE');toast('MOVE · AIM · FIRE · SURVIVE');
}
function findSafePoint(x,z,r=.42){
  if(!moveColliders.some(b=>{const qx=clamp(x,b.minX,b.maxX),qz=clamp(z,b.minZ,b.maxZ);return (x-qx)**2+(z-qz)**2<r*r}))return[x,z];
  for(let ring=1;ring<=8;ring++)for(let i=0;i<16;i++){const a=i/16*Math.PI*2,nx=x+Math.cos(a)*ring*.55,nz=z+Math.sin(a)*ring*.55;if(nx<BOUNDS.minX||nx>BOUNDS.maxX||nz<BOUNDS.minZ||nz>BOUNDS.maxZ)continue;if(!moveColliders.some(b=>{const qx=clamp(nx,b.minX,b.maxX),qz=clamp(nz,b.minZ,b.maxZ);return (nx-qx)**2+(nz-qz)**2<r*r}))return[nx,nz]}
  return[x,z];
}
function resetGame(){
  for(const e of enemies){scene.remove(e.root);if(e.shadow)scene.remove(e.shadow)}enemies=[];for(const f of fx)scene.remove(f.object);fx=[];for(const d of decals)scene.remove(d);decals=[];mixers=[];
  director=makeDirector();arenaTime=0;kills=0;specialKills=0;waveCount=0;extractionOpen=false;gameOver=false;screenShake=0;cameraYaw=-0.78;cameraPitch=-0.08;cameraDistance=3.65;currentCameraDistance=3.65;recoilPitch=0;recoilYaw=0;lowFpsSeconds=0;
  if(player?.root)scene.remove(player.root);if(player?.shadow)scene.remove(player.shadow);
  const s=cloneTemplate('survivor',true),safe=findSafePoint(-7,5,.42);player={root:s.root,mixer:new THREE.AnimationMixer(s.root),clips:s.animations,x:safe[0],z:safe[1],velX:0,velZ:0,hp:100,maxHp:100,hurtCooldown:0,slowTimer:0,weapon:'ar',ammo:30,reserve:150,fireCd:0,reload:0,medkits:1,aimX:1,aimZ:0,dead:false,spreadBloom:0};
  player.weaponRig=attachWeaponRig(player.root);player.shadow=makeBlobShadow(.42,.32);scene.add(player.shadow);mixers.push(player.mixer);player.root.position.set(player.x,0,player.z);player.root.scale.setScalar(.92);scene.add(player.root);playClip(player,['idle']);
  setupPlayerLight();extractGroup.visible=false;extractGroup.userData.light.intensity=0;startedAt=performance.now();updateHUD();
  spawnGroup(6,'runner');setTimeout(()=>{if(running&&!gameOver)spawnEnemy('stalker')},650);
}
function setupPlayerLight(){
  if(flashlight)scene.remove(flashlight,flashlightTarget);
  flashlight=new THREE.SpotLight(0xe7f4db,qualityHigh?13:8,14,Math.PI*.17,.58,1.45);flashlight.position.set(player.x,1.45,player.z);flashlightTarget=new THREE.Object3D();flashlightTarget.position.set(player.x+4,1,player.z);scene.add(flashlight,flashlightTarget);flashlight.target=flashlightTarget;
}
function spawnEnemy(type='runner'){
  const maxAlive=qualityHigh?22:16;if(enemies.filter(e=>!e.dead).length>=maxAlive)return null;
  const cfg=INFECTED[type],t=cloneTemplate(type,false),sp=findSafePoint(...pickSpawn(),cfg.radius*.72);const e={id:crypto.randomUUID?.()||Math.random().toString(36).slice(2),type,root:t.root,mixer:new THREE.AnimationMixer(t.root),clips:t.animations,x:sp[0],z:sp[1],hp:cfg.hp,maxHp:cfg.hp,attackCd:.45+Math.random()*.45,attackWindup:0,pounceCd:1.5+Math.random(),dead:false,deathT:0,radius:cfg.radius,hitFlash:0,strafeDir:Math.random()<.5?-1:1};
  e.root.position.set(e.x,0,e.z);if(type==='bloated')e.root.scale.setScalar(1.06);e.shadow=makeBlobShadow(type==='bloated'?.62:.40,.26);e.shadow.position.set(e.x,.024,e.z);scene.add(e.shadow,e.root);mixers.push(e.mixer);playClip(e,['arm-swing','idle']);enemies.push(e);return e;
}
function pickSpawn(){
  let pts=SPAWN_POINTS.filter(p=>Math.hypot(p[0]-player.x,p[1]-player.z)>7);if(!pts.length)pts=SPAWN_POINTS;for(let tries=0;tries<12;tries++){const p=pts[(Math.random()*pts.length)|0],x=p[0]+(Math.random()-.5)*1.4,z=p[1]+(Math.random()-.5)*1.4;if(!lineBlocked(x,z,player.x,player.z,moveColliders,.08))return[x,z]}const p=pts[(Math.random()*pts.length)|0];return[p[0],p[1]];
}
function spawnGroup(count,type='runner'){for(let i=0;i<count;i++)setTimeout(()=>{if(running&&!paused&&!gameOver)spawnEnemy(type)},i*145)}
function stickCurve(v){const a=Math.abs(v),dead=.12;if(a<=dead)return 0;const n=(a-dead)/(1-dead);return Math.sign(v)*Math.pow(n,1.28)}

function update(dt,now){
  if(!player||gameOver)return;arenaTime+=dt;player.fireCd=Math.max(0,player.fireCd-dt);player.hurtCooldown=Math.max(0,player.hurtCooldown-dt);player.slowTimer=Math.max(0,player.slowTimer-dt);player.spreadBloom=Math.max(0,player.spreadBloom-dt*.085);recoilPitch*=Math.exp(-dt*12);recoilYaw*=Math.exp(-dt*15);
  if(player.reload>0){player.reload-=dt;if(player.reload<=0)finishReload()}

  const lx=stickCurve(aim.x),ly=stickCurve(aim.y);if(Math.abs(lx)+Math.abs(ly)>.001){cameraYaw-=lx*2.15*dt;cameraPitch=clamp(cameraPitch-ly*1.05*dt,-.34,.22)}
  const viewYaw=cameraYaw+recoilYaw,fx=Math.sin(viewYaw),fz=Math.cos(viewYaw),rx=Math.cos(cameraYaw),rz=-Math.sin(cameraYaw);player.aimX=fx;player.aimZ=fz;

  let strafe=stickCurve(move.x),forward=-stickCurve(move.y),len=Math.hypot(strafe,forward);if(len>1){strafe/=len;forward/=len}
  let desiredSpeed=3.35*(player.slowTimer>0?.72:1);if(forward<-.1)desiredSpeed*=.86;const targetVX=(rx*strafe+Math.sin(cameraYaw)*forward)*desiredSpeed,targetVZ=(rz*strafe+Math.cos(cameraYaw)*forward)*desiredSpeed,acc=len>.06?19:27,t=expSmoothing(acc,dt);player.velX+=(targetVX-player.velX)*t;player.velZ+=(targetVZ-player.velZ)*t;
  const moved=moveCircle(player.x,player.z,player.velX*dt,player.velZ*dt,.37,moveColliders,BOUNDS);if(moved.blocked){if(Math.abs(moved.x-player.x)<.002)player.velX*=.28;if(Math.abs(moved.z-player.z)<.002)player.velZ*=.28}player.x=moved.x;player.z=moved.z;player.root.position.set(player.x,0,player.z);player.shadow.position.set(player.x,.024,player.z);
  const targetRot=Math.atan2(player.aimX,player.aimZ),delta=Math.atan2(Math.sin(targetRot-player.root.rotation.y),Math.cos(targetRot-player.root.rotation.y));player.root.rotation.y+=delta*Math.min(1,dt*14);
  const speedNow=Math.hypot(player.velX,player.velZ);playClip(player,speedNow>2.35?['run','walk','idle']:speedNow>.22?['walk','run','idle']:['idle']);
  if(fireHeld)fireWeapon();
  flashlight.position.set(player.x+player.aimX*.12,1.48,player.z+player.aimZ*.12);flashlightTarget.position.set(player.x+player.aimX*10,1.2,player.z+player.aimZ*10);
  reticleUpdate();updateEnemies(dt);updateDirector(dt);updateFX(dt);updateRain(dt);updateCamera(dt);updateExtraction(dt);updateHUD();
  for(const m of mixers)m.update(dt);
  if(arenaTime>4)$('cameraHint')?.classList.add('hidden');
  frames++;if(now-lastFpsAt>900){const fps=Math.round(frames*1000/(now-lastFpsAt));$('fps').textContent=(qualityHigh?'HIGH':'PERF')+' · '+fps+' FPS · '+enemies.filter(e=>!e.dead).length+' INFECTED · '+moveColliders.length+' COL';if(fps<25)lowFpsSeconds++;else lowFpsSeconds=Math.max(0,lowFpsSeconds-1);if(lowFpsSeconds>=2&&qualityHigh){qualityHigh=false;renderer.shadowMap.enabled=false;resize();rain.visible=false;toast('AUTO PERFORMANCE MODE');lowFpsSeconds=0}frames=0;lastFpsAt=now}
}
function tryEnemyMove(e,vx,vz,dt){const cfg=INFECTED[e.type],r=cfg.radius*.72;let m=moveCircle(e.x,e.z,vx*dt,vz*dt,r,moveColliders,{minX:BOUNDS.minX-.7,maxX:BOUNDS.maxX+.7,minZ:BOUNDS.minZ-.7,maxZ:BOUNDS.maxZ+.7});if(m.blocked){const px=-vz*e.strafeDir,pz=vx*e.strafeDir;m=moveCircle(e.x,e.z,px*dt,pz*dt,r,moveColliders,{minX:BOUNDS.minX-.7,maxX:BOUNDS.maxX+.7,minZ:BOUNDS.minZ-.7,maxZ:BOUNDS.maxZ+.7});if(m.blocked)e.strafeDir*=-1}e.x=m.x;e.z=m.z}
function updateEnemies(dt){
  for(const e of enemies){
    if(e.dead){e.deathT-=dt;e.root.rotation.z+=(1.35-e.root.rotation.z)*Math.min(1,dt*6);e.root.position.y=Math.max(-.25,e.root.position.y-dt*.45);if(e.shadow)e.shadow.material.opacity=Math.max(0,e.deathT*.24);continue}
    e.attackCd-=dt;e.pounceCd-=dt;e.hitFlash=Math.max(0,e.hitFlash-dt);const cfg=INFECTED[e.type],dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz)||.001,ux=dx/dist,uz=dz/dist,los=!lineBlocked(e.x,e.z,player.x,player.z,moveColliders,.05);
    if(e.attackWindup>0){e.attackWindup-=dt;if(e.attackWindup<=0&&dist<cfg.range+.22&&los){damagePlayer(cfg.damage);e.attackCd=cfg.cooldown;if(e.type==='bloated')cameraKick(4.5)}playClip(e,['arm-swing','idle']);}
    else if(e.type==='stalker'&&dist>2.5&&dist<5.8&&e.pounceCd<=0&&los){e.pounceCd=4.4;tryEnemyMove(e,ux*7.2,uz*7.2,.18);cameraKick(1.4);sfx('stalker')}
    else if(dist>cfg.range||!los){const sep=enemySeparation(e),speed=cfg.speed*(dist<2.4?1.08:1);tryEnemyMove(e,ux*speed+sep.x,uz*speed+sep.z,dt)}
    else if(e.attackCd<=0){e.attackWindup=.24;playClip(e,['arm-swing','idle'])}
    e.root.position.x+=(e.x-e.root.position.x)*expSmoothing(15,dt);e.root.position.z+=(e.z-e.root.position.z)*expSmoothing(15,dt);if(e.shadow)e.shadow.position.set(e.root.position.x,.024,e.root.position.z);e.root.rotation.y=Math.atan2(ux,uz);if(e.attackWindup<=0)playClip(e,['arm-swing','idle']);
  }
  enemies=enemies.filter(e=>{if(e.dead&&e.deathT<=0){scene.remove(e.root);if(e.shadow)scene.remove(e.shadow);mixers=mixers.filter(m=>m!==e.mixer);return false}return true});
}
function enemySeparation(e){let sx=0,sz=0;for(const o of enemies){if(o===e||o.dead)continue;const dx=e.x-o.x,dz=e.z-o.z,d2=dx*dx+dz*dz,min=(e.radius+o.radius)*.78;if(d2>0&&d2<min*min){const d=Math.sqrt(d2),k=(min-d)*3.1;sx+=dx/d*k;sz+=dz/d*k}}return{x:sx,z:sz}}
function updateDirector(dt){
  const near=enemies.filter(e=>!e.dead&&Math.hypot(e.x-player.x,e.z-player.z)<4).length,w=WEAPONS[player.weapon];const r=directorStep(director,{hp:player.hp,nearby:near,ammoRatio:player.reserve/w.reserve},dt);director=r.director;
  if(r.event?.type==='ambient')spawnGroup(r.event.count,'runner');
  if(r.event?.type==='horde'){waveCount++;banner('HORDE '+waveCount);sfx('horde');spawnGroup(r.event.count,'runner');setTimeout(()=>{if(running&&!gameOver)spawnEnemy(r.event.special)},700)}
  if(r.event?.type==='recovery')toast('PRESSURE DROPPING · RELOAD AND MOVE');
  if(!extractionOpen&&arenaTime>=62){extractionOpen=true;extractGroup.visible=true;banner('EXTRACTION OPEN');toast('MOVE TO THE GREEN BEACON');sfx('objective')}
}
function updateExtraction(dt){
  if(!extractGroup)return;extractGroup.rotation.y+=dt*.35;if(extractionOpen){extractGroup.userData.light.intensity=12+Math.sin(arenaTime*4)*3;const d=Math.hypot(player.x-EXTRACTION.x,player.z-EXTRACTION.z);if(d<1.35&&enemies.filter(e=>!e.dead&&Math.hypot(e.x-player.x,e.z-player.z)<2.8).length===0)completeGate()}
}
function reticleUpdate(){
  if(!reticle){const g=new THREE.RingGeometry(.17,.22,24),m=new THREE.MeshBasicMaterial({color:0xb5f57b,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false});reticle=new THREE.Mesh(g,m);reticle.rotation.x=-Math.PI/2;scene.add(reticle)}reticle.position.set(player.x+player.aimX*7.0,.045,player.z+player.aimZ*7.0);reticle.rotation.z=-arenaTime*.6;reticle.visible=false;
}
function updateRain(dt){if(!rain||!rain.visible)return;const a=rain.geometry.attributes.position.array;for(let i=0;i<a.length;i+=3){a[i+1]-=dt*13;if(a[i+1]<0){a[i+1]=12+Math.random()*5;a[i]=player.x+(Math.random()-.5)*34;a[i+2]=player.z+(Math.random()-.5)*28}}rain.geometry.attributes.position.needsUpdate=true}
function segmentBoxFraction3D(a,b,box){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;let tmin=0,tmax=1;
  for(const [o,d,min,max] of [[a.x,dx,box.minX,box.maxX],[a.y,dy,box.minY,box.maxY],[a.z,dz,box.minZ,box.maxZ]]){if(Math.abs(d)<1e-8){if(o<min||o>max)return Infinity;continue}let t1=(min-o)/d,t2=(max-o)/d;if(t1>t2){const q=t1;t1=t2;t2=q}tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return Infinity}return tmin;
}
function updateCamera(dt){
  const shake=screenShake;screenShake=Math.max(0,screenShake-dt*13);const sx=(Math.random()-.5)*shake*.010,sy=(Math.random()-.5)*shake*.008,eyaw=cameraYaw+recoilYaw,epitch=cameraPitch+recoilPitch,cp=Math.cos(epitch),sp=Math.sin(epitch),forward=new THREE.Vector3(Math.sin(eyaw)*cp,sp,Math.cos(eyaw)*cp).normalize(),right=new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw)),pivot=new THREE.Vector3(player.x,1.47,player.z),shoulder=.62*shoulderSide;
  const raw=pivot.clone().addScaledVector(forward,-cameraDistance).addScaledVector(right,shoulder);raw.y+=.12;let bestT=1;
  for(const b of cameraColliders){if(pivot.x>b.minX&&pivot.x<b.maxX&&pivot.y>b.minY&&pivot.y<b.maxY&&pivot.z>b.minZ&&pivot.z<b.maxZ)continue;const t=segmentBoxFraction3D(pivot,raw,b);if(t<bestT)bestT=t}
  let targetDist=cameraDistance;if(bestT<1)targetDist=Math.max(.95,cameraDistance*bestT-.22);currentCameraDistance+=(targetDist-currentCameraDistance)*expSmoothing(targetDist<currentCameraDistance?24:8,dt);
  let desired=pivot.clone().addScaledVector(forward,-currentCameraDistance).addScaledVector(right,shoulder*Math.min(1,currentCameraDistance/2.2));desired.y+=.12+sy;desired.x+=sx;camera.position.lerp(desired,expSmoothing(18,dt));const look=pivot.clone().addScaledVector(forward,14);camera.lookAt(look);
  const ch=$('crosshair'),spread=(WEAPONS[player.weapon].spread+player.spreadBloom+Math.min(.025,Math.hypot(player.velX,player.velZ)*.005))*900;ch?.style.setProperty('--spread',Math.round(8+spread)+'px');
}
function nearestWorldHit(origin,dir,maxRange){let best=maxRange,box=null;for(const b of cameraColliders){if(origin.x>b.minX&&origin.x<b.maxX&&origin.y>b.minY&&origin.y<b.maxY&&origin.z>b.minZ&&origin.z<b.maxZ)continue;const d=rayBoxDistance(origin.x,origin.y,origin.z,dir.x,dir.y,dir.z,b);if(d>=0&&d<best){best=d;box=b}}return{distance:best,box}}
function nearestEnemyHit(origin,dir,maxRange){let best=null,bestDist=maxRange,headshot=false;for(const e of enemies){if(e.dead)continue;const cfg=INFECTED[e.type],body=raySphereDistance(origin.x,origin.y,origin.z,dir.x,dir.y,dir.z,e.x,.82,e.z,cfg.radius),head=raySphereDistance(origin.x,origin.y,origin.z,dir.x,dir.y,dir.z,e.x,1.36,e.z,Math.max(.18,cfg.radius*.40));let d=body,h=false;if(head<body){d=head;h=true}if(d<bestDist){best=e;bestDist=d;headshot=h}}return{enemy:best,distance:bestDist,headshot}}
function fireWeapon(){
  if(player.dead||player.reload>0||player.fireCd>0)return;const w=WEAPONS[player.weapon];if(player.ammo<=0){reload();return}player.ammo--;player.fireCd=w.fireRate;player.spreadBloom=Math.min(.055,player.spreadBloom+w.recoil*.36);recoilPitch=Math.min(.09,recoilPitch+w.recoil*(player.weapon==='shotgun'?1.05:.62));recoilYaw+=(Math.random()-.5)*w.recoil*.65;sfx('gun',player.weapon);cameraKick(player.weapon==='shotgun'?2.8:1.1);muzzleFX();
  const origin=camera.position.clone(),baseDir=new THREE.Vector3();camera.getWorldDirection(baseDir);const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),moving=Math.min(1,Math.hypot(player.velX,player.velZ)/3.35),spread=w.spread+w.movingSpread*moving+player.spreadBloom,assist=chooseAimTarget(origin,baseDir,enemies,w.range,w.assist,cameraColliders);let anyHit=false;
  for(let p=0;p<(w.pellets||1);p++){
    const dir=baseDir.clone().addScaledVector(right,(Math.random()-.5)*spread*2).addScaledVector(up,(Math.random()-.5)*spread*2).normalize();if(assist){const to=new THREE.Vector3(assist.x,assist.type==='bloated'?.95:1.0,assist.z).sub(origin).normalize();dir.lerp(to,player.weapon==='shotgun'?.16:.32).normalize()}
    const world=nearestWorldHit(origin,dir,w.range),hit=nearestEnemyHit(origin,dir,w.range);let end;
    if(hit.enemy&&hit.distance<world.distance){const mult=hit.headshot?1.75:1,falloff=clamp(1-hit.distance/(w.range*1.9),.68,1);damageEnemy(hit.enemy,w.damage*mult*falloff,hit.headshot);end=new THREE.Vector3(hit.enemy.x,hit.headshot?1.36:.82,hit.enemy.z);anyHit=true}
    else{const d=Math.min(world.distance,w.range);end=origin.clone().addScaledVector(dir,d);if(world.box&&d<w.range-.1)impactFX(end)}tracerFX3(end);
  }
  if(!anyHit)$('crosshair')?.classList.remove('kill');updateHUD();
}
function damageEnemy(e,amount,headshot=false){
  if(!e||e.dead)return;e.hp-=amount;bloodFX(e.x,e.z,headshot?1.35:.78);const ch=$('crosshair');ch?.classList.add('hot');setTimeout(()=>ch?.classList.remove('hot'),90);if(headshot){ch?.classList.add('head');setTimeout(()=>ch?.classList.remove('head'),110)}if(e.hp<=0){e.dead=true;e.deathT=1.1;kills++;if(INFECTED[e.type].special)specialKills++;bloodDecal(e.x,e.z,e.type==='bloated'?1.2:.65);sfx('kill',e.type);ch?.classList.add('kill');setTimeout(()=>ch?.classList.remove('kill'),140);if(e.type==='bloated')bloatedBurst(e)}
}
function bloatedBurst(e){
  for(let i=0;i<18;i++)particleBurst(new THREE.Vector3(e.x,.8,e.z),0x93b85e,1.5);const d=Math.hypot(e.x-player.x,e.z-player.z);if(d<2.6)damagePlayer(Math.round((2.6-d)*8));cameraKick(6)
}
function damagePlayer(amount){
  if(player.dead||player.hurtCooldown>0)return;player.hurtCooldown=.16;player.slowTimer=.18;player.hp=Math.max(0,player.hp-amount);flashDamage();sfx('hurt');screenShake=Math.max(screenShake,2.2);if(player.hp<=0){player.dead=true;gameOver=true;fireHeld=false;banner('SURVIVOR DOWN');toast('RESTARTING EXTRACTION…');setTimeout(()=>{if(running){resetGame();gameOver=false;banner('TRY AGAIN')}},2200)}updateHUD();
}
function heal(){if(!running||paused||player.dead||player.medkits<=0||player.hp>=92)return;player.medkits--;player.hp=Math.min(100,player.hp+58);toast('MEDKIT USED · +58 HP');sfx('heal');updateHUD()}
function reload(){if(!running||paused||player.dead||player.reload>0)return;const w=WEAPONS[player.weapon];if(player.ammo>=w.mag||player.reserve<=0)return;fireHeld=false;player.reload=w.reload;$('reloadLabel').textContent='RELOADING…';playClip(player,['grasp','idle']);sfx('reload')}
function finishReload(){const w=WEAPONS[player.weapon],n=Math.min(w.mag-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;$('reloadLabel').textContent=''}
function swapWeapon(){if(!running||paused||player.dead)return;player.reload=0;$('reloadLabel').textContent='';const order=['ar','smg','shotgun'],i=order.indexOf(player.weapon);player.weapon=order[(i+1)%order.length];const w=WEAPONS[player.weapon];player.ammo=Math.min(player.ammo,w.mag);player.reserve=Math.max(player.reserve,Math.round(w.reserve*.45));player.spreadBloom=0;toast(w.name);sfx('swap');updateHUD()}

function muzzleFX(){
  const p=new THREE.Vector3(player.x+player.aimX*.78,1.18,player.z+player.aimZ*.78);const mat=new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:1});const mesh=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),mat);mesh.position.copy(p);scene.add(mesh);const light=new THREE.PointLight(0xffb54d,28,4,2);light.position.copy(p);scene.add(light);fx.push({object:mesh,life:.07,max:.07,kind:'fade'});fx.push({object:light,life:.045,max:.045,kind:'light'});particleBurst(p,0xffce79,.7,4)
}
function tracerFX3(end){
  const start=new THREE.Vector3(player.x+player.aimX*.56,1.16,player.z+player.aimZ*.56),geo=new THREE.BufferGeometry().setFromPoints([start,end]),mat=new THREE.LineBasicMaterial({color:0xffd78a,transparent:true,opacity:.78});const line=new THREE.Line(geo,mat);scene.add(line);fx.push({object:line,life:.05,max:.05,kind:'fade'})
}
function impactFX(p){for(let i=0;i<4;i++)particleBurst(p,0xb8b1a0,.55,1)}
function bloodFX(x,z,y=.8){for(let i=0;i<4;i++)particleBurst(new THREE.Vector3(x,y,z),0x76151c,.7,1)}
function particleBurst(origin,color,speed=1,count=1){
 for(let i=0;i<count;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.025,5,5),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9}));mesh.position.copy(origin);scene.add(mesh);fx.push({object:mesh,life:.32+Math.random()*.2,max:.5,kind:'particle',vel:new THREE.Vector3((Math.random()-.5)*speed,(Math.random()*.7+.25)*speed,(Math.random()-.5)*speed)})}
}
function bloodDecal(x,z,size=.7){const m=new THREE.Mesh(new THREE.CircleGeometry(size,18),new THREE.MeshBasicMaterial({color:0x35070a,transparent:true,opacity:.52,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));m.rotation.x=-Math.PI/2;m.position.set(x,.02,z);m.scale.y=.55+Math.random()*.5;scene.add(m);decals.push(m);if(decals.length>28)scene.remove(decals.shift())}
function updateFX(dt){
 for(const f of fx){f.life-=dt;if(f.kind==='fade'&&f.object.material)f.object.material.opacity=clamp(f.life/f.max,0,1);if(f.kind==='light')f.object.intensity=28*clamp(f.life/f.max,0,1);if(f.kind==='particle'){f.vel.y-=2.8*dt;f.object.position.addScaledVector(f.vel,dt);if(f.object.material)f.object.material.opacity=clamp(f.life/f.max,0,1)}}
 fx=fx.filter(f=>{if(f.life<=0){scene.remove(f.object);f.object.geometry?.dispose?.();f.object.material?.dispose?.();return false}return true})
}
function cameraKick(n){screenShake=Math.max(screenShake,n)}

function completeGate(){
  if(gameOver)return;gameOver=true;running=false;fireHeld=false;$('controls').classList.add('hidden');$('hud').classList.add('hidden');$('clear').classList.remove('hidden');$('killsStat').textContent=kills;$('specialStat').textContent=specialKills;$('timeStat').textContent=formatTime((performance.now()-startedAt)/1000);sfx('objective')
}
function updateHUD(){
  if(!player)return;$('hpText').textContent=Math.round(player.hp);$('hpBar').style.width=clamp(player.hp,0,100)+'%';$('ammo').textContent=player.ammo;$('reserve').textContent=player.reserve;$('weaponName').textContent=WEAPONS[player.weapon].name;
  const progress=extractionOpen?100:clamp(arenaTime/62*100,0,100);$('objectiveBar').style.width=progress+'%';$('objective').textContent=extractionOpen?'REACH THE GREEN EXTRACTION BEACON':'SURVIVE UNTIL EXTRACTION · '+Math.max(0,Math.ceil(62-arenaTime))+'s';
  $('threat').textContent=director.phase;$('threat').classList.toggle('hot',director.phase==='PEAK'||director.intensity>.7);
  const sp=enemies.filter(e=>!e.dead&&INFECTED[e.type].special).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];if(sp){$('specialCard').classList.remove('hidden');$('specialName').textContent=INFECTED[sp.type].name;$('specialHp').style.width=clamp(sp.hp/sp.maxHp*100,0,100)+'%'}else $('specialCard').classList.add('hidden');
}
function banner(text){const e=$('waveBanner');e.textContent=text;e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}
function toast(text){const e=$('toast');e.textContent=text;e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}
function flashDamage(){const e=$('damageFlash');e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}

function ensureAudio(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();if(!noiseBuffer){noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.18,audioCtx.sampleRate);const d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}}catch{}}
function sfx(type,variant){if(!audioCtx)return;const t=audioCtx.currentTime;
 try{
  if(type==='gun'){const src=audioCtx.createBufferSource(),gain=audioCtx.createGain(),f=audioCtx.createBiquadFilter();src.buffer=noiseBuffer;f.type='bandpass';f.frequency.value=variant==='shotgun'?520:variant==='smg'?900:700;f.Q.value=.65;src.connect(f);f.connect(gain);gain.connect(audioCtx.destination);gain.gain.setValueAtTime(variant==='shotgun'?.18:.12,t);gain.gain.exponentialRampToValueAtTime(.0001,t+(variant==='shotgun'?.16:.075));src.start(t);src.stop(t+.18);tone(variant==='shotgun'?75:105,.10,.07,'sawtooth');return}
  if(type==='hurt'){tone(72,.13,.05,'square');return}if(type==='kill'){tone(165,.055,.026,'triangle');return}if(type==='horde'){tone(58,.55,.05,'sawtooth');return}if(type==='objective'){tone(420,.35,.045,'sine');setTimeout(()=>tone(620,.25,.035,'sine'),130);return}if(type==='heal'){tone(510,.2,.035,'sine');return}if(type==='reload'||type==='swap'){tone(170,.045,.02,'square');return}if(type==='stalker'){tone(98,.22,.035,'sawtooth')}
 }catch{}
}
function tone(freq,dur,vol,type='sine'){if(!audioCtx)return;const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.65),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.02)}

function loop(now){requestAnimationFrame(loop);const dt=Math.min(.034,clock.getDelta()||.016);for(const l of scene.children){if(l.userData?.flicker)l.intensity=17+Math.sin(now*.017)*2+Math.random()*2}if(running&&!paused)update(dt,now);renderer.render(scene,camera)}

function setupUI(){
 $('startBtn').onclick=startGame;$('retryBtn').onclick=()=>location.reload();$('qualityBtn').onclick=()=>{qualityHigh=!qualityHigh;$('qualityBtn').textContent='QUALITY: '+(qualityHigh?'HIGH':'PERFORMANCE');renderer.shadowMap.enabled=qualityHigh;if(rain)rain.visible=qualityHigh;resize()};
 $('pauseBtn').onclick=()=>{if(!running)return;paused=true;fireHeld=false;$('pause').classList.remove('hidden')};$('resumeBtn').onclick=()=>{paused=false;$('pause').classList.add('hidden');clock.getDelta()};$('restartBtn').onclick=()=>{resetGame();paused=false;$('pause').classList.add('hidden');banner('EXTRACTION ZONE')};$('menuBtn').onclick=()=>location.reload();$('againBtn').onclick=()=>{$('clear').classList.add('hidden');$('hud').classList.remove('hidden');$('controls').classList.remove('hidden');running=true;resetGame();banner('EXTRACTION ZONE')};
 bindStick($('movePad'),$('moveKnob'),move,false);bindStick($('aimPad'),$('aimKnob'),aim,true);
 const fire=$('fireBtn');fire.onpointerdown=e=>{e.preventDefault();ensureAudio();fireHeld=true;fire.setPointerCapture?.(e.pointerId);fireWeapon()};fire.onpointerup=()=>fireHeld=false;fire.onpointercancel=()=>fireHeld=false;
 $('reloadBtn').onpointerdown=e=>{e.preventDefault();reload()};$('healBtn').onpointerdown=e=>{e.preventDefault();heal()};$('swapBtn').onpointerdown=e=>{e.preventDefault();swapWeapon()};
 ['contextmenu','selectstart','dragstart','gesturestart','gesturechange','gestureend'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));document.addEventListener('touchmove',e=>{if(running)e.preventDefault()},{passive:false});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){paused=true;fireHeld=false;$('pause').classList.remove('hidden')}});
}
function bindStick(el,knob,state,isAim){
 const moveEvent=e=>{if(e.pointerId!==state.id)return;const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,rad=r.width*.33;let dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy)||1,k=Math.min(1,rad/d);dx*=k;dy*=k;state.x=dx/rad;state.y=dy/rad;knob.style.transform=`translate(${dx}px,${dy}px)`};
 const stop=e=>{if(e&&e.pointerId!==state.id)return;state.id=null;state.x=0;state.y=0;knob.style.transform='translate(0,0)'};
 el.onpointerdown=e=>{e.preventDefault();ensureAudio();state.id=e.pointerId;el.setPointerCapture?.(e.pointerId);moveEvent(e)};el.onpointermove=moveEvent;el.onpointerup=stop;el.onpointercancel=stop;
}

window.__HOBILE_DEBUG={state:()=>({running,paused,qualityHigh,arenaTime,kills,specialKills,waveCount,extractionOpen,player:player&&{x:player.x,z:player.z,hp:player.hp,weapon:player.weapon,ammo:player.ammo},infected:enemies.filter(e=>!e.dead).map(e=>({type:e.type,hp:e.hp,x:e.x,z:e.z})),camera:{yaw:cameraYaw,pitch:cameraPitch,distance:cameraDistance},director}),horde:()=>spawnGroup(16,'runner'),special:t=>spawnEnemy(t||'stalker'),openExtraction:()=>{extractionOpen=true;extractGroup.visible=true},killAll:()=>enemies.forEach(e=>damageEnemy(e,9999))};
