import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, WEAPONS, INFECTED, makeDirector, directorStep, selectHits, formatTime } from './core.js';

const $=id=>document.getElementById(id);
const canvas=$('game');
let renderer,scene,camera,clock,loader;
let envRoot,templates={},mixers=[],rain,reticle,flashlight,flashlightTarget,extractGroup;
let player,enemies=[],fx=[],decals=[],director=makeDirector();
let running=false,paused=false,qualityHigh=true,startedAt=0,arenaTime=0,kills=0,specialKills=0,waveCount=0,extractionOpen=false,gameOver=false;
let move={x:0,y:0,id:null},aim={x:1,y:0,id:null},fireHeld=false,lastFpsAt=0,frames=0,screenShake=0;
let audioCtx=null,noiseBuffer=null;
const BOUNDS={minX:-12,maxX:12,minZ:-10,maxZ:10};
const EXTRACTION=new THREE.Vector3(8,0,-6);
const SPAWN_POINTS=[[-11,-8],[-4,-10],[5,-10],[11,-6],[12,3],[8,10],[0,10],[-9,9],[-12,1]];
const DIRECT={environment:'https://cdn.3dassets.dev/assets/32711/v1/model.glb',survivor:'https://cdn.3dassets.dev/assets/32699/v1/model.glb',runner:'https://cdn.3dassets.dev/assets/32707/v1/model.glb',bloated:'https://cdn.3dassets.dev/assets/32706/v1/model.glb',stalker:'https://cdn.3dassets.dev/assets/32708/v1/model.glb'};

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
  camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.08,120);
  clock=new THREE.Clock();
  loader=new GLTFLoader();
  resize();addEventListener('resize',resize,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(resize,200));
  setupLights();setupRain();setupExtraction();
  requestAnimationFrame(loop);
}
function resize(){
  const dpr=qualityHigh?Math.min(devicePixelRatio||1,1.65):Math.min(devicePixelRatio||1,1.15);
  renderer?.setPixelRatio(dpr);renderer?.setSize(innerWidth,innerHeight,false);if(camera){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
}
function setupLights(){
  const hemi=new THREE.HemisphereLight(0x8fa9b4,0x172016,1.05);scene.add(hemi);
  const moon=new THREE.DirectionalLight(0xc5e1e6,2.2);moon.position.set(-8,15,9);moon.castShadow=true;moon.shadow.mapSize.set(qualityHigh?1024:512,qualityHigh?1024:512);moon.shadow.camera.left=-18;moon.shadow.camera.right=18;moon.shadow.camera.top=18;moon.shadow.camera.bottom=-18;moon.shadow.camera.near=.5;moon.shadow.camera.far=45;moon.shadow.bias=-.0007;scene.add(moon);
  const fire=new THREE.PointLight(0xff8a42,18,9,2);fire.position.set(-1,1.1,1.5);scene.add(fire);fire.userData.flicker=true;
  const flood=new THREE.SpotLight(0xd7f2ff,30,24,Math.PI*.22,.55,1.4);flood.position.set(4,8,4);flood.target.position.set(1,0,-2);scene.add(flood,flood.target);
}
function setupRain(){
  const count=qualityHigh?850:420,pos=new Float32Array(count*3);
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
  root.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=false;if(o.material){o.material.envMapIntensity=.35;if('roughness' in o.material)o.material.roughness=Math.max(.38,o.material.roughness??.7);o.material.needsUpdate=true}}});
  root.position.set(0,0,0);
}
function configureCharacter(root){
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.envMapIntensity=.25;o.material.needsUpdate=true}}});
}
function cloneTemplate(name){const src=templates[name];if(!src)throw new Error('Missing template '+name);const root=src.scene.clone(true);configureCharacter(root);return{root,animations:src.animations}}
function playClip(entity,prefer){
  if(!entity?.mixer||!entity?.clips?.length)return;
  let clip=entity.clips.find(c=>prefer.some(k=>c.name.toLowerCase().includes(k)))||entity.clips[0];
  if(entity.activeClip===clip.name)return;entity.activeAction?.fadeOut(.14);const a=entity.mixer.clipAction(clip);a.reset().fadeIn(.14).play();entity.activeAction=a;entity.activeClip=clip.name;
}

function startGame(){
  ensureAudio();resetGame();$('boot').classList.add('hidden');$('fatal').classList.add('hidden');$('hud').classList.remove('hidden');$('controls').classList.remove('hidden');running=true;paused=false;clock.getDelta();banner('EXTRACTION ZONE');toast('CLEAR THE PAD · SURVIVE THE WAVES');
}
function resetGame(){
  for(const e of enemies)scene.remove(e.root);enemies=[];for(const f of fx)scene.remove(f.object);fx=[];for(const d of decals)scene.remove(d);decals=[];mixers=[];
  director=makeDirector();arenaTime=0;kills=0;specialKills=0;waveCount=0;extractionOpen=false;gameOver=false;screenShake=0;
  if(player?.root)scene.remove(player.root);
  const s=cloneTemplate('survivor');player={root:s.root,mixer:new THREE.AnimationMixer(s.root),clips:s.animations,x:-7,z:5,hp:100,maxHp:100,weapon:'ar',ammo:30,reserve:150,fireCd:0,reload:0,medkits:1,aimX:1,aimZ:0,dead:false};mixers.push(player.mixer);player.root.position.set(player.x,0,player.z);scene.add(player.root);playClip(player,['idle']);
  setupPlayerLight();extractGroup.visible=false;extractGroup.userData.light.intensity=0;startedAt=performance.now();updateHUD();
  spawnGroup(7,'runner');spawnEnemy('stalker');
}
function setupPlayerLight(){
  if(flashlight)scene.remove(flashlight,flashlightTarget);
  flashlight=new THREE.SpotLight(0xe7f4db,qualityHigh?16:10,12,Math.PI*.18,.52,1.4);flashlight.position.set(player.x,1.45,player.z);flashlightTarget=new THREE.Object3D();flashlightTarget.position.set(player.x+4,1,player.z);scene.add(flashlight,flashlightTarget);flashlight.target=flashlightTarget;
}
function spawnEnemy(type='runner'){
  const cfg=INFECTED[type],t=cloneTemplate(type),sp=pickSpawn();const e={id:crypto.randomUUID?.()||Math.random().toString(36).slice(2),type,root:t.root,mixer:new THREE.AnimationMixer(t.root),clips:t.animations,x:sp[0],z:sp[1],hp:cfg.hp,maxHp:cfg.hp,attackCd:Math.random()*.5,pounceCd:1.5+Math.random(),dead:false,deathT:0,radius:type==='bloated'?.75:.5,hitFlash:0};
  e.root.position.set(e.x,0,e.z);if(type==='bloated')e.root.scale.setScalar(1.06);scene.add(e.root);mixers.push(e.mixer);playClip(e,['arm-swing','idle']);enemies.push(e);return e;
}
function pickSpawn(){
  let pts=SPAWN_POINTS.filter(p=>Math.hypot(p[0]-player.x,p[1]-player.z)>7);if(!pts.length)pts=SPAWN_POINTS;const p=pts[(Math.random()*pts.length)|0];return[p[0]+(Math.random()-.5)*1.4,p[1]+(Math.random()-.5)*1.4]
}
function spawnGroup(count,type='runner'){for(let i=0;i<count;i++)setTimeout(()=>{if(running&&!paused&&!gameOver)spawnEnemy(type)},i*115)}

function update(dt,now){
  if(!player||gameOver)return;arenaTime+=dt;player.fireCd=Math.max(0,player.fireCd-dt);
  if(player.reload>0){player.reload-=dt;if(player.reload<=0)finishReload()}
  const speed=3.35;let mx=move.x,mz=move.y;const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len}player.x=clamp(player.x+mx*speed*dt,BOUNDS.minX,BOUNDS.maxX);player.z=clamp(player.z+mz*speed*dt,BOUNDS.minZ,BOUNDS.maxZ);player.root.position.set(player.x,0,player.z);
  if(Math.hypot(aim.x,aim.y)>.18){const al=Math.hypot(aim.x,aim.y);player.aimX=aim.x/al;player.aimZ=aim.y/al}
  player.root.rotation.y=Math.atan2(player.aimX,player.aimZ);
  playClip(player,Math.hypot(move.x,move.y)>.18?['arm-swing','idle']:['idle']);
  if(fireHeld)fireWeapon();
  flashlight.position.set(player.x,1.45,player.z);flashlightTarget.position.set(player.x+player.aimX*5,1.15,player.z+player.aimZ*5);
  reticleUpdate();updateEnemies(dt);updateDirector(dt);updateFX(dt);updateRain(dt);updateCamera(dt);updateExtraction(dt);updateHUD();
  for(const m of mixers)m.update(dt);
  frames++;if(now-lastFpsAt>800){const fps=Math.round(frames*1000/(now-lastFpsAt));$('fps').textContent=(qualityHigh?'HIGH':'PERF')+' · '+fps+' FPS · '+enemies.filter(e=>!e.dead).length+' INFECTED';frames=0;lastFpsAt=now}
}
function updateEnemies(dt){
  for(const e of enemies){
    if(e.dead){e.deathT-=dt;e.root.rotation.z+=(1.35-e.root.rotation.z)*Math.min(1,dt*6);e.root.position.y=Math.max(-.25,e.root.position.y-dt*.45);continue}
    e.attackCd-=dt;e.pounceCd-=dt;e.hitFlash=Math.max(0,e.hitFlash-dt);
    const cfg=INFECTED[e.type],dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz)||.001,ux=dx/dist,uz=dz/dist;
    if(e.type==='stalker'&&dist>2.4&&dist<6.2&&e.pounceCd<=0){e.pounceCd=4;e.x+=ux*1.25;e.z+=uz*1.25;cameraKick(2);sfx('stalker')}
    if(dist>cfg.range){const separation=enemySeparation(e);e.x+=ux*cfg.speed*dt+separation.x*dt;e.z+=uz*cfg.speed*dt+separation.z*dt;e.x=clamp(e.x,BOUNDS.minX-.4,BOUNDS.maxX+.4);e.z=clamp(e.z,BOUNDS.minZ-.4,BOUNDS.maxZ+.4)}
    else if(e.attackCd<=0){e.attackCd=cfg.cooldown;damagePlayer(cfg.damage);if(e.type==='bloated')cameraKick(5)}
    e.root.position.x+=(e.x-e.root.position.x)*Math.min(1,dt*14);e.root.position.z+=(e.z-e.root.position.z)*Math.min(1,dt*14);e.root.rotation.y=Math.atan2(ux,uz);playClip(e,['arm-swing','idle']);
  }
  enemies=enemies.filter(e=>{if(e.dead&&e.deathT<=0){scene.remove(e.root);return false}return true});
}
function enemySeparation(e){let sx=0,sz=0;for(const o of enemies){if(o===e||o.dead)continue;const dx=e.x-o.x,dz=e.z-o.z,d2=dx*dx+dz*dz;if(d2>0&&d2<1.0){const k=(1-Math.sqrt(d2))*1.3;sx+=dx/Math.sqrt(d2)*k;sz+=dz/Math.sqrt(d2)*k}}return{x:sx,z:sz}}
function updateDirector(dt){
  const near=enemies.filter(e=>!e.dead&&Math.hypot(e.x-player.x,e.z-player.z)<4).length,w=WEAPONS[player.weapon];const r=directorStep(director,{hp:player.hp,nearby:near,ammoRatio:player.reserve/w.reserve},dt);director=r.director;
  if(r.event?.type==='ambient')spawnGroup(r.event.count,'runner');
  if(r.event?.type==='horde'){waveCount++;banner('HORDE '+waveCount);sfx('horde');spawnGroup(r.event.count,'runner');setTimeout(()=>{if(running&&!gameOver)spawnEnemy(r.event.special)},600)}
  if(r.event?.type==='recovery')toast('PRESSURE DROPPING · RELOAD AND MOVE');
  if(!extractionOpen&&arenaTime>=62){extractionOpen=true;extractGroup.visible=true;banner('EXTRACTION OPEN');toast('MOVE TO THE GREEN BEACON');sfx('objective')}
}
function updateExtraction(dt){
  if(!extractGroup)return;extractGroup.rotation.y+=dt*.35;if(extractionOpen){extractGroup.userData.light.intensity=12+Math.sin(arenaTime*4)*3;const d=Math.hypot(player.x-EXTRACTION.x,player.z-EXTRACTION.z);if(d<1.35&&enemies.filter(e=>!e.dead&&Math.hypot(e.x-player.x,e.z-player.z)<2.8).length===0)completeGate()}
}
function reticleUpdate(){
  if(!reticle){const g=new THREE.RingGeometry(.17,.22,24),m=new THREE.MeshBasicMaterial({color:0xb5f57b,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false});reticle=new THREE.Mesh(g,m);reticle.rotation.x=-Math.PI/2;scene.add(reticle)}reticle.position.set(player.x+player.aimX*3.3,.045,player.z+player.aimZ*3.3);reticle.rotation.z=-arenaTime*.6;
}
function updateRain(dt){
  if(!rain)return;const a=rain.geometry.attributes.position.array;for(let i=0;i<a.length;i+=3){a[i+1]-=dt*13;if(a[i+1]<0){a[i+1]=12+Math.random()*5;a[i]=player.x+(Math.random()-.5)*34;a[i+2]=player.z+(Math.random()-.5)*28}}rain.geometry.attributes.position.needsUpdate=true;
}
function updateCamera(dt){
  const shake=screenShake;screenShake=Math.max(0,screenShake-dt*12);const sx=(Math.random()-.5)*shake*.018,sy=(Math.random()-.5)*shake*.012;
  const desired=new THREE.Vector3(player.x-8.4+sx,7.5+sy,player.z+10.7+sx);camera.position.lerp(desired,1-Math.pow(.001,dt));const look=new THREE.Vector3(player.x+1.2,1.0,player.z-1.0);camera.lookAt(look);
}

function fireWeapon(){
  if(player.dead||player.reload>0||player.fireCd>0)return;const w=WEAPONS[player.weapon];if(player.ammo<=0){reload();return}player.ammo--;player.fireCd=w.fireRate;sfx('gun',player.weapon);cameraKick(player.weapon==='shotgun'?4:1.7);muzzleFX();
  const hits=selectHits(player,enemies,player.weapon);for(const target of hits){const falloff=clamp(1-Math.hypot(target.x-player.x,target.z-player.z)/(w.range*1.7),.62,1);damageEnemy(target,w.damage*falloff);tracerFX(target.x,target.z)}
  if(!hits.length)tracerFX(player.x+player.aimX*Math.min(w.range,12),player.z+player.aimZ*Math.min(w.range,12));updateHUD();
}
function damageEnemy(e,amount){
  if(!e||e.dead)return;e.hp-=amount;bloodFX(e.x,e.z,.5);if(e.hp<=0){e.dead=true;e.deathT=1.1;kills++;if(INFECTED[e.type].special)specialKills++;bloodDecal(e.x,e.z,e.type==='bloated'?1.2:.65);sfx('kill',e.type);if(e.type==='bloated')bloatedBurst(e)}
}
function bloatedBurst(e){
  for(let i=0;i<18;i++)particleBurst(new THREE.Vector3(e.x,.8,e.z),0x93b85e,1.5);const d=Math.hypot(e.x-player.x,e.z-player.z);if(d<2.6)damagePlayer(Math.round((2.6-d)*8));cameraKick(6)
}
function damagePlayer(amount){
  if(player.dead)return;player.hp=Math.max(0,player.hp-amount);flashDamage();sfx('hurt');if(player.hp<=0){player.dead=true;gameOver=true;banner('SURVIVOR DOWN');toast('RESTARTING EXTRACTION…');setTimeout(()=>{if(running){resetGame();banner('TRY AGAIN')}},2200)}updateHUD();
}
function heal(){if(!running||paused||player.dead||player.medkits<=0||player.hp>=92)return;player.medkits--;player.hp=Math.min(100,player.hp+58);toast('MEDKIT USED · +58 HP');sfx('heal');updateHUD()}
function reload(){if(!running||paused||player.dead||player.reload>0)return;const w=WEAPONS[player.weapon];if(player.ammo>=w.mag||player.reserve<=0)return;player.reload=w.reload;$('reloadLabel').textContent='RELOADING…';sfx('reload')}
function finishReload(){const w=WEAPONS[player.weapon],n=Math.min(w.mag-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;$('reloadLabel').textContent=''}
function swapWeapon(){if(!running||paused)return;const order=['ar','smg','shotgun'],i=order.indexOf(player.weapon);player.weapon=order[(i+1)%order.length];const w=WEAPONS[player.weapon];player.ammo=Math.min(player.ammo,w.mag);player.reserve=Math.max(player.reserve,Math.round(w.reserve*.45));toast(w.name);sfx('swap');updateHUD()}

function muzzleFX(){
  const p=new THREE.Vector3(player.x+player.aimX*.78,1.18,player.z+player.aimZ*.78);const mat=new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:1});const mesh=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),mat);mesh.position.copy(p);scene.add(mesh);const light=new THREE.PointLight(0xffb54d,28,4,2);light.position.copy(p);scene.add(light);fx.push({object:mesh,life:.07,max:.07,kind:'fade'});fx.push({object:light,life:.045,max:.045,kind:'light'});particleBurst(p,0xffce79,.7,4)
}
function tracerFX(x,z){
  const start=new THREE.Vector3(player.x+player.aimX*.7,1.12,player.z+player.aimZ*.7),end=new THREE.Vector3(x,.82,z),geo=new THREE.BufferGeometry().setFromPoints([start,end]),mat=new THREE.LineBasicMaterial({color:0xffd78a,transparent:true,opacity:.7});const line=new THREE.Line(geo,mat);scene.add(line);fx.push({object:line,life:.045,max:.045,kind:'fade'})
}
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
 $('startBtn').onclick=startGame;$('retryBtn').onclick=()=>location.reload();$('qualityBtn').onclick=()=>{qualityHigh=!qualityHigh;$('qualityBtn').textContent='QUALITY: '+(qualityHigh?'HIGH':'PERFORMANCE');renderer.shadowMap.enabled=qualityHigh;resize()};
 $('pauseBtn').onclick=()=>{if(!running)return;paused=true;fireHeld=false;$('pause').classList.remove('hidden')};$('resumeBtn').onclick=()=>{paused=false;$('pause').classList.add('hidden');clock.getDelta()};$('restartBtn').onclick=()=>{resetGame();paused=false;$('pause').classList.add('hidden');banner('EXTRACTION ZONE')};$('menuBtn').onclick=()=>location.reload();$('againBtn').onclick=()=>{$('clear').classList.add('hidden');$('hud').classList.remove('hidden');$('controls').classList.remove('hidden');running=true;resetGame();banner('EXTRACTION ZONE')};
 bindStick($('movePad'),$('moveKnob'),move,false);bindStick($('aimPad'),$('aimKnob'),aim,true);
 const fire=$('fireBtn');fire.onpointerdown=e=>{e.preventDefault();ensureAudio();fireHeld=true;fire.setPointerCapture?.(e.pointerId);fireWeapon()};fire.onpointerup=()=>fireHeld=false;fire.onpointercancel=()=>fireHeld=false;
 $('reloadBtn').onpointerdown=e=>{e.preventDefault();reload()};$('healBtn').onpointerdown=e=>{e.preventDefault();heal()};$('swapBtn').onpointerdown=e=>{e.preventDefault();swapWeapon()};
 ['contextmenu','selectstart','dragstart','gesturestart','gesturechange','gestureend'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));document.addEventListener('touchmove',e=>{if(running)e.preventDefault()},{passive:false});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){paused=true;fireHeld=false;$('pause').classList.remove('hidden')}});
}
function bindStick(el,knob,state,isAim){
 const moveEvent=e=>{if(e.pointerId!==state.id)return;const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,rad=r.width*.33;let dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy)||1,k=Math.min(1,rad/d);dx*=k;dy*=k;state.x=dx/rad;state.y=dy/rad;knob.style.transform=`translate(${dx}px,${dy}px)`};
 const stop=e=>{if(e&&e.pointerId!==state.id)return;state.id=null;if(!isAim){state.x=0;state.y=0}knob.style.transform='translate(0,0)'};
 el.onpointerdown=e=>{e.preventDefault();ensureAudio();state.id=e.pointerId;el.setPointerCapture?.(e.pointerId);moveEvent(e)};el.onpointermove=moveEvent;el.onpointerup=stop;el.onpointercancel=stop;
}

window.__HOBILE_DEBUG={state:()=>({running,paused,qualityHigh,arenaTime,kills,specialKills,waveCount,extractionOpen,player:player&&{x:player.x,z:player.z,hp:player.hp,weapon:player.weapon,ammo:player.ammo},infected:enemies.filter(e=>!e.dead).map(e=>({type:e.type,hp:e.hp,x:e.x,z:e.z})),director}),horde:()=>spawnGroup(16,'runner'),special:t=>spawnEnemy(t||'stalker'),openExtraction:()=>{extractionOpen=true;extractGroup.visible=true},killAll:()=>enemies.forEach(e=>damageEnemy(e,9999))};
