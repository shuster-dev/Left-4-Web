'use strict';

const SUPABASE_URL = 'https://dpffgbdazsjwxxdggugb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H9Y4zUGaoAf2_IQOr_GaIA_qGXk3yRB';
const BUILD = 'Outbreak Alpha 1.1';
const MAX_PLAYERS = 4;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const $ = (id) => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const dist2 = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const now = ()=>performance.now();
const uid = ()=>{
  const a = new Uint32Array(3); crypto.getRandomValues(a);
  return Array.from(a,n=>n.toString(36)).join('').slice(0,18);
};
const randCode = (n=8)=>{
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return Array.from(a,v=>ALPHABET[v%ALPHABET.length]).join('');
};
const fmtTime = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const normAngle = a => Math.atan2(Math.sin(a),Math.cos(a));
const angleDiff = (a,b)=>Math.abs(normAngle(a-b));
const seeded = (n)=>{ let x=Math.sin(n*12.9898+78.233)*43758.5453; return x-Math.floor(x); };

const el = {
  canvas:$('game'),menu:$('menu'),joinModal:$('joinModal'),lobby:$('lobby'),loading:$('loading'),hud:$('hud'),controls:$('controls'),pause:$('pause'),stageClear:$('stageClear'),fatal:$('fatal'),toast:$('toast'),
  soloBtn:$('soloBtn'),createBtn:$('createBtn'),joinBtn:$('joinBtn'),onlineHint:$('onlineHint'),joinCode:$('joinCode'),joinNow:$('joinNow'),joinCancel:$('joinCancel'),roomCode:$('roomCode'),netState:$('netState'),shareBtn:$('shareBtn'),copyBtn:$('copyBtn'),playerList:$('playerList'),playerName:$('playerName'),saveName:$('saveName'),mapSelect:$('mapSelect'),difficulty:$('difficulty'),lobbyHint:$('lobbyHint'),readyBtn:$('readyBtn'),startOnline:$('startOnline'),leaveLobby:$('leaveLobby'),
  loadingMap:$('loadingMap'),loadingText:$('loadingText'),loadingBar:$('loadingBar'),squadHud:$('squadHud'),objective:$('objective'),routeProgress:$('routeProgress'),routeMarker:$('routeMarker'),directorBadge:$('directorBadge'),netBadge:$('netBadge'),waveBanner:$('waveBanner'),centerMsg:$('centerMsg'),pickupToast:$('pickupToast'),weaponName:$('weaponName'),ammo:$('ammo'),reserve:$('reserve'),medCount:$('medCount'),damageFlash:$('damageFlash'),debugHud:$('debugHud'),
  movePad:$('movePad'),moveStick:$('moveStick'),aimPad:$('aimPad'),aimKnob:$('aimKnob'),fireBtn:$('fireBtn'),reloadBtn:$('reloadBtn'),useBtn:$('useBtn'),healBtn:$('healBtn'),swapBtn:$('swapBtn'),pauseBtn:$('pauseBtn'),resumeBtn:$('resumeBtn'),debugBtn:$('debugBtn'),copyDebugBtn:$('copyDebugBtn'),quitBtn:$('quitBtn'),continueBtn:$('continueBtn'),
  resultKills:$('resultKills'),resultSpecial:$('resultSpecial'),resultRevives:$('resultRevives'),resultTime:$('resultTime'),clearTitle:$('clearTitle'),fatalText:$('fatalText'),fatalClose:$('fatalClose'),selftest:$('selftest')
};

const ctx = el.canvas.getContext('2d',{alpha:false,desynchronized:true});
let DPR=1,CW=0,CH=0;
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  CW = innerWidth; CH = innerHeight;
  el.canvas.width = Math.max(1,Math.floor(CW*DPR)); el.canvas.height=Math.max(1,Math.floor(CH*DPR));
  el.canvas.style.width=CW+'px'; el.canvas.style.height=CH+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize',resize,{passive:true}); resize();

document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('gesturestart',e=>e.preventDefault());

const MAPS = {
  ashwood:{id:'ashwood',name:'ASHWOOD ROAD',route:3550,theme:'suburb',sky1:'#0c171c',sky2:'#4a3931',ground:'#222a2b',road:'#262b2c',accent:'#d9b05c',finaleAt:3030,safeX:3440},
  depot:{id:'depot',name:'RIVERSIDE DEPOT',route:3720,theme:'industrial',sky1:'#071218',sky2:'#28333a',ground:'#1b2427',road:'#20282c',accent:'#6bb2bd',finaleAt:3180,safeX:3600},
  highway:{id:'highway',name:'BLACKOUT HIGHWAY',route:3380,theme:'highway',sky1:'#05080e',sky2:'#182033',ground:'#181c23',road:'#20242a',accent:'#cf5d48',finaleAt:2840,safeX:3260}
};
const DIFF = {
  normal:{enemyHp:1,enemyDmg:1,spawn:1},hard:{enemyHp:1.18,enemyDmg:1.25,spawn:1.18},nightmare:{enemyHp:1.42,enemyDmg:1.55,spawn:1.38}
};
const WEAPONS = {
  smg:{id:'smg',name:'RIPPER SMG',damage:18,rpm:780,mag:32,reserve:192,reload:1.7,spread:.095,range:650,pellets:1,color:'#a9d9d3'},
  shotgun:{id:'shotgun',name:'BREACH-8',damage:14,rpm:86,mag:8,reserve:56,reload:2.55,spread:.28,range:420,pellets:8,color:'#e3c98a'},
  rifle:{id:'rifle',name:'WARDEN AR',damage:31,rpm:540,mag:30,reserve:150,reload:2.15,spread:.055,range:820,pellets:1,color:'#b6c58b'}
};
const ENEMY_DEF = {
  drifter:{hp:52,speed:58,damage:8,size:18,score:1},
  rusher:{hp:38,speed:105,damage:7,size:16,score:2,special:true},
  corroder:{hp:105,speed:42,damage:6,size:20,score:3,special:true},
  screecher:{hp:82,speed:50,damage:5,size:18,score:3,special:true},
  brute:{hp:760,speed:52,damage:24,size:35,score:12,special:true}
};

const input={mx:0,my:0,aimX:1,aimY:0,fire:false,use:false,heal:false,reload:false,swap:false,seq:0,fireSeq:0,useSeq:0,healSeq:0,reloadSeq:0,swapSeq:0};
let moveTouch=null,aimTouch=null;
function setStick(knob,dx,dy,max){ knob.style.transform=`translate(${dx*max}px,${dy*max}px)`; }
function resetInput(){ input.mx=input.my=0; input.fire=input.use=input.heal=input.reload=input.swap=false; setStick(el.moveStick,0,0,1); setStick(el.aimKnob,0,0,1); }
function bindPad(node,kind){
  const max=42;
  const start=e=>{ e.preventDefault(); initAudio(); const t=e.changedTouches?e.changedTouches[0]:e; if(kind==='move') moveTouch=t.identifier??'mouse'; else aimTouch=t.identifier??'mouse'; update(t); };
  const update=t=>{ const r=node.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2; let dx=(t.clientX-cx)/max,dy=(t.clientY-cy)/max; const m=Math.hypot(dx,dy); if(m>1){dx/=m;dy/=m;} if(kind==='move'){input.mx=dx;input.my=dy;setStick(el.moveStick,dx,dy,max);} else {if(Math.hypot(dx,dy)>.16){input.aimX=dx;input.aimY=dy;}setStick(el.aimKnob,dx,dy,max);} };
  node.addEventListener('touchstart',start,{passive:false}); node.addEventListener('touchmove',e=>{for(const t of e.changedTouches){if((kind==='move'?moveTouch:aimTouch)===t.identifier) update(t);}e.preventDefault();},{passive:false});
  node.addEventListener('touchend',e=>{for(const t of e.changedTouches){if(kind==='move'&&moveTouch===t.identifier){moveTouch=null;input.mx=input.my=0;setStick(el.moveStick,0,0,max);}if(kind==='aim'&&aimTouch===t.identifier){aimTouch=null;setStick(el.aimKnob,0,0,max);}}},{passive:false});
}
bindPad(el.movePad,'move');bindPad(el.aimPad,'aim');
function holdBtn(node,key,seqKey){
  const on=e=>{e.preventDefault();initAudio();input[key]=true;if(seqKey)input[seqKey]++;}; const off=e=>{e.preventDefault();input[key]=false;};
  node.addEventListener('touchstart',on,{passive:false});node.addEventListener('touchend',off,{passive:false});node.addEventListener('touchcancel',off,{passive:false});node.addEventListener('mousedown',on);addEventListener('mouseup',off);
}
holdBtn(el.fireBtn,'fire','fireSeq');holdBtn(el.useBtn,'use','useSeq');holdBtn(el.healBtn,'heal','healSeq');holdBtn(el.reloadBtn,'reload','reloadSeq');holdBtn(el.swapBtn,'swap','swapSeq');

const keys={}; addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){input.fire=true;input.fireSeq++;}if(e.code==='KeyE'){input.use=true;input.useSeq++;}if(e.code==='KeyR'){input.reload=true;input.reloadSeq++;}if(e.code==='KeyQ'){input.swap=true;input.swapSeq++;}if(e.code==='KeyH'){input.heal=true;input.healSeq++;}}); addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Space')input.fire=false;if(e.code==='KeyE')input.use=false;if(e.code==='KeyR')input.reload=false;if(e.code==='KeyQ')input.swap=false;if(e.code==='KeyH')input.heal=false;});

let audioCtx=null;
function initAudio(){if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();}catch{}} if(audioCtx?.state==='suspended')audioCtx.resume();}
function tone(freq=220,dur=.05,type='square',gain=.04){if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);}
function noiseShot(power=.12,dur=.07){if(!audioCtx)return;const n=Math.floor(audioCtx.sampleRate*dur),b=audioCtx.createBuffer(1,n,audioCtx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=audioCtx.createBufferSource(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();s.buffer=b;f.type='lowpass';f.frequency.value=1400+power*3500;g.gain.value=power;s.connect(f);f.connect(g);g.connect(audioCtx.destination);s.start();}

let toastTimer=0;function toast(msg){el.toast.textContent=msg;el.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove('show'),1800);}
let msgTimer=0;function centerMsg(msg,ms=1600){el.centerMsg.textContent=msg;el.centerMsg.classList.add('show');clearTimeout(msgTimer);msgTimer=setTimeout(()=>el.centerMsg.classList.remove('show'),ms);}
let pickTimer=0;function pickupToast(msg){el.pickupToast.textContent=msg;el.pickupToast.classList.add('show');clearTimeout(pickTimer);pickTimer=setTimeout(()=>el.pickupToast.classList.remove('show'),1300);}
function waveBanner(msg,ms=1400){el.waveBanner.textContent=msg;el.waveBanner.classList.add('show');setTimeout(()=>el.waveBanner.classList.remove('show'),ms);}
function show(id){id.classList.remove('hidden')}function hide(id){id.classList.add('hidden')}

const profile={id:localStorage.getItem('hobile_pid')||uid(),name:localStorage.getItem('hobile_name')||('Survivor '+Math.floor(10+Math.random()*90)),ready:false};
localStorage.setItem('hobile_pid',profile.id);el.playerName.value=profile.name;

let mode='menu';
let game=null;
let lastTs=performance.now(),fps=60,frameMs=16.7;
let cameraX=0;
let debug=false;

function makePlayer(id,name,isBot=false,index=0){
  const w='smg';
  return {id,name,isBot,index,x:110-index*18,y:(index-1.5)*42,vx:0,vy:0,aim:0,hp:100,tempHp:0,downed:false,dead:false,bleed:100,weapon:w,ammo:WEAPONS[w].mag,reserve:WEAPONS[w].reserve,medkits:1,lastShot:0,reloadUntil:0,healUntil:0,reviveTarget:null,reviveProgress:0,kills:0,specialKills:0,revives:0,lastFireSeq:0,lastReloadSeq:0,lastUseSeq:0,lastHealSeq:0,lastSwapSeq:0,flash:0,hurt:0,input:{mx:0,my:0,aimX:1,aimY:0,fire:false,fireSeq:0,reloadSeq:0,use:false,useSeq:0,healSeq:0,swapSeq:0}};
}
function makeGame(opts={}){
  const map=MAPS[opts.map||'ashwood']; const difficulty=opts.difficulty||'normal';
  const world={map,difficulty,players:new Map(),enemies:new Map(),pickups:[],acid:[],particles:[],props:[],nextEnemy:1,nextParticle:1,time:0,startedAt:performance.now(),complete:false,finale:false,finaleTimer:0,safeOpen:false,stats:{kills:0,special:0,revives:0},director:{state:'RELIEF',timer:9,budget:0,peakCount:0,intensity:0},chapter:{objective:'REACH THE SHELTER',events:{bridge:false,gas:false,finale:false}},snapshotSeq:0};
  buildProps(world); buildPickups(world); return world;
}
function buildProps(w){
  const r=[]; for(let x=250;x<w.map.route-200;x+=170){const n=Math.floor(x/170); if(n%3===0)r.push({type:'car',x:x+seeded(n)*80,y:60+seeded(n+3)*60}); if(n%4===1)r.push({type:'tree',x:x+40,y:-125+seeded(n+8)*25}); if(n%5===2)r.push({type:'lamp',x:x+20,y:-88});}
  if(w.map.theme==='industrial'){for(let x=520;x<3200;x+=430)r.push({type:'crate',x,y:105});}
  if(w.map.theme==='highway'){for(let x=420;x<3000;x+=500)r.push({type:'barrier',x,y:-15});}
  w.props=r;
}
function buildPickups(w){
  const list=[
    {x:690,y:-45,type:'ammo'},{x:1030,y:85,type:'weapon',weapon:'shotgun'},{x:1420,y:-80,type:'med'},{x:1880,y:55,type:'ammo'},{x:2210,y:-55,type:'weapon',weapon:'rifle'},{x:2570,y:85,type:'med'},{x:w.map.finaleAt-120,y:-20,type:'ammo'}
  ]; w.pickups=list.map((p,i)=>({...p,id:'p'+i,active:true}));
}
function startSolo(){
  net.leave(); mode='solo'; hide(el.menu); show(el.loading); el.loadingMap.textContent=MAPS.ashwood.name; animateLoading(()=>{
    game=makeGame({map:'ashwood',difficulty:'normal'}); game.players.set(profile.id,makePlayer(profile.id,profile.name,false,0));
    for(let i=1;i<4;i++){const names=['Mara','Jonah','Vale'];game.players.set('bot'+i,makePlayer('bot'+i,names[i-1],true,i));}
    beginPlay();
  });
}
function beginPlay(){ hide(el.loading);hide(el.lobby);hide(el.menu);show(el.hud);show(el.controls);mode=net.inRoom?'online':'solo';cameraX=0;lastTs=performance.now();resetInput();centerMsg(game.map.name,1400);updateHud(); }
function animateLoading(done){let p=0;el.loadingBar.style.width='0%';const iv=setInterval(()=>{p+=18+Math.random()*16;p=Math.min(p,100);el.loadingBar.style.width=p+'%';el.loadingText.textContent=p<45?'Preparing survivors…':p<80?'Warming Director…':'Opening route…';if(p>=100){clearInterval(iv);setTimeout(done,180);}},110);}

function applyKeyboard(){if(mode!=='solo'&&mode!=='online')return;let x=(keys.KeyD?1:0)-(keys.KeyA?1:0),y=(keys.KeyS?1:0)-(keys.KeyW?1:0);if(x||y){const m=Math.hypot(x,y);input.mx=x/m;input.my=y/m;}else if(moveTouch===null){input.mx=input.my=0;} }
function localPlayer(){return game?.players.get(profile.id)};

function updateHost(dt){
  if(!game||game.complete)return; game.time+=dt; applyKeyboard();
  for(const p of game.players.values()){
    if(p.dead)continue;
    let inp;
    if(p.id===profile.id) inp=input;
    else if(p.isBot){ botInput(p,dt); inp=p.input; }
    else inp=p.input||{};
    updatePlayer(p,inp,dt);
  }
  updateDirector(dt); updateEnemies(dt); updateAcid(dt); updatePickups(); updateParticles(dt); updateObjective(dt); botRevives(dt);
}
function updateClient(dt){
  if(!game||game.complete)return; game.time+=dt; applyKeyboard(); const p=localPlayer(); if(p&&!p.dead){updatePredictedPlayer(p,input,dt);} updateParticles(dt);
}
function updatePredictedPlayer(p,inp,dt){
  if(p.downed){p.vx=p.vy=0;return;} const sp=168; let mx=inp.mx||0,my=inp.my||0;const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}p.x=clamp(p.x+mx*sp*dt,0,game.map.safeX+80);p.y=clamp(p.y+my*sp*.72*dt,-135,135); if(Math.hypot(inp.aimX||0,inp.aimY||0)>.1)p.aim=Math.atan2(inp.aimY,inp.aimX); if(inp.fire)p.flash=Math.max(p.flash,.05);p.flash=Math.max(0,p.flash-dt);}
function updatePlayer(p,inp,dt){
  if(p.dead)return; if(p.downed){p.bleed-=dt*3.6;if(p.bleed<=0){p.dead=true;p.downed=false;}return;}
  const sp=p.isBot?154:172; let mx=inp.mx||0,my=inp.my||0;const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}p.vx=mx*sp;p.vy=my*sp*.72;p.x=clamp(p.x+p.vx*dt,0,game.map.safeX+80);p.y=clamp(p.y+p.vy*dt,-135,135); if(Math.hypot(inp.aimX||0,inp.aimY||0)>.1)p.aim=Math.atan2(inp.aimY,inp.aimX);
  if(p.reloadUntil&&game.time>=p.reloadUntil){finishReload(p);} if(p.healUntil&&game.time>=p.healUntil){p.healUntil=0;p.hp=Math.min(100,p.hp+68);p.medkits--; if(p.id===profile.id)pickupToast('MEDKIT USED');}
  if((inp.reload||inp.reloadSeq!==p.lastReloadSeq)){p.lastReloadSeq=inp.reloadSeq||p.lastReloadSeq;tryReload(p);} if((inp.heal||inp.healSeq!==p.lastHealSeq)){p.lastHealSeq=inp.healSeq||p.lastHealSeq;tryHeal(p);} if(inp.swapSeq!==p.lastSwapSeq){p.lastSwapSeq=inp.swapSeq;swapWeapon(p);} if(inp.fire) tryFire(p); if(inp.use) processUse(p,dt); else {p.reviveTarget=null;p.reviveProgress=0;} p.flash=Math.max(0,p.flash-dt);p.hurt=Math.max(0,p.hurt-dt);
}
function tryReload(p){const w=WEAPONS[p.weapon];if(p.reloadUntil||p.ammo>=w.mag||p.reserve<=0||p.downed)return;p.reloadUntil=game.time+w.reload;if(p.id===profile.id){tone(150,.08,'square',.03);pickupToast('RELOADING');}}
function finishReload(p){const w=WEAPONS[p.weapon],need=w.mag-p.ammo,take=Math.min(need,p.reserve);p.ammo+=take;p.reserve-=take;p.reloadUntil=0;if(p.id===profile.id)tone(380,.05,'square',.025);}
function tryHeal(p){if(p.healUntil||p.medkits<=0||p.hp>=92||p.downed)return;p.healUntil=game.time+1.9;if(p.id===profile.id)pickupToast('USING MEDKIT…');}
function swapWeapon(p){const order=['smg','shotgun','rifle'];let i=order.indexOf(p.weapon);p.weapon=order[(i+1)%order.length];const w=WEAPONS[p.weapon];p.ammo=Math.min(p.ammo,w.mag);if(p.id===profile.id)pickupToast(w.name);}
function tryFire(p){
  const w=WEAPONS[p.weapon]; if(p.reloadUntil||p.healUntil||p.downed||p.ammo<=0){if(p.ammo<=0&&p.id===profile.id)tone(95,.025,'square',.02);return;} const gap=60/w.rpm;if(game.time-p.lastShot<gap)return;p.lastShot=game.time;p.ammo--;p.flash=.07;if(p.id===profile.id)noiseShot(p.weapon==='shotgun'?.19:.11,p.weapon==='shotgun'?.11:.06);
  let hitAny=false; for(let k=0;k<w.pellets;k++){const spread=(Math.random()-.5)*w.spread;const a=p.aim+spread;const hit=rayEnemy(p.x,p.y,a,w.range);if(hit){const dmg=w.damage*(.86+Math.random()*.24);damageEnemy(hit,dmg,p);hitAny=true;}}
  if(hitAny&&p.id===profile.id)tone(720,.025,'triangle',.015); for(let i=0;i<(p.weapon==='shotgun'?7:3);i++)spawnParticle(p.x+Math.cos(p.aim)*26,p.y+Math.sin(p.aim)*26,'muzzle',p.aim);
}
function rayEnemy(x,y,a,range){let best=null,bestT=1e9;const dx=Math.cos(a),dy=Math.sin(a);for(const e of game.enemies.values()){if(e.dead)continue;const vx=e.x-x,vy=e.y-y,t=vx*dx+vy*dy;if(t<0||t>range)continue;const px=x+dx*t,py=y+dy*t,d=Math.hypot(e.x-px,e.y-py);const radius=ENEMY_DEF[e.type].size+7;if(d<radius&&t<bestT){best=e;bestT=t;}}return best;}
function damageEnemy(e,dmg,p){e.hp-=dmg;e.hit=.12;const kb=Math.min(16,dmg*.22);e.x+=Math.cos(p.aim)*kb;e.y+=Math.sin(p.aim)*kb*.6;for(let i=0;i<2;i++)spawnParticle(e.x,e.y,'blood',p.aim+Math.PI);if(e.hp<=0&&!e.dead){e.dead=true;e.deadT=1.2;p.kills++;game.stats.kills++;if(ENEMY_DEF[e.type].special){p.specialKills++;game.stats.special++;}if(e.type==='screecher'&&!e.called){/* killed before call */}}}
function processUse(p,dt){
  let target=null,best=50;for(const q of game.players.values()){if(q.id===p.id||q.dead||!q.downed)continue;const d=dist2(p,q);if(d<best){best=d;target=q;}}
  if(target){if(p.reviveTarget!==target.id){p.reviveTarget=target.id;p.reviveProgress=0;}p.reviveProgress+=dt;if(p.id===profile.id)el.objective.textContent=`REVIVING ${target.name.toUpperCase()} ${Math.min(100,Math.floor(p.reviveProgress/2.4*100))}%`;if(p.reviveProgress>=2.4){target.downed=false;target.hp=34;target.bleed=100;p.revives++;game.stats.revives++;p.reviveTarget=null;p.reviveProgress=0;if(p.id===profile.id)centerMsg('TEAMMATE REVIVED');}return;}
  if(p.x>game.map.safeX-70&&game.safeOpen){completeChapter();return;}
  let pick=null;for(const it of game.pickups){if(it.active&&Math.hypot(p.x-it.x,p.y-it.y)<45){pick=it;break;}}if(pick)takePickup(p,pick);
}
function takePickup(p,it){if(!it.active)return;it.active=false;if(it.type==='ammo'){const w=WEAPONS[p.weapon];p.reserve=Math.min(w.reserve,p.reserve+Math.floor(w.reserve*.65));if(p.id===profile.id)pickupToast('AMMO RESTOCKED');}else if(it.type==='med'){p.medkits=Math.min(2,p.medkits+1);if(p.id===profile.id)pickupToast('MEDKIT PICKED UP');}else if(it.type==='weapon'){p.weapon=it.weapon;const w=WEAPONS[p.weapon];p.ammo=w.mag;p.reserve=Math.max(p.reserve,Math.floor(w.reserve*.6));if(p.id===profile.id)pickupToast(w.name+' EQUIPPED');}}
function damagePlayer(p,amount){if(p.dead)return;let dmg=amount;if(p.tempHp>0){const used=Math.min(p.tempHp,dmg);p.tempHp-=used;dmg-=used;}p.hp-=dmg;p.hurt=.18;if(p.id===profile.id){el.damageFlash.style.opacity='.65';setTimeout(()=>el.damageFlash.style.opacity='0',100);}if(p.hp<=0&&!p.downed){p.hp=1;p.downed=true;p.bleed=100;p.reviveProgress=0;waveBanner(p.id===profile.id?'YOU ARE DOWN':'TEAMMATE DOWN',1800);}}

function botInput(p,dt){
  const inp=p.input; let target=null,bd=1e9;for(const e of game.enemies.values()){if(e.dead)continue;const d=dist2(p,e);if(d<bd){bd=d;target=e;}}
  let down=null,dd=999;for(const q of game.players.values()){if(q.downed&&!q.dead&&q.id!==p.id){const d=dist2(p,q);if(d<dd){dd=d;down=q;}}}
  if(down&&dd<360){const dx=down.x-p.x,dy=down.y-p.y,m=Math.hypot(dx,dy)||1;inp.mx=dd>42?dx/m:0;inp.my=dd>42?dy/m:0;inp.use=dd<50;inp.fire=false;inp.aimX=dx/m;inp.aimY=dy/m;return;}
  const human=localPlayer()||[...game.players.values()][0];let fx=human?human.x-(60+p.index*22):p.x,fy=human?human.y+(p.index-1.5)*35:p.y; if(target&&bd<520){const dx=target.x-p.x,dy=target.y-p.y,m=Math.hypot(dx,dy)||1;inp.aimX=dx/m;inp.aimY=dy/m;inp.fire=bd<WEAPONS[p.weapon].range*.82; if(bd<70){fx=p.x-dx/m*70;fy=p.y-dy/m*70;}}
  const dx=fx-p.x,dy=fy-p.y,m=Math.hypot(dx,dy);inp.mx=m>28?dx/m:0;inp.my=m>28?dy/m:0;inp.use=false;if(p.ammo<4){inp.reloadSeq++;inp.fire=false;}if(p.hp<42&&p.medkits>0&&!p.healUntil)inp.healSeq++;
}
function botRevives(dt){/* handled by bot use input */}

function updateDirector(dt){
  const d=game.director; d.timer-=dt; const alive=[...game.players.values()].filter(p=>!p.dead); const avgHp=alive.reduce((s,p)=>s+p.hp,0)/Math.max(1,alive.length); const enemies=[...game.enemies.values()].filter(e=>!e.dead).length;d.intensity=clamp((100-avgHp)/100+enemies/42,0,1.5);
  if(game.finale){d.state='PEAK';d.timer=Math.max(d.timer,2);d.budget+=dt*2.5*DIFF[game.difficulty].spawn;if(enemies<34&&d.budget>1){spawnGroup(2+Math.floor(Math.random()*4));d.budget=0;}return;}
  if(d.timer<=0){if(d.state==='RELIEF'){d.state='BUILD';d.timer=16;}else if(d.state==='BUILD'){d.state='PEAK';d.timer=12;d.peakCount++;waveBanner('HORDE INCOMING');spawnGroup(7+Math.floor(Math.random()*6));if(d.peakCount%2===0)spawnSpecial();}else if(d.state==='PEAK'){d.state='RECOVERY';d.timer=11;}else{d.state='RELIEF';d.timer=12;} }
  if(d.state==='BUILD'){d.budget+=dt*.42*DIFF[game.difficulty].spawn;if(d.budget>1.2&&enemies<28){spawnGroup(1);d.budget=0;}} if(d.state==='PEAK'&&enemies<34&&Math.random()<dt*.5)spawnGroup(1+Math.floor(Math.random()*2));
}
function spawnGroup(count,type='drifter'){for(let i=0;i<count;i++)spawnEnemy(type);}
function spawnSpecial(){const pool=['rusher','corroder','screecher'];spawnEnemy(pool[Math.floor(Math.random()*pool.length)]);}
function spawnEnemy(type='drifter',x=null,y=null){if(!game)return;const lead=Math.max(...[...game.players.values()].filter(p=>!p.dead).map(p=>p.x),0);if(x==null){const ahead=Math.random()<.78;x=clamp(lead+(ahead?440+Math.random()*300:-(360+Math.random()*260)),30,game.map.safeX-80);}if(y==null)y=-130+Math.random()*260;const def=ENEMY_DEF[type];const e={id:'e'+game.nextEnemy++,type,x,y,hp:def.hp*DIFF[game.difficulty].enemyHp,dead:false,deadT:0,attackCd:Math.random(),abilityCd:1.5+Math.random()*2,hit:0,called:false,seed:Math.random()*999};game.enemies.set(e.id,e);return e;}
function updateEnemies(dt){
  for(const e of [...game.enemies.values()]){const def=ENEMY_DEF[e.type];if(e.dead){e.deadT-=dt;if(e.deadT<=0)game.enemies.delete(e.id);continue;}e.hit=Math.max(0,e.hit-dt);e.attackCd-=dt;e.abilityCd-=dt;let target=null,bd=1e9;for(const p of game.players.values()){if(p.dead)continue;const d=dist2(e,p);if(d<bd){bd=d;target=p;}}if(!target)continue;
    if(e.type==='corroder'&&e.abilityCd<=0&&bd<420){e.abilityCd=4.4;game.acid.push({x:target.x,y:target.y,r:8,maxR:60,t:6,arm:.75});}
    if(e.type==='screecher'&&!e.called&&e.abilityCd<=0&&bd<500){e.called=true;e.abilityCd=99;waveBanner('SCREECHER CALLED A HORDE');spawnGroup(8+Math.floor(Math.random()*5));tone(560,.5,'sawtooth',.025);}
    if(e.type==='brute'&&e.abilityCd<=0&&bd<280){e.abilityCd=4;const dx=(target.x-e.x)/Math.max(1,bd),dy=(target.y-e.y)/Math.max(1,bd);e.x+=dx*95;e.y+=dy*65;}
    const dx=target.x-e.x,dy=target.y-e.y,m=Math.hypot(dx,dy)||1;let speed=def.speed; if(e.type==='screecher'&&e.called)speed*=.85;e.x+=dx/m*speed*dt;e.y+=dy/m*speed*.78*dt;e.y=clamp(e.y,-140,140);
    if(bd<def.size+24&&e.attackCd<=0){e.attackCd=e.type==='brute'?1.15:.72;damagePlayer(target,def.damage*DIFF[game.difficulty].enemyDmg);}
  }
}
function updateAcid(dt){for(const a of game.acid){a.t-=dt;a.arm-=dt;a.r=lerp(a.r,a.maxR,dt*2.7);if(a.arm<=0){for(const p of game.players.values()){if(!p.dead&&Math.hypot(p.x-a.x,p.y-a.y)<a.r)damagePlayer(p,8*dt*DIFF[game.difficulty].enemyDmg);}}}game.acid=game.acid.filter(a=>a.t>0);}
function updatePickups(){for(const p of game.players.values()){if(p.dead)continue;for(const it of game.pickups){if(!it.active)continue;const d=Math.hypot(p.x-it.x,p.y-it.y);if(d<34&&it.type==='ammo')takePickup(p,it);if(p.id===profile.id&&d<55&&it.type!=='ammo')el.objective.textContent='PRESS USE TO PICK UP '+(it.type==='med'?'MEDKIT':WEAPONS[it.weapon].name);}}}
function spawnParticle(x,y,type,a=0){if(!game)return;game.particles.push({id:game.nextParticle++,x,y,type,a,vx:Math.cos(a)*(30+Math.random()*70)+(Math.random()-.5)*45,vy:Math.sin(a)*(20+Math.random()*45)+(Math.random()-.5)*35,t:type==='blood'?.55:.18});}
function updateParticles(dt){for(const p of game.particles){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.93;p.vy*=.93;}game.particles=game.particles.filter(p=>p.t>0);}
function updateObjective(dt){
  const human=localPlayer()||[...game.players.values()][0]; if(!human)return;
  if(!game.finale&&human.x>game.map.finaleAt){game.finale=true;game.finaleTimer=38;game.chapter.objective='HOLD THE SHELTER GATE';waveBanner('FINAL HOLDOUT',1800);spawnGroup(12);setTimeout(()=>{if(game&&!game.complete)spawnEnemy('brute',game.map.finaleAt+430,0);},5000);}
  if(game.finale&&!game.safeOpen){game.finaleTimer-=dt;if(game.finaleTimer<=0){game.safeOpen=true;game.chapter.objective='ENTER THE SHELTER';waveBanner('SHELTER OPEN',1600);tone(740,.35,'triangle',.03);}}
  if(!human.reviveTarget)el.objective.textContent=game.chapter.objective;
}
function completeChapter(){if(game.complete)return;game.complete=true;hide(el.controls);setTimeout(()=>{el.resultKills.textContent=game.stats.kills;el.resultSpecial.textContent=game.stats.special;el.resultRevives.textContent=game.stats.revives;el.resultTime.textContent=fmtTime(game.time);el.clearTitle.textContent=game.map.name+' CLEARED';show(el.stageClear);},500);if(net.isHost&&net.inRoom)net.sendControl({t:'complete',stats:game.stats,time:game.time});}

function worldToScreen(x,y){const view=1040,scale=CW/view,sx=(x-cameraX)*scale+CW*.34,depth=(y+140)/280,sy=CH*.43+depth*CH*.34;return {x:sx,y:sy,s:scale*(.78+depth*.28)};}
function render(){if(!game||!(mode==='solo'||mode==='online')){renderMenuBackdrop();return;}const map=game.map;const lead=localPlayer()||[...game.players.values()][0];if(lead)cameraX=lerp(cameraX,lead.x+150,0.07);cameraX=clamp(cameraX,220,map.safeX-450);drawWorld(map);}
function renderMenuBackdrop(){ctx.fillStyle='#071014';ctx.fillRect(0,0,CW,CH);}
function drawWorld(map){
  const grad=ctx.createLinearGradient(0,0,0,CH);grad.addColorStop(0,map.sky1);grad.addColorStop(.58,map.sky2);grad.addColorStop(1,map.ground);ctx.fillStyle=grad;ctx.fillRect(0,0,CW,CH);
  drawSkyline(map); drawRoad(map); drawFarProps();
  const drawables=[];for(const p of game.props)drawables.push({kind:'prop',y:p.y,obj:p});for(const it of game.pickups)if(it.active)drawables.push({kind:'pickup',y:it.y,obj:it});for(const a of game.acid)drawables.push({kind:'acid',y:a.y,obj:a});for(const e of game.enemies.values())drawables.push({kind:'enemy',y:e.y,obj:e});for(const p of game.players.values())drawables.push({kind:'player',y:p.y,obj:p});drawables.sort((a,b)=>a.y-b.y);for(const d of drawables){if(d.kind==='prop')drawProp(d.obj);else if(d.kind==='pickup')drawPickup(d.obj);else if(d.kind==='acid')drawAcid(d.obj);else if(d.kind==='enemy')drawEnemy(d.obj);else drawPlayer(d.obj);}for(const p of game.particles)drawParticle(p);drawWeather();
}
function drawSkyline(map){
  ctx.save();const off=-(cameraX*.08)%180;ctx.fillStyle='rgba(5,9,11,.55)';for(let x=off-180;x<CW+180;x+=180){const h=50+seeded(Math.floor((x+cameraX*.08)/180))*90;ctx.fillRect(x,CH*.31-h,120,h);ctx.fillRect(x+18,CH*.31-h-24,18,24);}ctx.fillStyle='rgba(8,12,13,.72)';const off2=-(cameraX*.15)%130;for(let x=off2-130;x<CW+130;x+=130){const h=28+seeded(Math.floor((x+cameraX*.15)/130)+90)*54;ctx.fillRect(x,CH*.37-h,92,h);}ctx.restore();
}
function drawRoad(map){
  const top=CH*.42,bottom=CH*.88;ctx.fillStyle=map.ground;ctx.fillRect(0,top,CW,CH-top);ctx.beginPath();ctx.moveTo(0,top+15);ctx.lineTo(CW,top+15);ctx.lineTo(CW,bottom);ctx.lineTo(0,bottom);ctx.closePath();ctx.fillStyle=map.road;ctx.fill();
  const spacing=180,phase=((cameraX%spacing)/spacing)*CW/(1040/spacing);ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle='#d8d3b0';ctx.lineWidth=2;for(let wx=Math.floor((cameraX-300)/spacing)*spacing;wx<cameraX+1000;wx+=spacing){const p1=worldToScreen(wx,0),p2=worldToScreen(wx+70,0);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();}ctx.globalAlpha=.16;ctx.strokeStyle='#8da09b';ctx.beginPath();ctx.moveTo(0,worldToScreen(cameraX,-118).y);ctx.lineTo(CW,worldToScreen(cameraX,-118).y);ctx.stroke();ctx.beginPath();ctx.moveTo(0,worldToScreen(cameraX,118).y);ctx.lineTo(CW,worldToScreen(cameraX,118).y);ctx.stroke();ctx.restore();
  const sx=worldToScreen(map.safeX,0);if(sx.x>-100&&sx.x<CW+140){ctx.save();ctx.fillStyle=game.safeOpen?'#4e6b52':'#30383a';ctx.fillRect(sx.x-35,CH*.29,90,CH*.57);ctx.fillStyle='#11191b';ctx.fillRect(sx.x-10,CH*.48,48,CH*.38);ctx.fillStyle=game.safeOpen?'#d8e45f':'#c45d54';ctx.fillRect(sx.x+7,CH*.44,12,8);ctx.font='900 10px sans-serif';ctx.fillStyle='#dce8df';ctx.fillText('SHELTER',sx.x-20,CH*.35);ctx.restore();}
}
function drawFarProps(){/* reserved for layered depth */}
function drawProp(p){const s=worldToScreen(p.x,p.y);if(s.x<-120||s.x>CW+120)return;ctx.save();ctx.translate(s.x,s.y);if(p.type==='car'){ctx.fillStyle='#12191c';ctx.fillRect(-35*s.s,-13*s.s,70*s.s,24*s.s);ctx.fillStyle='#342b2c';ctx.fillRect(-20*s.s,-27*s.s,38*s.s,18*s.s);ctx.fillStyle='#050708';for(const x of[-23,23]){ctx.beginPath();ctx.arc(x*s.s,12*s.s,8*s.s,0,Math.PI*2);ctx.fill();}}else if(p.type==='tree'){ctx.fillStyle='#222019';ctx.fillRect(-5*s.s,-55*s.s,10*s.s,58*s.s);ctx.fillStyle='#111a16';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc((i-1.5)*10*s.s,-52*s.s+(i%2)*9*s.s,22*s.s,0,Math.PI*2);ctx.fill();}}else if(p.type==='lamp'){ctx.fillStyle='#111719';ctx.fillRect(-2*s.s,-82*s.s,4*s.s,83*s.s);ctx.fillStyle='#c7bb7d';ctx.globalAlpha=.7;ctx.fillRect(-7*s.s,-84*s.s,14*s.s,5*s.s);ctx.globalAlpha=.08;ctx.beginPath();ctx.moveTo(-35*s.s,-78*s.s);ctx.lineTo(35*s.s,-78*s.s);ctx.lineTo(18*s.s,10*s.s);ctx.lineTo(-18*s.s,10*s.s);ctx.fillStyle='#f4dda0';ctx.fill();}else if(p.type==='crate'){ctx.fillStyle='#40362a';ctx.fillRect(-18*s.s,-22*s.s,36*s.s,24*s.s);ctx.strokeStyle='#79664d';ctx.strokeRect(-18*s.s,-22*s.s,36*s.s,24*s.s);}else if(p.type==='barrier'){ctx.fillStyle='#8a7c6d';ctx.fillRect(-28*s.s,-10*s.s,56*s.s,12*s.s);ctx.fillStyle='#ad5e48';ctx.fillRect(-22*s.s,-9*s.s,12*s.s,10*s.s);ctx.fillRect(5*s.s,-9*s.s,12*s.s,10*s.s);}ctx.restore();}
function drawPickup(it){const s=worldToScreen(it.x,it.y);if(s.x<-50||s.x>CW+50)return;const bob=Math.sin(game.time*3+it.id.charCodeAt(1))*.05;ctx.save();ctx.translate(s.x,s.y-8);ctx.scale(s.s*(1+bob),s.s*(1+bob));ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(0,5,20,6,0,0,Math.PI*2);ctx.fill();if(it.type==='ammo'){ctx.fillStyle='#a8914d';ctx.fillRect(-12,-14,24,16);ctx.fillStyle='#d9c276';for(let i=-7;i<=7;i+=7)ctx.fillRect(i,-18,3,8);}else if(it.type==='med'){ctx.fillStyle='#e7e8df';ctx.fillRect(-13,-19,26,24);ctx.fillStyle='#b63d39';ctx.fillRect(-3,-16,6,17);ctx.fillRect(-8,-11,16,6);}else{ctx.fillStyle=WEAPONS[it.weapon].color;ctx.fillRect(-21,-7,38,6);ctx.fillRect(6,-6,6,15);ctx.fillStyle='#1a2021';ctx.fillRect(-10,-5,11,13);}ctx.restore();}
function drawAcid(a){const s=worldToScreen(a.x,a.y);ctx.save();ctx.globalAlpha=clamp(a.t/2,0,.55);ctx.fillStyle='#88c846';ctx.beginPath();ctx.ellipse(s.x,s.y,a.r*s.s,a.r*s.s*.34,0,0,Math.PI*2);ctx.fill();ctx.restore();}
function drawPlayer(p){const s=worldToScreen(p.x,p.y);if(s.x<-80||s.x>CW+80)return;ctx.save();ctx.translate(s.x,s.y);ctx.scale(s.s,s.s);ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(0,5,18,6,0,0,Math.PI*2);ctx.fill();const down=p.downed||p.dead;if(down){ctx.rotate(-.12);ctx.fillStyle=p.dead?'#333':'#7e4842';ctx.fillRect(-22,-9,42,11);ctx.fillStyle='#c49b7a';ctx.beginPath();ctx.arc(23,-7,7,0,Math.PI*2);ctx.fill();ctx.restore();return;}const walk=Math.sin(game.time*9+p.index)*Math.min(1,Math.hypot(p.vx,p.vy)/120);ctx.strokeStyle='#12181a';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-5,-16);ctx.lineTo(-8+walk*5,4);ctx.moveTo(5,-16);ctx.lineTo(9-walk*5,4);ctx.stroke();ctx.fillStyle=p.id===profile.id?'#496b67':p.isBot?'#596457':'#4d5c78';ctx.fillRect(-10,-38,20,25);ctx.fillStyle='#caa486';ctx.beginPath();ctx.arc(0,-46,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#181d1e';ctx.fillRect(-7,-54,14,5);const ax=Math.cos(p.aim),ay=Math.sin(p.aim);ctx.strokeStyle=WEAPONS[p.weapon].color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(2,-29);ctx.lineTo(2+ax*28,-29+ay*21);ctx.stroke();ctx.fillStyle='#161b1d';ctx.fillRect(-7,-38,5,18);if(p.flash>0){ctx.globalAlpha=clamp(p.flash/.07,0,1);ctx.fillStyle='#fff2a6';ctx.beginPath();ctx.arc(2+ax*31,-29+ay*21,6,0,Math.PI*2);ctx.fill();}ctx.restore();if(p.reviveProgress>0){ctx.fillStyle='#63e5b7';ctx.fillRect(s.x-18,s.y-58*s.s,36*clamp(p.reviveProgress/2.4,0,1),3);}}
function drawEnemy(e){const s=worldToScreen(e.x,e.y);if(s.x<-100||s.x>CW+100)return;const def=ENEMY_DEF[e.type];ctx.save();ctx.translate(s.x,s.y);ctx.scale(s.s*(e.type==='brute'?1.25:1),s.s*(e.type==='brute'?1.25:1));ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(0,6,def.size,6,0,0,Math.PI*2);ctx.fill();if(e.dead){ctx.rotate(.18);ctx.fillStyle='#3a3430';ctx.fillRect(-20,-8,39,10);ctx.fillStyle='#8f7d68';ctx.beginPath();ctx.arc(22,-7,6,0,Math.PI*2);ctx.fill();ctx.restore();return;}const lean=Math.sin(game.time*7+e.seed)*2;let body='#4f5148',skin='#978977';if(e.type==='rusher')body='#694343';if(e.type==='corroder')body='#4f6446';if(e.type==='screecher')body='#5e4d68';if(e.type==='brute')body='#58463d';if(e.hit>0)body='#a85a51';ctx.strokeStyle='#262b28';ctx.lineWidth=e.type==='brute'?8:5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-5,-15);ctx.lineTo(-10+lean,5);ctx.moveTo(5,-15);ctx.lineTo(10-lean,5);ctx.stroke();ctx.fillStyle=body;ctx.fillRect(-10-(e.type==='brute'?5:0),-38,20+(e.type==='brute'?10:0),25);ctx.fillStyle=skin;ctx.beginPath();ctx.arc(lean,-46,e.type==='brute'?10:7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#cf4d42';ctx.fillRect(-4+lean,-48,2,2);ctx.fillRect(2+lean,-48,2,2);if(e.type==='corroder'){ctx.fillStyle='#91b84b';ctx.beginPath();ctx.arc(-13,-28,7,0,Math.PI*2);ctx.fill();}if(e.type==='screecher'&&!e.called){ctx.strokeStyle='#c791db';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-45,13+Math.sin(game.time*8)*2,0,Math.PI*2);ctx.stroke();}ctx.restore();}
function drawParticle(p){const s=worldToScreen(p.x,p.y);ctx.save();ctx.globalAlpha=clamp(p.t*3,0,1);ctx.fillStyle=p.type==='blood'?'#8f2f2b':'#ffd783';ctx.beginPath();ctx.arc(s.x,s.y,(p.type==='blood'?2.4:3.2)*s.s,0,Math.PI*2);ctx.fill();ctx.restore();}
function drawWeather(){ctx.save();ctx.strokeStyle='rgba(190,214,213,.12)';ctx.lineWidth=1;const t=game.time*120;for(let i=0;i<50;i++){const x=(i*97+t*1.8)% (CW+80)-40,y=(i*53+t*.9)% (CH+60)-30;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+13);ctx.stroke();}ctx.restore();}

function updateHud(){if(!game)return;const p=localPlayer();if(p){const w=WEAPONS[p.weapon];el.weaponName.textContent=w.name+(p.reloadUntil?' · RELOADING':'');el.ammo.textContent=p.ammo;el.reserve.textContent=p.reserve;el.medCount.textContent='MED ×'+p.medkits;const prog=clamp(p.x/game.map.safeX,0,1)*100;el.routeProgress.style.width=prog+'%';el.routeMarker.style.left=`calc(${prog}% - 4px)`;}el.directorBadge.textContent=game.director.state;el.netBadge.textContent=net.inRoom?(net.transport==='webrtc'?'P2P':net.transport==='fallback'?'SUPABASE':'CONNECTING'):'LOCAL';renderSquadHud();if(debug)updateDebug();}
function renderSquadHud(){el.squadHud.innerHTML='';for(const p of game.players.values()){const d=document.createElement('div');d.className='hud-person'+(p.downed||p.dead?' down':'');d.innerHTML=`<div class="hud-face"></div><div><small>${escapeHtml(p.name)}${p.isBot?' · BOT':''}</small><div class="mini-hp"><i class="${p.hp<35?'low':''}" style="width:${clamp(p.hp,0,100)}%"></i></div></div>`;el.squadHud.appendChild(d);}}
function updateDebug(){const p=localPlayer();el.debugHud.textContent=`${BUILD}\nFPS ${fps.toFixed(0)} · ${frameMs.toFixed(1)}ms\nMode ${mode}\nMap ${game.map.id}\nEntities ${game.enemies.size} · particles ${game.particles.length}\nDirector ${game.director.state} ${game.director.timer.toFixed(1)}\nRoom ${net.room||'-'}\nTransport ${net.transport}\nHost ${net.hostId||'-'} ${net.isHost?'(YOU)':''}\nPeers ${net.peers.size}\nPlayer ${p?`${p.x.toFixed(0)},${p.y.toFixed(0)} HP ${p.hp.toFixed(0)}`:'-'}`;}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

const net={
  sb:null,channel:null,inRoom:false,room:null,isHost:false,hostId:null,presence:{},peers:new Map(),transport:'offline',lastInputSend:0,lastSnapshot:0,lastFallback:0,lastSnapshotSeq:0,map:'ashwood',difficulty:'normal',starting:false,joinTs:0,
  init(){
    if(window.supabase?.createClient){try{this.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:20}}});el.onlineHint.textContent='Online ready · Supabase Realtime';el.onlineHint.className='online-hint ok';}catch(e){this.sb=null;this.failHint(e.message);}}
    else{this.failHint('Supabase library unavailable. Solo still works.');}
    const q=new URLSearchParams(location.search);const room=(q.get('room')||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,8);if(room){setTimeout(()=>this.join(room,true),500);}
  },
  failHint(m){el.onlineHint.textContent='Online unavailable right now · '+m;el.onlineHint.className='online-hint bad';},
  async create(){if(!this.sb){showFatal('Online library did not load. Check internet and redeploy.');return;}await this.join(randCode(8),false);},
  async join(code,fromLink=false){
    code=(code||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,8);if(code.length!==8){toast('Room code must be 8 characters');return;}if(!this.sb){showFatal('Supabase Realtime is unavailable. Solo mode still works.');return;}this.leave();this.room=code;this.inRoom=true;this.transport='signaling';this.joinTs=Date.now()+Math.random();profile.ready=false;hide(el.menu);hide(el.joinModal);show(el.lobby);el.roomCode.textContent=code;el.netState.textContent='CONNECTING';el.netState.className='net-state'; history.replaceState(null,'',location.pathname+'?room='+code);
    this.channel=this.sb.channel('outbreak:'+code,{config:{presence:{key:profile.id},broadcast:{self:true,ack:false}}});
    this.channel.on('presence',{event:'sync'},()=>this.syncPresence()).on('broadcast',{event:'room'},m=>this.onRoom(m.payload)).on('broadcast',{event:'signal'},m=>this.onSignal(m.payload)).on('broadcast',{event:'game'},m=>this.onFallback(m.payload));
    this.channel.subscribe(async status=>{if(status==='SUBSCRIBED'){el.netState.textContent='ONLINE';el.netState.className='net-state good';await this.track();setTimeout(()=>this.syncPresence(),100);toast(fromLink?'Invite opened':'Room created');}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){el.netState.textContent='RETRY';el.netState.className='net-state warn';}});
  },
  async track(){if(!this.channel)return;await this.channel.track({id:profile.id,name:profile.name,ready:profile.ready,joinTs:this.joinTs||Date.now(),build:BUILD});},
  syncPresence(){if(!this.channel)return;const raw=this.channel.presenceState();const people={};for(const [k,arr] of Object.entries(raw)){const m=arr?.[0];if(m?.id)people[m.id]=m;}this.presence=people;const ids=Object.values(people).sort((a,b)=>(a.joinTs||0)-(b.joinTs||0));this.hostId=ids[0]?.id||profile.id;const was=this.isHost;this.isHost=this.hostId===profile.id;renderLobby();if(this.isHost&&!was&&this.inRoom){this.transport='webrtc';this.sendRoom({t:'config',map:this.map,difficulty:this.difficulty});}
    if(!this.isHost&&this.hostId&&this.inRoom&&!this.peers.has(this.hostId))this.connectToHost(this.hostId);
    if(this.isHost){for(const m of ids){if(m.id!==profile.id&&!this.peers.has(m.id))this.peers.set(m.id,{id:m.id,pc:null,fast:null,ctrl:null,status:'waiting',fallback:true,pendingIce:[]});}}
    for(const id of [...this.peers.keys()])if(!people[id])this.dropPeer(id);
  },
  sendRoom(payload){if(this.channel)this.channel.send({type:'broadcast',event:'room',payload:{...payload,from:profile.id}});},
  onRoom(m){if(!m||m.from===profile.id)return;if(m.t==='config'){this.map=m.map||this.map;this.difficulty=m.difficulty||this.difficulty;el.mapSelect.value=this.map;el.difficulty.value=this.difficulty;}
    if(m.t==='start'&&!this.isHost){this.map=m.map;this.difficulty=m.difficulty;this.startClient(m);}
    if(m.t==='complete'&&!this.isHost&&game&&!game.complete){game.complete=true;hide(el.controls);el.resultKills.textContent=m.stats?.kills||0;el.resultSpecial.textContent=m.stats?.special||0;el.resultRevives.textContent=m.stats?.revives||0;el.resultTime.textContent=fmtTime(m.time||game.time);show(el.stageClear);}
  },
  async connectToHost(hostId){const peer=this.makePeer(hostId,false);try{const fast=peer.pc.createDataChannel('fast',{ordered:false,maxRetransmits:0});const ctrl=peer.pc.createDataChannel('ctrl',{ordered:true});this.attachChannel(peer,fast,'fast');this.attachChannel(peer,ctrl,'ctrl');const offer=await peer.pc.createOffer();await peer.pc.setLocalDescription(offer);this.signal(hostId,{kind:'offer',sdp:peer.pc.localDescription});setTimeout(()=>{if(peer.status!=='open'){peer.fallback=true;this.transport='fallback';renderLobby();}},7000);}catch(e){peer.fallback=true;this.transport='fallback';}},
  makePeer(id,hostSide){if(this.peers.has(id)&&this.peers.get(id).pc)return this.peers.get(id);const peer=this.peers.get(id)||{id,pc:null,fast:null,ctrl:null,status:'new',fallback:true,pendingIce:[]};const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});peer.pc=pc;peer.status='connecting';pc.onicecandidate=e=>{if(e.candidate)this.signal(id,{kind:'ice',candidate:e.candidate});};pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected'){peer.fallback=false;peer.status='open';this.transport='webrtc';renderLobby();}if(['failed','disconnected','closed'].includes(pc.connectionState)){peer.fallback=true;if(!this.isHost)this.transport='fallback';}};pc.ondatachannel=e=>this.attachChannel(peer,e.channel,e.channel.label);this.peers.set(id,peer);return peer;},
  attachChannel(peer,ch,label){if(label==='fast')peer.fast=ch;else peer.ctrl=ch;ch.onopen=()=>{peer.status='open';peer.fallback=false;this.transport='webrtc';renderLobby();};ch.onmessage=e=>{try{this.onData(peer.id,JSON.parse(e.data));}catch{}};ch.onclose=()=>{peer.fallback=true;};},
  signal(to,data){if(this.channel)this.channel.send({type:'broadcast',event:'signal',payload:{from:profile.id,to,...data}});},
  async onSignal(m){if(!m||m.to!==profile.id||m.from===profile.id)return;try{if(m.kind==='offer'&&this.isHost){const peer=this.makePeer(m.from,true);await peer.pc.setRemoteDescription(m.sdp);for(const c of peer.pendingIce.splice(0)){try{await peer.pc.addIceCandidate(c);}catch{}}const ans=await peer.pc.createAnswer();await peer.pc.setLocalDescription(ans);this.signal(m.from,{kind:'answer',sdp:peer.pc.localDescription});}else if(m.kind==='answer'&&!this.isHost){const peer=this.peers.get(m.from);if(peer?.pc){await peer.pc.setRemoteDescription(m.sdp);for(const c of peer.pendingIce.splice(0)){try{await peer.pc.addIceCandidate(c);}catch{}}}}else if(m.kind==='ice'){let peer=this.peers.get(m.from);if(!peer)peer=this.makePeer(m.from,this.isHost);if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(m.candidate);else peer.pendingIce.push(m.candidate);}}catch(e){console.warn('signal',e);const peer=this.peers.get(m.from);if(peer)peer.fallback=true;}},
  onData(from,m){if(this.isHost){if(m.t==='input'&&game){const p=game.players.get(from);if(p){p.input=m.i;p.input.fire=!!m.i.fire;}}else if(m.t==='ready'){} }else if(from===this.hostId){if(m.t==='snapshot')this.applySnapshot(m.s);else if(m.t==='event')this.applyEvent(m);else if(m.t==='complete'){if(game&&!game.complete){game.complete=true;hide(el.controls);el.resultKills.textContent=m.stats?.kills||0;el.resultSpecial.textContent=m.stats?.special||0;el.resultRevives.textContent=m.stats?.revives||0;el.resultTime.textContent=fmtTime(m.time||game.time);el.clearTitle.textContent=game.map.name+' CLEARED';show(el.stageClear);}}}},
  sendFastTo(id,msg){const p=this.peers.get(id);if(p?.fast?.readyState==='open'){try{p.fast.send(JSON.stringify(msg));return true;}catch{}}return false;},
  sendCtrlTo(id,msg){const p=this.peers.get(id);if(p?.ctrl?.readyState==='open'){try{p.ctrl.send(JSON.stringify(msg));return true;}catch{}}return false;},
  sendControl(msg){if(this.isHost){for(const id of Object.keys(this.presence))if(id!==profile.id){if(!this.sendCtrlTo(id,msg))this.sendFallback(id,msg);}}else if(this.hostId){if(!this.sendCtrlTo(this.hostId,msg))this.sendFallback(this.hostId,msg);}},
  sendFallback(to,msg){if(this.channel)this.channel.send({type:'broadcast',event:'game',payload:{from:profile.id,to,msg}});},
  onFallback(p){if(!p||p.from===profile.id|| (p.to&&p.to!==profile.id))return;this.transport='fallback';this.onData(p.from,p.msg);},
  hasFallbackPeer(){return [...this.peers.values()].some(p=>p.id&&p.fallback);},
  sendInput(){if(!this.inRoom||this.isHost||!game||!this.hostId)return;const packet={t:'input',i:{mx:input.mx,my:input.my,aimX:input.aimX,aimY:input.aimY,fire:input.fire,fireSeq:input.fireSeq,reloadSeq:input.reloadSeq,use:input.use,useSeq:input.useSeq,healSeq:input.healSeq,swapSeq:input.swapSeq,seq:++input.seq}};if(!this.sendFastTo(this.hostId,packet))this.sendFallback(this.hostId,packet);},
  snapshot(){if(!game)return null;return {seq:++game.snapshotSeq,t:game.time,map:game.map.id,difficulty:game.difficulty,director:{state:game.director.state,timer:game.director.timer},finale:game.finale,finaleTimer:game.finaleTimer,safeOpen:game.safeOpen,objective:game.chapter.objective,players:[...game.players.values()].map(p=>({id:p.id,name:p.name,isBot:p.isBot,index:p.index,x:+p.x.toFixed(1),y:+p.y.toFixed(1),aim:+p.aim.toFixed(3),hp:+p.hp.toFixed(1),tempHp:+p.tempHp.toFixed(1),downed:p.downed,dead:p.dead,bleed:+p.bleed.toFixed(1),weapon:p.weapon,ammo:p.ammo,reserve:p.reserve,medkits:p.medkits,kills:p.kills,specialKills:p.specialKills,revives:p.revives,flash:p.flash})),enemies:[...game.enemies.values()].map(e=>({id:e.id,type:e.type,x:+e.x.toFixed(1),y:+e.y.toFixed(1),hp:+e.hp.toFixed(1),dead:e.dead,hit:e.hit,called:e.called})),pickups:game.pickups.map(p=>({id:p.id,active:p.active})),acid:game.acid.map((a,i)=>({id:i,x:+a.x.toFixed(1),y:+a.y.toFixed(1),r:+a.r.toFixed(1),t:+a.t.toFixed(1)})),stats:game.stats};},
  sendSnapshot(){if(!this.inRoom||!this.isHost||!game)return;const s=this.snapshot();for(const id of Object.keys(this.presence)){if(id===profile.id)continue;const msg={t:'snapshot',s};if(!this.sendFastTo(id,msg))this.sendFallback(id,msg);}},
  applySnapshot(s){if(!s||s.seq<=this.lastSnapshotSeq)return;this.lastSnapshotSeq=s.seq;if(!game)return;game.director.state=s.director?.state||game.director.state;game.director.timer=s.director?.timer||0;game.finale=!!s.finale;game.finaleTimer=s.finaleTimer||0;game.safeOpen=!!s.safeOpen;game.chapter.objective=s.objective||game.chapter.objective;game.stats=s.stats||game.stats;
    const seen=new Set();for(const sp of s.players||[]){seen.add(sp.id);let p=game.players.get(sp.id);if(!p){p=makePlayer(sp.id,sp.name,sp.isBot,sp.index);game.players.set(sp.id,p);}if(sp.id===profile.id){p.x=lerp(p.x,sp.x,.22);p.y=lerp(p.y,sp.y,.22);}else{p.x=lerp(p.x,sp.x,.42);p.y=lerp(p.y,sp.y,.42);}Object.assign(p,{name:sp.name,isBot:sp.isBot,index:sp.index,aim:sp.aim,hp:sp.hp,tempHp:sp.tempHp,downed:sp.downed,dead:sp.dead,bleed:sp.bleed,weapon:sp.weapon,ammo:sp.ammo,reserve:sp.reserve,medkits:sp.medkits,kills:sp.kills,specialKills:sp.specialKills,revives:sp.revives,flash:sp.flash});}
    for(const [id,p] of [...game.players])if(!seen.has(id)&&p.isBot)game.players.delete(id);
    const eseen=new Set();for(const se of s.enemies||[]){eseen.add(se.id);let e=game.enemies.get(se.id);if(!e){e={...se,deadT:1,seed:Math.random()*999,attackCd:0,abilityCd:0};game.enemies.set(se.id,e);}else{e.x=lerp(e.x,se.x,.5);e.y=lerp(e.y,se.y,.5);Object.assign(e,{type:se.type,hp:se.hp,dead:se.dead,hit:se.hit,called:se.called});}}for(const [id] of [...game.enemies])if(!eseen.has(id))game.enemies.delete(id);for(const ps of s.pickups||[]){const p=game.pickups.find(x=>x.id===ps.id);if(p)p.active=ps.active;}game.acid=(s.acid||[]).map(a=>({...a,maxR:a.r,arm:0}));
  },
  applyEvent(m){if(m.t==='complete')completeChapter();},
  async setReady(){profile.ready=!profile.ready;await this.track();renderLobby();},
  updateConfig(){if(!this.isHost)return;this.map=el.mapSelect.value;this.difficulty=el.difficulty.value;this.sendRoom({t:'config',map:this.map,difficulty:this.difficulty});},
  startHost(){if(!this.isHost||this.starting)return;this.starting=true;this.map=el.mapSelect.value;this.difficulty=el.difficulty.value;this.sendRoom({t:'start',map:this.map,difficulty:this.difficulty});show(el.loading);el.loadingMap.textContent=MAPS[this.map].name;animateLoading(()=>{game=makeGame({map:this.map,difficulty:this.difficulty});const humans=Object.values(this.presence).sort((a,b)=>(a.joinTs||0)-(b.joinTs||0)).slice(0,4);humans.forEach((m,i)=>game.players.set(m.id,makePlayer(m.id,m.name||'Survivor',false,i)));for(let i=humans.length;i<4;i++){game.players.set('bot'+i,makePlayer('bot'+i,['Mara','Jonah','Vale','Rook'][i]||'Bot',true,i));}this.transport=[...this.peers.values()].some(p=>p.fallback)?'fallback':'webrtc';beginPlay();this.starting=false;});},
  startClient(m){show(el.loading);el.loadingMap.textContent=MAPS[m.map].name;animateLoading(()=>{game=makeGame({map:m.map,difficulty:m.difficulty});for(const meta of Object.values(this.presence).slice(0,4))game.players.set(meta.id,makePlayer(meta.id,meta.name||'Survivor',false,0));if(!game.players.has(profile.id))game.players.set(profile.id,makePlayer(profile.id,profile.name,false,0));beginPlay();});},
  dropPeer(id){const p=this.peers.get(id);try{p?.pc?.close();}catch{}this.peers.delete(id);},
  leave(){for(const id of [...this.peers.keys()])this.dropPeer(id);if(this.channel){try{this.channel.untrack();this.sb?.removeChannel(this.channel);}catch{}}this.channel=null;this.inRoom=false;this.room=null;this.presence={};this.isHost=false;this.hostId=null;this.transport='offline';this.joinTs=0;history.replaceState(null,'',location.pathname);}
};

function renderLobby(){if(!net.inRoom)return;const arr=Object.values(net.presence).sort((a,b)=>(a.joinTs||0)-(b.joinTs||0)).slice(0,MAX_PLAYERS);el.playerList.innerHTML='';for(const m of arr){const row=document.createElement('div');row.className='player-row';row.innerHTML=`<div class="player-avatar"></div><div class="pname">${escapeHtml(m.name||'Survivor')}</div>${m.id===net.hostId?'<span class="pill host">HOST</span>':''}${m.ready?'<span class="pill ready">READY</span>':'<span class="pill">NOT READY</span>'}`;el.playerList.appendChild(row);}for(let i=arr.length;i<MAX_PLAYERS;i++){const d=document.createElement('div');d.className='empty-slot';d.textContent='EMPTY SLOT · BOT ON START';el.playerList.appendChild(d);}const p2p=[...net.peers.values()].some(p=>p.status==='open');el.netState.textContent=net.isHost?(p2p?'HOST · P2P':'HOST · ONLINE'):(net.transport==='webrtc'?'P2P CONNECTED':net.transport==='fallback'?'SUPABASE FALLBACK':'CONNECTING');el.netState.className='net-state '+(net.transport==='fallback'?'warn':'good');el.readyBtn.textContent=profile.ready?'READY ✓':'READY';el.startOnline.classList.toggle('hidden',!net.isHost);el.readyBtn.classList.toggle('hidden',net.isHost);el.mapSelect.disabled=!net.isHost;el.difficulty.disabled=!net.isHost;const others=arr.filter(m=>m.id!==profile.id);el.startOnline.disabled=!net.isHost||arr.length<1;el.lobbyHint.textContent=net.isHost?(others.length?`${others.length} friend${others.length>1?'s':''} connected · empty slots become bots`:'You can start now with bots, or invite friends.'):'Waiting for host to start…';}

function shareLink(){const url=location.origin+location.pathname+'?room='+net.room;if(navigator.share)navigator.share({title:'Hobile: Outbreak',text:'Join my Hobile co-op server',url}).catch(()=>{});else navigator.clipboard?.writeText(url).then(()=>toast('Invite link copied'));}
function copyLink(){const url=location.origin+location.pathname+'?room='+net.room;navigator.clipboard?.writeText(url).then(()=>toast('Invite link copied')).catch(()=>toast(url));}
function showFatal(m){el.fatalText.textContent=m;show(el.fatal);}
function quitToMenu(){hide(el.pause);hide(el.hud);hide(el.controls);hide(el.stageClear);game=null;mode='menu';net.leave();show(el.menu);}

el.soloBtn.onclick=()=>{initAudio();startSolo();};el.createBtn.onclick=()=>{initAudio();net.create();};el.joinBtn.onclick=()=>{show(el.joinModal);el.joinCode.focus();};el.joinCancel.onclick=()=>hide(el.joinModal);el.joinNow.onclick=()=>net.join(el.joinCode.value);el.shareBtn.onclick=shareLink;el.copyBtn.onclick=copyLink;el.saveName.onclick=async()=>{profile.name=(el.playerName.value.trim()||profile.name).slice(0,16);localStorage.setItem('hobile_name',profile.name);if(net.inRoom)await net.track();renderLobby();toast('Name saved');};el.readyBtn.onclick=()=>net.setReady();el.startOnline.onclick=()=>net.startHost();el.mapSelect.onchange=()=>net.updateConfig();el.difficulty.onchange=()=>net.updateConfig();el.leaveLobby.onclick=()=>{net.leave();hide(el.lobby);show(el.menu);};el.pauseBtn.onclick=()=>{show(el.pause);};el.resumeBtn.onclick=()=>hide(el.pause);el.debugBtn.onclick=()=>{debug=!debug;el.debugHud.classList.toggle('hidden',!debug);toast(debug?'Debug on':'Debug off');};el.copyDebugBtn.onclick=()=>{const text=el.debugHud.textContent||`${BUILD}\nmode=${mode}\nroom=${net.room}\ntransport=${net.transport}`;navigator.clipboard?.writeText(text).then(()=>toast('Debug report copied'));};el.quitBtn.onclick=quitToMenu;el.continueBtn.onclick=quitToMenu;el.fatalClose.onclick=()=>{hide(el.fatal);if(!net.inRoom)show(el.menu);};

function loop(ts){const raw=(ts-lastTs)/1000;lastTs=ts;const dt=clamp(raw,0,.05);frameMs=lerp(frameMs,raw*1000,.08);fps=1000/Math.max(1,frameMs);if((mode==='solo'||mode==='online')&&!el.pause.classList.contains('hidden')){/* paused */}else if(mode==='solo'&&game){updateHost(dt);}else if(mode==='online'&&game){if(net.isHost)updateHost(dt);else updateClient(dt);const t=performance.now();const inputEvery=net.transport==='fallback'?150:66;if(!net.isHost&&t-net.lastInputSend>inputEvery){net.lastInputSend=t;net.sendInput();}const snapshotEvery=net.hasFallbackPeer()?180:100;if(net.isHost&&t-net.lastSnapshot>snapshotEvery){net.lastSnapshot=t;net.sendSnapshot();}}
  render();if(game&&(mode==='solo'||mode==='online'))updateHud();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

async function runSelfTest(){
  const lines=[];const ok=(name,cond)=>{lines.push((cond?'PASS ':'FAIL ')+name);return cond;};
  try{
    game=makeGame({map:'ashwood',difficulty:'normal'});game.players.set(profile.id,makePlayer(profile.id,'Test',false,0));for(let i=1;i<4;i++)game.players.set('b'+i,makePlayer('b'+i,'Bot'+i,true,i));
    ok('map initialized',game.map.id==='ashwood'&&game.map.safeX>3000);ok('4 survivors initialized',game.players.size===4);ok('weapon data',WEAPONS.smg.mag===32&&WEAPONS.shotgun.pellets===8&&WEAPONS.rifle.damage>20);
    spawnGroup(10);spawnSpecial();ok('infected spawn',game.enemies.size===11);const p=localPlayer();p.x=500;p.y=0;p.aim=0;game.enemies.clear();const e=spawnEnemy('drifter',620,0);const before=e.hp;tryFire(p);game.time+=.2;tryFire(p);ok('shooting damages enemy',e.hp<before);damagePlayer(p,150);ok('downed state instead of instant death',p.downed&&!p.dead);p.downed=false;p.hp=50;p.medkits=1;tryHeal(p);game.time=p.healUntil+.01;updatePlayer(p,{mx:0,my:0,aimX:1,aimY:0,fire:false,reloadSeq:0,use:false,healSeq:0,swapSeq:0},.01);ok('medkit heals',p.hp>50&&p.medkits===0);game.finale=true;game.finaleTimer=.01;updateObjective(.02);ok('finale opens shelter',game.safeOpen);ok('Supabase config embedded',SUPABASE_URL.includes('supabase.co')&&SUPABASE_KEY.startsWith('sb_publishable_'));
    el.selftest.textContent=lines.join('\n')+'\n\n'+(lines.some(x=>x.startsWith('FAIL'))?'SELFTEST FAILED':'SELFTEST PASSED');show(el.selftest);document.title=lines.some(x=>x.startsWith('FAIL'))?'SELFTEST FAIL':'SELFTEST PASS';
  }catch(e){el.selftest.textContent=lines.join('\n')+'\nFAIL exception: '+e.stack;show(el.selftest);document.title='SELFTEST FAIL';}
}

setTimeout(()=>net.init(),80);
if(new URLSearchParams(location.search).get('test')==='1')setTimeout(runSelfTest,200);
