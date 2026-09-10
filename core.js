(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.OutbreakCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 class RNG{
  constructor(seed=123456789){this.s=(seed>>>0)||1}
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return(this.s>>>0)/4294967296}
  range(a,b){return a+(b-a)*this.next()}
  int(a,b){return Math.floor(this.range(a,b+1))}
  pick(a){return a[Math.floor(this.next()*a.length)]}
 }
 const WEAPONS={
  smg:{id:"smg",name:"RIPPER SMG",icon:"⌁",damage:16,fireRate:0.085,mag:32,reserve:160,reload:1.25,spread:.055,range:720,knock:12,desc:"Fast close-range primary. Forgiving on mobile."},
  shotgun:{id:"shotgun",name:"BREACH-8",icon:"▰",damage:13,pellets:7,fireRate:.62,mag:8,reserve:56,reload:1.75,spread:.18,range:470,knock:32,desc:"Heavy burst damage and strong crowd control."},
  rifle:{id:"rifle",name:"WARDEN AR",icon:"⌐",damage:28,fireRate:.16,mag:24,reserve:120,reload:1.55,spread:.035,range:880,knock:18,desc:"Accurate all-round rifle for specials and long lanes."}
 };
 const ENEMIES={
  drifter:{id:"drifter",name:"Drifter",hp:62,speed:58,damage:7,reach:36,attackRate:.85,score:1,special:false,color:"#6f8a69"},
  rusher:{id:"rusher",name:"Rusher",hp:44,speed:102,damage:5,reach:32,attackRate:.55,score:1,special:false,color:"#8b5c65"},
  leaper:{id:"leaper",name:"Leaper",hp:120,speed:76,damage:11,reach:44,attackRate:1.0,score:5,special:true,color:"#8d4ba4"},
  corroder:{id:"corroder",name:"Corroder",hp:145,speed:48,damage:9,reach:290,attackRate:2.2,score:6,special:true,color:"#7fa342"},
  caller:{id:"caller",name:"Caller",hp:130,speed:52,damage:6,reach:40,attackRate:1.1,score:7,special:true,color:"#b8784b"},
  brute:{id:"brute",name:"Brute",hp:650,speed:34,damage:22,reach:58,attackRate:1.35,score:16,special:true,color:"#6f4040"}
 };
 const DIFFICULTY={
  normal:{hpMult:1,damageMult:1,spawnMult:1},
  hard:{hpMult:1.25,damageMult:1.25,spawnMult:1.15},
  nightmare:{hpMult:1.55,damageMult:1.55,spawnMult:1.35}
 };
 const STAGE={
  id:"ashwood-road",name:"ASHWOOD ROAD",width:5400,exitX:5160,
  checkpoints:[900,2100,3400,4400],
  finaleStart:4550,
  pickups:[
   {x:720,type:"medkit"},{x:1320,type:"ammo"},{x:1880,type:"shotgun"},
   {x:2640,type:"stim"},{x:3180,type:"ammo"},{x:3560,type:"rifle"},
   {x:4020,type:"medkit"},{x:4480,type:"ammo"}
  ]
 };
 function weaponStats(id,level=1){
  const w=WEAPONS[id]||WEAPONS.smg,l=Math.max(1,Math.min(10,level|0)),boost=1+(l-1)*.085;
  return {...w,damage:w.damage*boost,mag:Math.round(w.mag*(1+(l-1)*.025)),reload:Math.max(.65,w.reload*(1-(l-1)*.025)),level:l}
 }
 function upgradeCost(level){return Math.round(60*Math.pow(1.48,Math.max(0,level-1)))}
 function makeRoomCode(rand=Math.random){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let out="";
  for(let i=0;i<5;i++)out+=chars[Math.floor(rand()*chars.length)];
  return out;
 }
 function flattenPresence(state){
  const out=[],seen=new Set();
  for(const arr of Object.values(state||{}))for(const p of arr||[])if(p?.id&&!seen.has(p.id)){seen.add(p.id);out.push(p)}
  return out;
 }
 function electHost(players){
  if(!players?.length)return null;
  const creators=players.filter(p=>p.creator),pool=creators.length?creators:players;
  return [...pool].sort((a,b)=>(+a.joinedAt||0)-(+b.joinedAt||0)||String(a.id).localeCompare(String(b.id)))[0]?.id||null;
 }
 function directorStep(d,ctx,dt){
  d={...d};d.time=(d.time||0)+dt;d.cooldown=Math.max(0,(d.cooldown||0)-dt);
  const hp=ctx.avgHp??100,near=ctx.nearby??0,progress=ctx.progress??0,ammo=ctx.ammoRatio??1;
  const stress=clamp((100-hp)/100*.55+near*.08+(ammo<.25?.18:0),0,1);
  d.intensity=clamp((d.intensity||0)+stress*dt*.22-dt*.05,0,1);
  let event=null;
  const cp=(ctx.checkpointIndex||0);
  const triggerProgress=[.17,.39,.63,.84];
  if((d.nextMilestone||0)<triggerProgress.length && progress>=triggerProgress[d.nextMilestone||0]){
    event={type:"horde",budget:8+cp*3};d.nextMilestone=(d.nextMilestone||0)+1;d.cooldown=7;d.intensity=.78;
  }else if(ctx.finale && !d.finaleTriggered){
    event={type:"finale",budget:18};d.finaleTriggered=true;d.cooldown=5;d.intensity=1;
  }else if(d.cooldown<=0 && d.intensity<.72 && ctx.alivePlayers>0){
    const base=2+Math.floor(progress*4);
    event={type:"ambient",budget:Math.max(1,Math.round(base*(ctx.spawnMult||1)))};
    d.cooldown=3.5+Math.random()*2.5;
  }
  return {director:d,event};
 }
 function chooseEnemy(rng,budget,progress,finale=false){
  const table=[["drifter",1],["rusher",1]];
  if(progress>.18)table.push(["leaper",4]);
  if(progress>.32)table.push(["corroder",5]);
  if(progress>.5)table.push(["caller",5]);
  if(progress>.72||finale)table.push(["brute",12]);
  const allowed=table.filter(([,c])=>c<=budget);return allowed.length?rng.pick(allowed):["drifter",1];
 }
 function lineShotTarget(shooter,enemies,range,laneTolerance=54){
  const dir=shooter.facing>=0?1:-1;
  let best=null,bestDist=Infinity;
  for(const e of enemies){
    if(e.dead||e.hp<=0)continue;
    const dx=e.x-shooter.x;if(Math.sign(dx)!==dir||Math.abs(dx)>range)continue;
    const lane=Math.abs((e.lane||0)-(shooter.lane||0));if(lane>laneTolerance)continue;
    const d=Math.abs(dx)+lane*.6;if(d<bestDist){best=e;bestDist=d}
  }
  return best;
 }
 function formatTime(sec){sec=Math.max(0,sec|0);return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0")}
 return {clamp,RNG,WEAPONS,ENEMIES,DIFFICULTY,STAGE,weaponStats,upgradeCost,makeRoomCode,flattenPresence,electHost,directorStep,chooseEnemy,lineShotTarget,formatTime};
});