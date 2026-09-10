(()=>{
"use strict";
const C=window.OutbreakCore,$=id=>document.getElementById(id),canvas=$("game"),ctx=canvas.getContext("2d",{alpha:false});
const net=new window.OutbreakNetRoom();
let W=0,H=0,DPR=1,groundY=0,last=performance.now(),mode="menu",paused=false,online=false,difficulty="normal";
let cameraX=0,screenShake=0,gameTime=0,stageStartedAt=0,player=null,remote=null,zombies=[],projectiles=[],particles=[],pickups=[],decor=[],director=null;
let kills=0,specialKills=0,scrapRun=0,exitOpen=false,finaleTimer=0,finaleStarted=false,lastWorldSend=0,lastStateSend=0;
let joy={id:null,x:0,y:0},fireHeld=false,useHeld=false,reviveProgress=0,dead=false,hostWorldSeq=0;
let profile=loadProfile();
const colors={sky1:"#111b2b",sky2:"#475064",ground:"#2f3138",road:"#40434a",grass:"#344637"};

function loadProfile(){
 try{
  const p=JSON.parse(localStorage.getItem("hobile_outbreak_profile")||"{}");
  return {scrap:p.scrap||0,levels:{smg:p.levels?.smg||1,shotgun:p.levels?.shotgun||1,rifle:p.levels?.rifle||1},unlocked:{smg:true,shotgun:p.unlocked?.shotgun||false,rifle:p.unlocked?.rifle||false}};
 }catch{return{scrap:0,levels:{smg:1,shotgun:1,rifle:1},unlocked:{smg:true,shotgun:false,rifle:false}}}
}
function saveProfile(){localStorage.setItem("hobile_outbreak_profile",JSON.stringify(profile))}
function resize(){DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);groundY=H*.73}
addEventListener("resize",resize);resize();

function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function grad(x0,y0,x1,y1,a,b){const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g}
function shadow(blur=10,color="#0008"){ctx.shadowBlur=blur;ctx.shadowColor=color}
function resetShadow(){ctx.shadowBlur=0;ctx.shadowColor="transparent"}

function makePlayer(id,name,x=150){
 const w=C.weaponStats("smg",profile.levels.smg);
 return{id,name,x,lane:0,y:0,vy:0,facing:1,hp:100,maxHp:100,tempHp:0,downed:false,dead:false,downTimer:0,weapon:"smg",ammo:w.mag,reserve:w.reserve,reloading:0,fireCd:0,invuln:0,using:false,score:0,anim:0,medkits:1,stims:0,me:id===net.id};
}
function spawnDecor(){
 decor=[
  {x:380,type:"sign",text:"ASHWOOD",lane:-.8},{x:820,type:"car",lane:.55},{x:1260,type:"tree",lane:-.7},
  {x:1700,type:"house",lane:-1},{x:2220,type:"lamp",lane:.7},{x:2680,type:"truck",lane:-.45},
  {x:3140,type:"tree",lane:.65},{x:3650,type:"cabin",lane:-1},{x:4180,type:"car",lane:.45},
  {x:4700,type:"fence",lane:-.8},{x:5120,type:"safehouse",lane:0}
 ];
}
function resetStage(){
 zombies=[];projectiles=[];particles=[];pickups=C.STAGE.pickups.map((p,i)=>({...p,id:"p"+i,taken:false,lane:(i%2?-.35:.32)}));spawnDecor();
 director={time:0,intensity:0,cooldown:1.5,nextMilestone:0,finaleTriggered:false};kills=0;specialKills=0;scrapRun=0;cameraX=0;screenShake=0;gameTime=0;stageStartedAt=Date.now();exitOpen=false;finaleTimer=0;finaleStarted=false;hostWorldSeq=0;dead=false;
 player=makePlayer(online?net.id:"solo",online?net.name:"YOU",130);
 remote=null;
 updateHud();
}

function startGame(isOnline=false){
 online=isOnline;mode="loading";$("menu").classList.add("hidden");$("lobby").classList.add("hidden");$("loading").classList.remove("hidden");$("loadingBar").style.width="15%";
 const steps=[["Building Ashwood Road…",38],["Waking the Director…",63],["Loading survivor gear…",82],["Opening chapter…",100]];let i=0;
 const t=setInterval(()=>{const s=steps[i++];$("loadingText").textContent=s[0];$("loadingBar").style.width=s[1]+"%";if(i>=steps.length){clearInterval(t);setTimeout(()=>{$("loading").classList.add("hidden");$("hud").classList.remove("hidden");$("controls").classList.remove("hidden");mode="playing";paused=false;resetStage();if(online&&net.isHost())net.send("world",{kind:"init",seed:1337,difficulty,at:Date.now()});},220)}},180);
}
function quitToMenu(){
 mode="menu";paused=false;online=false;$("hud").classList.add("hidden");$("controls").classList.add("hidden");$("pause").classList.add("hidden");$("stageClear").classList.add("hidden");$("menu").classList.remove("hidden");net.disconnect();
}

function spawnZombie(type,x,lane=0){
 const base=C.ENEMIES[type],dm=C.DIFFICULTY[difficulty]||C.DIFFICULTY.normal;
 const z={id:"z"+(++hostWorldSeq)+"-"+Math.random().toString(36).slice(2,6),type,x,lane,hp:base.hp*dm.hpMult,maxHp:base.hp*dm.hpMult,speed:base.speed,attackCd:Math.random()*.6,dead:false,deathT:0,stun:0,acidCd:1.5+Math.random(),pounceCd:1.8+Math.random(),called:false,anim:Math.random()*9,flash:0};
 zombies.push(z);return z;
}
function spawnBudget(budget,finale=false){
 const rng=new C.RNG((Date.now()+zombies.length*97)>>>0),progress=player.x/C.STAGE.width;
 let remaining=budget,spacing=0;
 while(remaining>0){
  const [type,cost]=C.chooseEnemy(rng,remaining,progress,finale);remaining-=cost;spacing+=rng.range(28,75);
  const ahead=rng.next()>.18;
  const x=C.clamp(player.x+(ahead?W*.72+spacing:-W*.35-spacing),40,C.STAGE.exitX-100);
  spawnZombie(type,x,rng.range(-.7,.7)*58);
 }
}
function banner(text){const e=$("waveBanner");e.textContent=text;e.classList.remove("show");void e.offsetWidth;e.classList.add("show")}
function toast(text){const e=$("pickupToast");e.textContent=text;e.classList.remove("show");void e.offsetWidth;e.classList.add("show")}
function flashDamage(){const e=$("damageFlash");e.classList.remove("show");void e.offsetWidth;e.classList.add("show");screenShake=Math.max(screenShake,7)}
function particle(x,y,vx,vy,life,size,color,kind="dot"){particles.push({x,y,vx,vy,life,max:life,size,color,kind})}
function burst(x,lane,color,n=10){for(let i=0;i<n;i++)particle(x,groundY+lane,Math.random()*120-60,Math.random()*-120-20,.45+Math.random()*.35,2+Math.random()*4,color)}

function fire(){
 if(mode!=="playing"||paused||!player||player.dead||player.downed||player.reloading>0||player.fireCd>0)return;
 const w=C.weaponStats(player.weapon,profile.levels[player.weapon]);
 if(player.ammo<=0){reload();return}
 player.ammo--;player.fireCd=w.fireRate;screenShake=Math.max(screenShake,player.weapon==="shotgun"?5:2.5);
 const pellets=w.pellets||1;for(let p=0;p<pellets;p++){
  const target=C.lineShotTarget(player,zombies,w.range,player.weapon==="shotgun"?75:54);
  if(target){
   const spreadPenalty=1-Math.min(.28,Math.abs((target.lane||0)-player.lane)/260);
   const dmg=w.damage*spreadPenalty*(.88+Math.random()*.22);
   if(online&&!net.isHost()){net.send("shot",{weapon:player.weapon,x:player.x,lane:player.lane,facing:player.facing,targetId:target.id,damage:dmg})}
   else applyZombieDamage(target,dmg,w.knock*player.facing);
  }
 }
 const muzzleX=player.x+player.facing*42;for(let i=0;i<5;i++)particle(muzzleX,groundY+player.lane-player.y-52,player.facing*(120+Math.random()*170),Math.random()*60-30,.12,2+Math.random()*4,"#ffd36b","spark");
 synth("gun",player.weapon);
 updateHud();
}
function reload(){
 if(!player||player.dead||player.downed||player.reloading>0)return;
 const w=C.weaponStats(player.weapon,profile.levels[player.weapon]);if(player.ammo>=w.mag||player.reserve<=0)return;
 player.reloading=w.reload;synth("reload");$("centerMsg").textContent="RELOADING…";
}
function finishReload(){
 const w=C.weaponStats(player.weapon,profile.levels[player.weapon]),n=Math.min(w.mag-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;$("centerMsg").textContent="";
}
function swapWeapon(){
 const unlocked=["smg","shotgun","rifle"].filter(k=>profile.unlocked[k]);if(unlocked.length<2){toast("FIND MORE WEAPONS IN THE CHAPTER");return}
 let i=unlocked.indexOf(player.weapon);player.weapon=unlocked[(i+1)%unlocked.length];const w=C.weaponStats(player.weapon,profile.levels[player.weapon]);if(player.ammo>w.mag)player.ammo=w.mag;synth("swap");updateHud();
}
function applyZombieDamage(z,dmg,knock=0){
 if(!z||z.dead)return;z.hp-=dmg;z.flash=.1;z.x+=knock*.05;
 burst(z.x,z.lane,"#8b3038",2);
 if(z.hp<=0){
  z.dead=true;z.deathT=.55;kills++;const e=C.ENEMIES[z.type];if(e.special)specialKills++;scrapRun+=e.special?4:1;
  burst(z.x,z.lane,e.color,8);synth("kill",e.special);
 }
}
function damagePlayer(amount,source){
 if(!player||player.dead||player.invuln>0)return;
 const useTemp=Math.min(player.tempHp,amount);player.tempHp-=useTemp;amount-=useTemp;player.hp-=amount;player.invuln=.18;flashDamage();synth("hurt");
 if(player.hp<=0&&!player.downed){
  player.hp=0;player.downed=true;player.downTimer=22;$("centerMsg").textContent="DOWNED — TEAMMATE MUST REVIVE YOU";banner("SURVIVOR DOWN");
 }else if(player.downed&&player.downTimer<=0){player.dead=true;dead=true;$("centerMsg").textContent="YOU DIDN'T MAKE IT";}
 updateHud();
 if(online&&net.isHost())net.send("damage",{targetId:player.id,hp:player.hp,tempHp:player.tempHp,downed:player.downed,dead:player.dead,source});
}
function reviveLocal(){
 if(!player?.downed)return;player.downed=false;player.dead=false;player.hp=35;player.downTimer=0;player.invuln=1;$("centerMsg").textContent="BACK ON YOUR FEET";setTimeout(()=>{if(mode==="playing")$("centerMsg").textContent=""},900);synth("revive");updateHud();
}
function use(){
 if(!player||player.dead)return;
 if(remote&&remote.downed&&!remote.dead&&Math.abs(remote.x-player.x)<85&&Math.abs(remote.lane-player.lane)<50){useHeld=true;return}
 if(player.hp<72&&player.medkits>0&&!player.downed){player.medkits--;player.hp=Math.min(100,player.hp+65);toast("MEDKIT USED");synth("heal");updateHud();return}
 const near=pickups.find(p=>!p.taken&&Math.abs(p.x-player.x)<72&&Math.abs(p.lane-player.lane)<55);if(near)takePickup(near);
}
function takePickup(p){
 p.taken=true;synth("pickup");
 if(p.type==="medkit"){player.medkits++;toast("MEDKIT +1")}
 if(p.type==="stim"){player.stims++;player.tempHp=Math.min(50,player.tempHp+35);toast("STIM: +35 TEMP HP")}
 if(p.type==="ammo"){const w=C.weaponStats(player.weapon,profile.levels[player.weapon]);player.reserve=Math.min(w.reserve,player.reserve+Math.round(w.reserve*.55));toast("AMMO RESTOCKED")}
 if(p.type==="shotgun"){profile.unlocked.shotgun=true;saveProfile();player.weapon="shotgun";const w=C.weaponStats("shotgun",profile.levels.shotgun);player.ammo=w.mag;player.reserve=w.reserve;toast("NEW WEAPON: BREACH-8")}
 if(p.type==="rifle"){profile.unlocked.rifle=true;saveProfile();player.weapon="rifle";const w=C.weaponStats("rifle",profile.levels.rifle);player.ammo=w.mag;player.reserve=w.reserve;toast("NEW WEAPON: WARDEN AR")}
 updateHud();
}

function hostShoot(msg){
 if(!net.isHost()||!msg)return;
 const shooter=msg.from===player.id?player:remote;if(!shooter)return;
 const w=C.weaponStats(msg.weapon,profile.levels[msg.weapon]||1),target=zombies.find(z=>z.id===msg.targetId&&!z.dead);
 if(!target)return;
 const dx=target.x-msg.x;if(Math.sign(dx)!==Math.sign(msg.facing)||Math.abs(dx)>w.range+80||Math.abs(target.lane-msg.lane)>90)return;
 applyZombieDamage(target,Math.min(msg.damage||w.damage,w.damage*1.35),w.knock*Math.sign(msg.facing));
}
function hostZombieAI(dt){
 const targets=[player,remote].filter(p=>p&&!p.dead);
 for(const z of zombies){
  if(z.dead){z.deathT-=dt;continue}
  z.anim+=dt;z.flash=Math.max(0,z.flash-dt);z.attackCd-=dt;z.stun=Math.max(0,z.stun-dt);if(z.stun>0)continue;
  const base=C.ENEMIES[z.type],target=targets.sort((a,b)=>Math.abs(a.x-z.x)-Math.abs(b.x-z.x))[0];if(!target)continue;
  const dx=target.x-z.x,dl=target.lane-z.lane,dist=Math.hypot(dx,dl*.7),dir=Math.sign(dx)||1;
  if(z.type==="corroder"&&dist<base.reach&&dist>110){
   z.acidCd-=dt;if(z.acidCd<=0){z.acidCd=base.attackRate;projectiles.push({type:"acid",x:z.x,lane:z.lane,y:-40,vx:dir*190,vy:-120,targetId:target.id,life:2.2});synth("spit")}
   continue;
  }
  if(z.type==="caller"&&!z.called&&dist<370){z.called=true;spawnBudget(8,false);banner("THE CALLER SUMMONED A HORDE");synth("horde")}
  if(z.type==="leaper"&&dist>100&&dist<330){z.pounceCd-=dt;if(z.pounceCd<=0){z.pounceCd=3.2;z.x+=dir*95;z.lane+=C.clamp(dl,-35,35);screenShake=4}}
  if(dist<=base.reach){
   if(z.attackCd<=0){z.attackCd=base.attackRate;if(target===player)damagePlayer(base.damage*(C.DIFFICULTY[difficulty]?.damageMult||1),z.type);else damageRemote(target,base.damage*(C.DIFFICULTY[difficulty]?.damageMult||1),z.type);if(z.type==="brute")screenShake=9}
  }else{
   z.x+=dir*base.speed*dt;z.lane+=C.clamp(dl,-base.speed*.45*dt,base.speed*.45*dt);
  }
 }
 zombies=zombies.filter(z=>!z.dead||z.deathT>0);
 for(const p of projectiles){
  p.life-=dt;p.x+=p.vx*dt;p.vy+=280*dt;p.y+=p.vy*dt;
  const t=p.targetId===player.id?player:remote;if(t&&Math.abs(p.x-t.x)<34&&Math.abs(p.lane-t.lane)<42&&p.y>-35){if(t===player)damagePlayer(12,"corroder");else damageRemote(t,12,"corroder");p.life=0;for(let i=0;i<8;i++)particle(p.x,groundY+p.lane,Math.random()*80-40,Math.random()*-50,.5,4,"#83c94f")}
 }
 projectiles=projectiles.filter(p=>p.life>0&&p.y<70);
}
function damageRemote(t,amount,source){
 if(!online||!net.isHost()||!t)return;t.hp=Math.max(0,(t.hp??100)-amount);if(t.hp<=0&&!t.downed){t.downed=true;t.downTimer=22}net.send("damage",{targetId:t.id,hp:t.hp,tempHp:t.tempHp||0,downed:t.downed,dead:t.dead||false,source})
}

function directorUpdate(dt){
 if(online&&!net.isHost())return;
 const alive=[player,remote].filter(p=>p&&!p.dead),avgHp=alive.length?alive.reduce((s,p)=>s+(p.hp||0),0)/alive.length:0,nearby=zombies.filter(z=>!z.dead&&Math.abs(z.x-player.x)<330).length;
 const ctx={avgHp,nearby,progress:player.x/C.STAGE.width,ammoRatio:player.reserve/(C.weaponStats(player.weapon,profile.levels[player.weapon]).reserve||1),checkpointIndex:C.STAGE.checkpoints.filter(x=>player.x>x).length,finale:player.x>=C.STAGE.finaleStart,alivePlayers:alive.length,spawnMult:C.DIFFICULTY[difficulty]?.spawnMult||1};
 const r=C.directorStep(director,ctx,dt);director=r.director;
 if(r.event){if(r.event.type==="horde"){banner("HORDE INCOMING");synth("horde")}if(r.event.type==="finale"){banner("FINAL RUN");finaleStarted=true;finaleTimer=20;synth("horde")}spawnBudget(r.event.budget,r.event.type==="finale")}
 if(finaleStarted&&!exitOpen){finaleTimer-=dt;if(finaleTimer<=0){exitOpen=true;banner("SAFEHOUSE OPEN");synth("objective")}}
}
function stageLogic(dt){
 if(player.downed){player.downTimer-=dt;if(player.downTimer<=0){player.dead=true;dead=true;$("centerMsg").textContent="YOU DIDN'T MAKE IT";if(!online)setTimeout(()=>resetStage(),2200)}}
 if(remote?.downed&&!remote.dead&&online&&net.isHost()){remote.downTimer=(remote.downTimer??22)-dt;if(remote.downTimer<=0){remote.dead=true;net.send("damage",{targetId:remote.id,hp:0,downed:true,dead:true,source:"bleedout"})}}
 if(useHeld&&remote&&remote.downed&&!remote.dead&&Math.abs(remote.x-player.x)<85&&Math.abs(remote.lane-player.lane)<50){reviveProgress+=dt;$("centerMsg").textContent="REVIVING… "+Math.floor(reviveProgress/3*100)+"%";if(reviveProgress>=3){reviveProgress=0;useHeld=false;if(online){net.send("revive",{targetId:remote.id,hp:35});if(net.isHost()){remote.downed=false;remote.dead=false;remote.hp=35;remote.downTimer=0}}}}
 else if(!useHeld){reviveProgress=0}
 if(exitOpen&&player.x>C.STAGE.exitX){if(!online||!remote||remote.x>C.STAGE.exitX||remote.dead)completeStage()}
}
function completeStage(){
 if(mode!=="playing")return;mode="clear";const bonus=40+specialKills*3+Math.floor(scrapRun*.25);const reward=scrapRun+bonus;profile.scrap+=reward;saveProfile();
 $("resultKills").textContent=kills;$("resultSpecial").textContent=specialKills;$("resultScrap").textContent=reward;$("resultTime").textContent=C.formatTime((Date.now()-stageStartedAt)/1000);$("hud").classList.add("hidden");$("controls").classList.add("hidden");$("stageClear").classList.remove("hidden");
 if(online&&net.isHost())net.send("stage_clear",{kills,specialKills,reward,time:Date.now()-stageStartedAt});
}

function updateLocal(dt){
 if(!player||player.dead)return;
 player.anim+=dt;player.invuln=Math.max(0,player.invuln-dt);player.fireCd=Math.max(0,player.fireCd-dt);
 if(player.reloading>0){player.reloading-=dt;if(player.reloading<=0)finishReload()}
 const moveSpeed=player.downed?72:165,dx=joy.x*moveSpeed*dt,dl=joy.y*105*dt;
 player.x=C.clamp(player.x+dx,25,C.STAGE.exitX+180);player.lane=C.clamp(player.lane+dl,-72,72);if(Math.abs(joy.x)>.08)player.facing=Math.sign(joy.x);
 player.vy+=680*dt;player.y+=player.vy*dt;if(player.y>0){player.y=0;player.vy=0}
 if(fireHeld)fire();
 for(const p of pickups)if(!p.taken&&Math.abs(p.x-player.x)<55&&Math.abs(p.lane-player.lane)<48&&["shotgun","rifle","ammo"].includes(p.type))takePickup(p);
}
function updateParticles(dt){for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt}particles=particles.filter(p=>p.life>0)}
function updateCamera(dt){const target=C.clamp(player.x-W*.35,0,C.STAGE.width-W*.9);cameraX+=(target-cameraX)*Math.min(1,dt*5.5);screenShake=Math.max(0,screenShake-dt*18)}

function statePacket(){return{id:player.id,name:online?net.name:"YOU",x:player.x,lane:player.lane,y:player.y,facing:player.facing,hp:player.hp,tempHp:player.tempHp,downed:player.downed,dead:player.dead,weapon:player.weapon,ammo:player.ammo,using:useHeld}}
function networkUpdate(now){
 if(!online||!net.connected)return;
 if(now-lastStateSend>90){lastStateSend=now;net.send("state",statePacket())}
 if(net.isHost()&&now-lastWorldSend>150){lastWorldSend=now;net.send("world",{kind:"snapshot",zombies:zombies.map(z=>({id:z.id,type:z.type,x:+z.x.toFixed(1),lane:+z.lane.toFixed(1),hp:+z.hp.toFixed(1),dead:z.dead})),pickups:pickups.map(p=>({id:p.id,taken:p.taken})),director:{intensity:director.intensity},exitOpen,finaleStarted,finaleTimer:+finaleTimer.toFixed(1),kills,specialKills,scrapRun})}
}

function applyWorld(w){
 if(!w||net.isHost()||w.kind!=="snapshot")return;
 const existing=new Map(zombies.map(z=>[z.id,z]));const next=[];
 for(const s of w.zombies||[]){let z=existing.get(s.id);if(!z){const base=C.ENEMIES[s.type];z={id:s.id,type:s.type,x:s.x,lane:s.lane,hp:s.hp,maxHp:base.hp,dead:s.dead,deathT:.5,anim:Math.random()*9,flash:0}}else{z.x+=(s.x-z.x)*.55;z.lane+=(s.lane-z.lane)*.55;z.hp=s.hp;z.dead=s.dead}next.push(z)}
 zombies=next;for(const ps of w.pickups||[]){const p=pickups.find(x=>x.id===ps.id);if(p)p.taken=ps.taken}
 director.intensity=w.director?.intensity||0;exitOpen=!!w.exitOpen;finaleStarted=!!w.finaleStarted;finaleTimer=w.finaleTimer||0;kills=w.kills||kills;specialKills=w.specialKills||specialKills;scrapRun=w.scrapRun||scrapRun;
}

net.on("presence",({players,hostId})=>{renderLobby(players,hostId);if(mode==="playing"&&online){const other=players.find(p=>p.id!==net.id);if(other&&!remote){remote=makePlayer(other.id,other.name,player.x+80);remote.me=false}else if(remote&&other)remote.name=other.name}})
.on("state",s=>{if(!online||!s||s.id===net.id)return;if(!remote){remote=makePlayer(s.id,s.name,s.x);remote.me=false}Object.assign(remote,{id:s.id,name:s.name,x:s.x,lane:s.lane,y:s.y||0,facing:s.facing||1,hp:s.hp,tempHp:s.tempHp||0,downed:!!s.downed,dead:!!s.dead,weapon:s.weapon||"smg",ammo:s.ammo??32,using:!!s.using})})
.on("shot",hostShoot)
.on("world",w=>{if(w?.kind==="init"&&!net.isHost()){difficulty=w.difficulty||difficulty}applyWorld(w)})
.on("damage",d=>{if(!d)return;if(d.targetId===net.id){player.hp=d.hp;player.tempHp=d.tempHp||0;player.downed=!!d.downed;player.dead=!!d.dead;if(player.downed)$("centerMsg").textContent="DOWNED — TEAMMATE MUST REVIVE YOU";flashDamage()}else if(remote&&d.targetId===remote.id){remote.hp=d.hp;remote.downed=!!d.downed;remote.dead=!!d.dead}})
.on("revive",r=>{if(!r)return;if(r.targetId===net.id){reviveLocal()}else if(remote&&r.targetId===remote.id){remote.downed=false;remote.dead=false;remote.hp=r.hp||35;remote.downTimer=0}})
.on("match_start",m=>{difficulty=m.difficulty||"normal";if(mode!=="playing")startGame(true)})
.on("stage_clear",r=>{if(net.isHost())return;if(mode==="playing"){mode="clear";profile.scrap+=r.reward||0;saveProfile();$("resultKills").textContent=r.kills||0;$("resultSpecial").textContent=r.specialKills||0;$("resultScrap").textContent=r.reward||0;$("resultTime").textContent=C.formatTime((r.time||0)/1000);$("hud").classList.add("hidden");$("controls").classList.add("hidden");$("stageClear").classList.remove("hidden")}})
.on("status",s=>{$("netState").textContent=s==="SUBSCRIBED"?"CONNECTED":s});

function renderLobby(players=net.players,hostId=net.hostId){
 $("roomCode").textContent=net.room||"-----";$("playerName").value=net.name;const list=$("playerList");list.innerHTML="";
 for(const p of players){const r=document.createElement("div");r.className="player-row"+(p.id===net.id?" me":"");r.innerHTML="<span>"+esc(p.name)+"</span>"+(p.id===hostId?"<b>HOST</b>":"");list.appendChild(r)}
 const ready=players.length>=2;$("startOnline").disabled=!(net.isHost()&&ready);$("startOnline").textContent=net.isHost()?"START CHAPTER":"WAITING FOR HOST";$("lobbyHint").textContent=players.length<2?"Share the room link with one friend.":net.isHost()?"Squad ready. Start when you are ready.":"Connected. Waiting for the host.";
}
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function roomLink(){const u=new URL(location.href);u.searchParams.set("room",net.room);u.hash="";return u.toString()}
async function connectRoom(code,creator){
 $("menu").classList.add("hidden");$("joinModal").classList.add("hidden");$("lobby").classList.remove("hidden");$("netState").textContent="CONNECTING";
 try{await net.connect(code,{creator});history.replaceState(null,"",roomLink());renderLobby()}
 catch(e){$("lobby").classList.add("hidden");$("fatalText").textContent=e.message;$("fatal").classList.remove("hidden")}
}

function drawBackground(){
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#101929");sky.addColorStop(.55,"#353d51");sky.addColorStop(1,"#9a6570");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 // moon
 ctx.save();ctx.globalAlpha=.85;shadow(28,"#dff4ff44");ctx.fillStyle="#eaf1ef";ctx.beginPath();ctx.arc(W*.78-cameraX*.015,H*.17,34,0,Math.PI*2);ctx.fill();resetShadow();ctx.restore();
 // far ridge
 drawRidge(.08,H*.52,"#1a2632",120,28);drawRidge(.15,H*.58,"#121c25",95,36);
 // skyline / houses
 ctx.save();ctx.translate(-(cameraX*.24)%220,0);for(let x=-220;x<W+440;x+=110){const h=55+((x/110)%3)*16;ctx.fillStyle="#111922";ctx.fillRect(x,H*.58-h,86,h);ctx.fillStyle="#d9b86a55";for(let wx=12;wx<70;wx+=22)for(let wy=14;wy<h-8;wy+=23)ctx.fillRect(x+wx,H*.58-h+wy,6,9)}ctx.restore();
 // trees middle parallax
 ctx.save();ctx.translate(-(cameraX*.46)%180,0);for(let x=-180;x<W+360;x+=145){drawTree(x,H*.66,1.15,"#182a25","#243c31")}ctx.restore();
 // ground bands
 ctx.fillStyle="#27312d";ctx.fillRect(0,groundY-72,W,144);ctx.fillStyle="#3d4047";ctx.fillRect(0,groundY-47,W,94);ctx.fillStyle="#292c32";ctx.fillRect(0,groundY+48,W,H-groundY);
 ctx.strokeStyle="#61646b55";ctx.lineWidth=2;for(let x=-(cameraX%100);x<W;x+=100){ctx.beginPath();ctx.moveTo(x,groundY-28);ctx.lineTo(x+45,groundY-28);ctx.stroke()}
 // foreground grass
 ctx.fillStyle="#203326";for(let x=0;x<W;x+=18){const h=4+((x*7)%8);ctx.fillRect(x,groundY-54-h,3,h)}
}
function drawRidge(parallax,y,color,step,amp){
 ctx.save();ctx.translate(-(cameraX*parallax)%step,0);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-step,H);for(let x=-step;x<W+step*2;x+=step)ctx.lineTo(x,y-Math.abs(Math.sin((x+cameraX*parallax)*.009))*amp);ctx.lineTo(W+step,H);ctx.closePath();ctx.fill();ctx.restore();
}
function drawTree(x,y,s=1,trunk="#3b2e29",leaf="#2f4a39"){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=trunk;roundRect(-6,-58,12,66,5);ctx.fill();ctx.fillStyle=leaf;for(const [dx,dy,r] of [[0,-76,28],[-20,-60,24],[20,-60,24],[2,-48,26]]){ctx.beginPath();ctx.arc(dx,dy,r,0,Math.PI*2);ctx.fill()}ctx.restore();
}
function drawDecor(){
 const items=[...decor].sort((a,b)=>a.lane-b.lane);
 for(const d of items){const sx=d.x-cameraX;if(sx<-240||sx>W+260)continue;const sy=groundY+d.lane;
  if(d.type==="tree")drawTree(sx,sy,1.25,"#352d2c","#263f32");
  else if(d.type==="lamp")drawLamp(sx,sy);
  else if(d.type==="car")drawCar(sx,sy,1);
  else if(d.type==="truck")drawCar(sx,sy,1.35);
  else if(d.type==="house"||d.type==="cabin")drawHouse(sx,sy,d.type==="cabin");
  else if(d.type==="sign")drawSign(sx,sy,d.text);
  else if(d.type==="fence")drawFence(sx,sy);
  else if(d.type==="safehouse")drawSafehouse(sx,sy);
 }
}
function drawHouse(x,y,cabin=false){
 ctx.save();ctx.translate(x,y);const w=cabin?150:190,h=cabin?115:145;shadow(16,"#0008");ctx.fillStyle=cabin?"#43372f":"#323846";ctx.fillRect(-w/2,-h,w,h);ctx.fillStyle="#1d232c";ctx.beginPath();ctx.moveTo(-w/2-15,-h);ctx.lineTo(0,-h-60);ctx.lineTo(w/2+15,-h);ctx.closePath();ctx.fill();resetShadow();ctx.fillStyle="#17212a";ctx.fillRect(-25,-62,50,62);ctx.fillStyle="#dcb65d33";ctx.fillRect(-w/2+25,-h+35,28,35);ctx.fillRect(w/2-54,-h+35,28,35);ctx.restore();
}
function drawCar(x,y,s){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle="#151a20";ctx.beginPath();ctx.ellipse(-35,0,17,17,0,0,Math.PI*2);ctx.ellipse(40,0,17,17,0,0,Math.PI*2);ctx.fill();const g=grad(-65,-35,65,5,"#6f3037","#35232a");ctx.fillStyle=g;roundRect(-72,-42,142,43,14);ctx.fill();ctx.fillStyle="#182633";ctx.beginPath();ctx.moveTo(-32,-42);ctx.lineTo(-10,-67);ctx.lineTo(32,-67);ctx.lineTo(52,-42);ctx.closePath();ctx.fill();ctx.restore();
}
function drawLamp(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle="#1c2026";ctx.fillRect(-3,-130,6,130);ctx.fillRect(-3,-130,30,5);shadow(28,"#ffd875aa");ctx.fillStyle="#ffe299";ctx.beginPath();ctx.arc(29,-126,7,0,Math.PI*2);ctx.fill();resetShadow();ctx.restore()}
function drawSign(x,y,text){ctx.save();ctx.translate(x,y);ctx.fillStyle="#382e27";ctx.fillRect(-4,-82,8,82);ctx.fillStyle="#17222a";roundRect(-65,-110,130,42,7);ctx.fill();ctx.strokeStyle="#7e9aac";ctx.stroke();ctx.fillStyle="#d8e5ed";ctx.font="900 13px Arial";ctx.textAlign="center";ctx.fillText(text,0,-84);ctx.restore()}
function drawFence(x,y){ctx.save();ctx.translate(x,y);ctx.strokeStyle="#4c463e";ctx.lineWidth=5;for(let i=-80;i<=80;i+=24){ctx.beginPath();ctx.moveTo(i,-58);ctx.lineTo(i,10);ctx.stroke()}ctx.beginPath();ctx.moveTo(-90,-40);ctx.lineTo(90,-40);ctx.moveTo(-90,-5);ctx.lineTo(90,-5);ctx.stroke();ctx.restore()}
function drawSafehouse(x,y){ctx.save();ctx.translate(x,y);shadow(25,exitOpen?"#5dff96aa":"#ffbc5d44");ctx.fillStyle="#1e252c";roundRect(-85,-135,170,140,8);ctx.fill();ctx.fillStyle=exitOpen?"#285d3a":"#57362b";roundRect(-34,-98,68,102,5);ctx.fill();resetShadow();ctx.fillStyle=exitOpen?"#84f5a8":"#f5c084";ctx.font="900 13px Arial";ctx.textAlign="center";ctx.fillText(exitOpen?"SAFEHOUSE OPEN":"LOCKED",0,-112);ctx.restore()}

function drawPickup(p){
 const x=p.x-cameraX,y=groundY+p.lane-22;if(x<-80||x>W+80)return;ctx.save();ctx.translate(x,y);const bob=Math.sin(gameTime*3+p.x*.01)*4;ctx.translate(0,bob);shadow(16,"#62c7ff55");
 let c="#62c7ff",label="AMMO";if(p.type==="medkit"){c="#f06a72";label="MED"}if(p.type==="stim"){c="#ffd05b";label="STIM"}if(p.type==="shotgun"){c="#a974ff";label="BREACH"}if(p.type==="rifle"){c="#62e68e";label="AR"}
 ctx.fillStyle=c;roundRect(-22,-22,44,32,8);ctx.fill();resetShadow();ctx.fillStyle="#081017";ctx.font="900 7px Arial";ctx.textAlign="center";ctx.fillText(label,0,-4);ctx.restore();
}
function drawSurvivor(p,isRemote=false){
 if(!p||p.dead)return;const x=p.x-cameraX,y=groundY+p.lane-p.y;ctx.save();ctx.translate(x,y);if(p.downed){ctx.rotate(-.55);ctx.translate(0,12)}
 const moving=Math.abs(isRemote?0:joy.x)>.08&&!p.downed,walk=Math.sin(p.anim*10)*(moving?1:0),flip=p.facing<0?-1:1;ctx.scale(flip,1);
 // shadow
 ctx.save();ctx.scale(1/flip,1);ctx.globalAlpha=.32;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(0,5,31,9,0,0,Math.PI*2);ctx.fill();ctx.restore();
 // legs
 ctx.strokeStyle="#162737";ctx.lineWidth=13;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-10,-25);ctx.lineTo(-13+walk*7,0);ctx.moveTo(10,-25);ctx.lineTo(13-walk*7,0);ctx.stroke();
 // boots
 ctx.strokeStyle="#11161d";ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-14+walk*7,-1);ctx.lineTo(-4+walk*7,0);ctx.moveTo(12-walk*7,-1);ctx.lineTo(22-walk*7,0);ctx.stroke();
 // body/coat
 shadow(10,"#0007");ctx.fillStyle=isRemote?"#70463f":"#274a63";ctx.beginPath();ctx.moveTo(-25,-76);ctx.quadraticCurveTo(0,-88,25,-76);ctx.lineTo(20,-22);ctx.quadraticCurveTo(0,-12,-20,-22);ctx.closePath();ctx.fill();resetShadow();
 ctx.fillStyle="#142a38";roundRect(-21,-67,42,31,10);ctx.fill();ctx.fillStyle="#5c7990";ctx.fillRect(-2,-67,4,42);
 // backpack
 ctx.fillStyle="#18252e";roundRect(-28,-66,12,36,6);ctx.fill();
 // head
 const skin=grad(-12,-115,14,-83,"#efc19a","#bc795c");ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-97,25,0,Math.PI*2);ctx.fill();
 // hair
 ctx.fillStyle=isRemote?"#49352f":"#26333d";ctx.beginPath();ctx.arc(0,-103,25,Math.PI,Math.PI*2);ctx.lineTo(22,-95);ctx.quadraticCurveTo(5,-115,-21,-97);ctx.fill();
 // eye
 ctx.fillStyle="#182029";ctx.beginPath();ctx.arc(11,-97,2.3,0,Math.PI*2);ctx.fill();
 // arm and gun
 ctx.strokeStyle="#d6a27c";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(15,-62);ctx.lineTo(34,-49);ctx.stroke();
 drawWeaponShape(p.weapon,24,-55,1);
 // outline silhouette hint
 ctx.restore();
 if(p.downed){ctx.save();ctx.fillStyle="#ff7b87";ctx.font="900 8px Arial";ctx.textAlign="center";ctx.fillText("DOWN",x,y-118);ctx.restore()}
}
function drawWeaponShape(id,x,y,dir=1){
 ctx.save();ctx.translate(x,y);ctx.fillStyle="#1b2228";if(id==="shotgun"){roundRect(0,-6,49,12,4);ctx.fill();ctx.fillRect(38,-3,25,5)}else if(id==="rifle"){roundRect(0,-7,51,14,4);ctx.fill();ctx.fillRect(43,-3,29,5);ctx.fillRect(13,5,9,15)}else{roundRect(0,-6,42,12,4);ctx.fill();ctx.fillRect(35,-3,21,5);ctx.fillRect(11,5,8,13)}ctx.restore();
}
function drawZombie(z){
 const x=z.x-cameraX,y=groundY+z.lane;if(x<-100||x>W+100)return;const e=C.ENEMIES[z.type],scale=z.type==="brute"?1.42:z.type==="rusher"?.92:1;ctx.save();ctx.translate(x,y);if(z.dead){ctx.globalAlpha=Math.max(0,z.deathT/.55);ctx.rotate(.9);ctx.translate(0,8)}ctx.scale(scale,scale);
 const wobble=Math.sin(z.anim*8+z.x*.01)*2;
 ctx.globalAlpha*=.28;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(0,5,27,8,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=z.dead?Math.max(0,z.deathT/.55):1;
 // legs
 ctx.strokeStyle="#282f30";ctx.lineWidth=11;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-9,-25);ctx.lineTo(-13+wobble,0);ctx.moveTo(9,-25);ctx.lineTo(13-wobble,0);ctx.stroke();
 // torso
 const body=ctx.createLinearGradient(-20,-85,20,-25);body.addColorStop(0,z.flash>0?"#fff":e.color);body.addColorStop(1,"#263127");ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-22,-74);ctx.quadraticCurveTo(0,-86,22,-74);ctx.lineTo(19,-22);ctx.lineTo(-18,-22);ctx.closePath();ctx.fill();
 // arms
 ctx.strokeStyle=e.color;ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(-16,-61);ctx.lineTo(-32,-38+wobble);ctx.moveTo(16,-61);ctx.lineTo(31,-35-wobble);ctx.stroke();
 // head
 ctx.fillStyle="#9bb08b";ctx.beginPath();ctx.arc(0,-96,z.type==="brute"?24:21,0,Math.PI*2);ctx.fill();ctx.fillStyle="#31232b";ctx.beginPath();ctx.arc(-6,-99,3,0,Math.PI*2);ctx.arc(7,-99,3,0,Math.PI*2);ctx.fill();
 // special tells
 if(z.type==="leaper"){ctx.strokeStyle="#be71d7";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-13,-112);ctx.lineTo(-23,-128);ctx.moveTo(13,-112);ctx.lineTo(23,-128);ctx.stroke()}
 if(z.type==="corroder"){ctx.fillStyle="#94ce4c";ctx.beginPath();ctx.arc(0,-68,11,0,Math.PI*2);ctx.fill()}
 if(z.type==="caller"){ctx.fillStyle="#d89a5b";ctx.beginPath();ctx.arc(0,-95,9,0,Math.PI*2);ctx.fill()}
 if(z.type==="brute"){ctx.strokeStyle="#5b2e2e";ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(-16,-66);ctx.lineTo(-42,-32);ctx.moveTo(17,-66);ctx.lineTo(45,-28);ctx.stroke()}
 ctx.restore();
 if(e.special&&!z.dead){const pct=C.clamp(z.hp/z.maxHp,0,1);ctx.fillStyle="#250b10";roundRect(x-24,y-132,48,4,3);ctx.fill();ctx.fillStyle="#d25763";roundRect(x-24,y-132,48*pct,4,3);ctx.fill()}
}
function drawParticles(){
 for(const p of particles){const x=p.x-cameraX,alpha=C.clamp(p.life/p.max,0,1);ctx.globalAlpha=alpha;ctx.fillStyle=p.color;if(p.kind==="spark"){ctx.fillRect(x,p.y,p.size*2,p.size*.5)}else{ctx.beginPath();ctx.arc(x,p.y,p.size,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;
}
function render(){
 ctx.save();const sx=(Math.random()-.5)*screenShake,sy=(Math.random()-.5)*screenShake;ctx.translate(sx,sy);drawBackground();drawDecor();
 for(const p of pickups)if(!p.taken)drawPickup(p);
 const actors=[...zombies.map(z=>({lane:z.lane,type:"z",o:z})),...(remote?[{lane:remote.lane,type:"p",o:remote}]:[]),...(player?[{lane:player.lane,type:"me",o:player}]:[])].sort((a,b)=>a.lane-b.lane);
 for(const a of actors){if(a.type==="z")drawZombie(a.o);else drawSurvivor(a.o,a.type==="p")}
 for(const p of projectiles){ctx.fillStyle="#8ed352";ctx.beginPath();ctx.arc(p.x-cameraX,groundY+p.lane+p.y,6,0,Math.PI*2);ctx.fill()}
 drawParticles();ctx.restore();
}

function updateHud(){
 if(!player)return;const hp=C.clamp((player.hp+player.tempHp)/100*100,0,100);$("hpBar").style.width=hp+"%";$("hpText").textContent=Math.max(0,Math.round(player.hp))+(player.tempHp?(" +"+Math.round(player.tempHp)):"");$("ammo").textContent=player.ammo;$("reserve").textContent=player.reserve;const w=C.weaponStats(player.weapon,profile.levels[player.weapon]);$("weaponName").textContent=w.name;$("weaponLevel").textContent=w.level;
 const prog=C.clamp(player.x/C.STAGE.exitX*100,0,100);$("routeProgress").style.width=prog+"%";$("routeMarker").style.left=`calc(${prog}% - 4px)`;$("directorBadge").textContent=director?.intensity>.68?"DANGER":director?.intensity>.36?"PRESSURE":"CALM";$("directorBadge").classList.toggle("hot",(director?.intensity||0)>.68);
 if(finaleStarted)$("objective").textContent=exitOpen?"ENTER THE SAFEHOUSE":"SURVIVE THE FINAL HORDE · "+Math.ceil(finaleTimer);else $("objective").textContent="REACH THE SAFEHOUSE";
 if(remote){$("mateHud").classList.remove("hidden");$("mateName").textContent=remote.name||"PARTNER";$("mateHpBar").style.width=C.clamp((remote.hp||0)/100*100,0,100)+"%";$("mateHpText").textContent=Math.max(0,Math.round(remote.hp||0))+(remote.downed?" DOWN":"")}else $("mateHud").classList.add("hidden");
}
function armoryRender(){
 $("scrap").textContent=profile.scrap;const grid=$("armoryGrid");grid.innerHTML="";
 for(const id of ["smg","shotgun","rifle"]){const w=C.weaponStats(id,profile.levels[id]),cost=C.upgradeCost(w.level),card=document.createElement("div");card.className="weapon-card";card.innerHTML=`<div class="weapon-icon">${w.icon}</div><h3>${w.name}</h3><p>${w.desc}</p><div class="stat-row"><span>DAMAGE</span><b>${Math.round(w.damage)}</b></div><div class="stat-row"><span>MAG</span><b>${w.mag}</b></div><div class="stat-row"><span>LEVEL</span><b>${w.level}/10</b></div><button class="btn ${profile.scrap>=cost&&w.level<10?"primary":"ghost"}">${w.level>=10?"MAX LEVEL":"UPGRADE · "+cost+" SCRAP"}</button>`;card.querySelector("button").onclick=()=>{if(w.level>=10)return;if(profile.scrap<cost){toast("NOT ENOUGH SCRAP");return}profile.scrap-=cost;profile.levels[id]++;saveProfile();armoryRender()};grid.appendChild(card)}
}

function synth(type,variant){
 try{
  const AC=window.__audio||(window.__audio=new (window.AudioContext||window.webkitAudioContext)()),t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.connect(g);g.connect(AC.destination);
  let f=220,d=.08,vol=.06;if(type==="gun"){f=variant==="shotgun"?75:variant==="rifle"?115:145;d=variant==="shotgun"?.13:.055;vol=.12;o.type="sawtooth"}if(type==="hurt"){f=85;d=.16;vol=.07;o.type="square"}if(type==="kill"){f=310;d=.06;vol=.035;o.type="triangle"}if(type==="horde"){f=95;d=.5;vol=.05;o.type="sawtooth"}if(type==="pickup"){f=620;d=.07;vol=.035}if(type==="heal"||type==="revive"){f=440;d=.22;vol=.04}if(type==="objective"){f=520;d=.35;vol=.04}if(type==="reload"||type==="swap"){f=190;d=.04;vol=.025}if(type==="spit"){f=130;d=.12;vol=.04;o.type="sine"}
  o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f*.55),t+d);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.start(t);o.stop(t+d+.02);
 }catch{}
}

function loop(now){
 requestAnimationFrame(loop);let dt=Math.min(.034,(now-last)/1000||.016);last=now;if(mode==="playing"&&!paused){gameTime+=dt;updateLocal(dt);if(!online||net.isHost()){hostZombieAI(dt);directorUpdate(dt)}stageLogic(dt);updateParticles(dt);updateCamera(dt);networkUpdate(Date.now());updateHud()}if(mode==="playing"||mode==="loading")render();
}
requestAnimationFrame(loop);

// controls
const joyEl=$("joystick"),stick=$("stick");
function joySet(x,y){const r=joyEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,rad=r.width*.32;let dx=x-cx,dy=y-cy,l=Math.hypot(dx,dy)||1,k=Math.min(1,rad/l);dx*=k;dy*=k;joy.x=dx/rad;joy.y=dy/rad;stick.style.transform=`translate(${dx}px,${dy}px)`}
function joyStop(){joy.id=null;joy.x=joy.y=0;stick.style.transform="translate(0,0)"}
joyEl.onpointerdown=e=>{e.preventDefault();joy.id=e.pointerId;joyEl.setPointerCapture?.(e.pointerId);joySet(e.clientX,e.clientY)};joyEl.onpointermove=e=>{if(e.pointerId===joy.id)joySet(e.clientX,e.clientY)};joyEl.onpointerup=joyStop;joyEl.onpointercancel=joyStop;
$("fireBtn").onpointerdown=e=>{e.preventDefault();fireHeld=true;fire()};$("fireBtn").onpointerup=() =>fireHeld=false;$("fireBtn").onpointercancel=()=>fireHeld=false;
$("jumpBtn").onpointerdown=e=>{e.preventDefault();if(player&&!player.downed&&player.y===0){player.vy=-330;synth("swap")}};
$("reloadBtn").onpointerdown=e=>{e.preventDefault();reload()};$("swapBtn").onpointerdown=e=>{e.preventDefault();swapWeapon()};
$("useBtn").onpointerdown=e=>{e.preventDefault();use()};$("useBtn").onpointerup=()=>{useHeld=false;reviveProgress=0};$("useBtn").onpointercancel=()=>{useHeld=false;reviveProgress=0};
$("pauseBtn").onclick=()=>{paused=true;$("pause").classList.remove("hidden")};$("resumeBtn").onclick=()=>{paused=false;$("pause").classList.add("hidden");last=performance.now()};$("quitBtn").onclick=quitToMenu;
["contextmenu","selectstart","dragstart","gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));document.addEventListener("touchmove",e=>{if(mode==="playing")e.preventDefault()},{passive:false});

// menus
$("soloBtn").onclick=()=>{difficulty="normal";online=false;startGame(false)};
$("createBtn").onclick=()=>connectRoom(C.makeRoomCode(),true);
$("joinBtn").onclick=()=>{$("joinModal").classList.remove("hidden")};$("joinCancel").onclick=()=>$("joinModal").classList.add("hidden");$("joinNow").onclick=()=>{const c=$("joinCode").value.trim().toUpperCase();if(c.length===5)connectRoom(c,false)};
async function connectRoom(code,creator){$("menu").classList.add("hidden");$("joinModal").classList.add("hidden");$("lobby").classList.remove("hidden");$("netState").textContent="CONNECTING";try{await net.connect(code,{creator});history.replaceState(null,"",roomLink());renderLobby()}catch(e){$("lobby").classList.add("hidden");$("fatalText").textContent=e.message;$("fatal").classList.remove("hidden")}}
$("saveName").onclick=async()=>{await net.rename($("playerName").value);renderLobby()};$("difficulty").onchange=e=>{difficulty=e.target.value};
$("shareBtn").onclick=async()=>{const url=roomLink();if(navigator.share)try{await navigator.share({title:"Hobile: Outbreak",text:"Join my co-op room "+net.room,url})}catch{}else try{await navigator.clipboard.writeText(url)}catch{}};
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomLink());$("copyBtn").textContent="COPIED";setTimeout(()=>$("copyBtn").textContent="COPY LINK",900)}catch{}};
$("startOnline").onclick=()=>{if(!net.isHost()||net.players.length<2)return;difficulty=$("difficulty").value;net.send("match_start",{difficulty});startGame(true)};
$("leaveLobby").onclick=async()=>{await net.disconnect();$("lobby").classList.add("hidden");$("menu").classList.remove("hidden");const u=new URL(location.href);u.searchParams.delete("room");history.replaceState(null,"",u.pathname)};
$("armoryBtn").onclick=()=>{armoryRender();$("armory").classList.remove("hidden")};$("armoryClose").onclick=()=>$("armory").classList.add("hidden");$("continueBtn").onclick=quitToMenu;$("fatalClose").onclick=()=>{$("fatal").classList.add("hidden");$("menu").classList.remove("hidden")};

function roomLink(){const u=new URL(location.href);u.searchParams.set("room",net.room);u.hash="";return u.toString()}
const incomingRoom=new URL(location.href).searchParams.get("room");if(incomingRoom&&incomingRoom.length===5)setTimeout(()=>connectRoom(incomingRoom,false),250);

window.__outbreakDebug={state:()=>({mode,online,room:net.room,host:net.hostId,me:net.id,player,remote,zombies:zombies.length,director,exitOpen}),spawn:type=>spawnZombie(type,player.x+260,player.lane),horde:()=>spawnBudget(12,true)};
})();