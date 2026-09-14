export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const WEAPONS={
  ar:{name:'WARDEN AR',damage:27,mag:30,reserve:150,fireRate:.12,reload:1.45,spread:.06,range:22,pellets:1},
  smg:{name:'RIPPER SMG',damage:18,mag:38,reserve:190,fireRate:.075,reload:1.25,spread:.09,range:18,pellets:1},
  shotgun:{name:'BREACH-8',damage:17,mag:8,reserve:56,fireRate:.62,reload:1.65,spread:.22,range:12,pellets:7}
};
export const INFECTED={
  runner:{name:'RUNNER',hp:58,speed:1.78,damage:7,range:1.25,cooldown:.8,score:1,special:false},
  stalker:{name:'STALKER',hp:165,speed:2.05,damage:13,range:1.5,cooldown:1.05,score:5,special:true},
  bloated:{name:'BLOATED',hp:260,speed:.8,damage:16,range:1.55,cooldown:1.35,score:7,special:true}
};
export function makeDirector(){return{phase:'RELIEF',timer:3,intensity:0,wave:0,elapsed:0}}
export function directorStep(d,ctx,dt){
 d={...d};d.elapsed+=dt;d.timer-=dt;
 const stress=clamp((100-ctx.hp)/100*.45+ctx.nearby*.045+(ctx.ammoRatio<.2?.18:0),0,1);
 d.intensity=clamp(d.intensity+stress*dt*.18-dt*.04,0,1);
 let event=null;
 if(d.timer<=0){
  if(d.phase==='RELIEF'){d.phase='BUILD';d.timer=7;event={type:'ambient',count:5+d.wave*2}}
  else if(d.phase==='BUILD'){d.phase='PEAK';d.timer=9;d.wave++;event={type:'horde',count:10+Math.min(10,d.wave*3),special:d.wave%2===1?'stalker':'bloated'};d.intensity=.95}
  else if(d.phase==='PEAK'){d.phase='RECOVERY';d.timer=7;event={type:'recovery'};d.intensity=.3}
  else {d.phase='RELIEF';d.timer=4;d.intensity=.1}
 }
 return{director:d,event};
}
export function selectHits(shooter,enemies,weapon,rand=Math.random){
 const w=WEAPONS[weapon]; if(!w)return[]; const out=[]; const pellets=w.pellets||1;
 for(let p=0;p<pellets;p++){
  let best=null,bestScore=1e9;
  for(const e of enemies){if(e.dead||e.hp<=0)continue;const dx=e.x-shooter.x,dz=e.z-shooter.z,dist=Math.hypot(dx,dz);if(dist>w.range)continue;const inv=1/(dist||1);const dot=(dx*inv)*shooter.aimX+(dz*inv)*shooter.aimZ;const angle=Math.acos(clamp(dot,-1,1));const allowed=w.spread*(weapon==='shotgun'?1.2:1)+(e.radius||.55)/Math.max(2,dist);if(angle<=allowed){const score=angle*6+dist*.025;if(score<bestScore){best=e;bestScore=score}}} if(best)out.push(best);
 }
 return out;
}
export function formatTime(sec){sec=Math.max(0,Math.floor(sec));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')}
