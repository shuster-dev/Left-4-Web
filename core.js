export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const expSmoothing=(rate,dt)=>1-Math.exp(-rate*dt);

export const WEAPONS={
  ar:{name:'WARDEN AR',damage:27,mag:30,reserve:150,fireRate:.105,reload:1.55,spread:.010,movingSpread:.010,recoil:.012,range:28,pellets:1,assist:.030},
  smg:{name:'RIPPER SMG',damage:18,mag:38,reserve:190,fireRate:.072,reload:1.30,spread:.015,movingSpread:.016,recoil:.008,range:23,pellets:1,assist:.035},
  shotgun:{name:'BREACH-8',damage:17,mag:8,reserve:56,fireRate:.62,reload:1.75,spread:.055,movingSpread:.018,recoil:.036,range:14,pellets:7,assist:.025}
};
export const INFECTED={
  runner:{name:'RUNNER',hp:58,speed:1.85,damage:7,range:1.08,cooldown:.78,score:1,special:false,radius:.42},
  stalker:{name:'STALKER',hp:165,speed:2.10,damage:13,range:1.20,cooldown:1.05,score:5,special:true,radius:.48},
  bloated:{name:'BLOATED',hp:260,speed:.86,damage:16,range:1.28,cooldown:1.35,score:7,special:true,radius:.66}
};
export function makeDirector(){return{phase:'RELIEF',timer:3,intensity:0,wave:0,elapsed:0}}
export function directorStep(d,ctx,dt){
 d={...d};d.elapsed+=dt;d.timer-=dt;
 const stress=clamp((100-ctx.hp)/100*.45+ctx.nearby*.045+(ctx.ammoRatio<.2?.18:0),0,1);
 d.intensity=clamp(d.intensity+stress*dt*.18-dt*.04,0,1);
 let event=null;
 if(d.timer<=0){
  if(d.phase==='RELIEF'){d.phase='BUILD';d.timer=7;event={type:'ambient',count:4+d.wave*2}}
  else if(d.phase==='BUILD'){d.phase='PEAK';d.timer=9;d.wave++;event={type:'horde',count:8+Math.min(8,d.wave*2),special:d.wave%2===1?'stalker':'bloated'};d.intensity=.95}
  else if(d.phase==='PEAK'){d.phase='RECOVERY';d.timer=7;event={type:'recovery'};d.intensity=.3}
  else {d.phase='RELIEF';d.timer=4;d.intensity=.1}
 }
 return{director:d,event};
}

export function circleIntersectsBox(x,z,r,b){
 const qx=clamp(x,b.minX,b.maxX),qz=clamp(z,b.minZ,b.maxZ),dx=x-qx,dz=z-qz;
 return dx*dx+dz*dz<r*r;
}
export function moveCircle(x,z,dx,dz,r,boxes,bounds){
 const b=bounds||{minX:-Infinity,maxX:Infinity,minZ:-Infinity,maxZ:Infinity};
 const blocked=(nx,nz)=>boxes.some(o=>circleIntersectsBox(nx,nz,r,o));
 let nx=clamp(x+dx,b.minX,b.maxX),nz=clamp(z+dz,b.minZ,b.maxZ);
 if(!blocked(nx,nz))return{x:nx,z:nz,blocked:false};
 nx=clamp(x+dx,b.minX,b.maxX);nz=z;
 if(!blocked(nx,nz))return{x:nx,z:nz,blocked:true};
 nx=x;nz=clamp(z+dz,b.minZ,b.maxZ);
 if(!blocked(nx,nz))return{x:nx,z:nz,blocked:true};
 return{x,z,blocked:true};
}
export function segmentHitsRect(x1,z1,x2,z2,b,pad=0){
 const minX=b.minX-pad,maxX=b.maxX+pad,minZ=b.minZ-pad,maxZ=b.maxZ+pad;
 let t0=0,t1=1,dx=x2-x1,dz=z2-z1;
 for(const [p,q] of [[-dx,x1-minX],[dx,maxX-x1],[-dz,z1-minZ],[dz,maxZ-z1]]){
  if(Math.abs(p)<1e-9){if(q<0)return false;continue}
  const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r}else{if(r<t0)return false;if(r<t1)t1=r}
 }
 return true;
}
export function lineBlocked(x1,z1,x2,z2,boxes,pad=.05){return boxes.some(b=>segmentHitsRect(x1,z1,x2,z2,b,pad))}

export function raySphereDistance(ox,oy,oz,dx,dy,dz,cx,cy,cz,r){
 const lx=cx-ox,ly=cy-oy,lz=cz-oz,tca=lx*dx+ly*dy+lz*dz;
 if(tca<0)return Infinity;const d2=lx*lx+ly*ly+lz*lz-tca*tca,rr=r*r;if(d2>rr)return Infinity;
 const thc=Math.sqrt(Math.max(0,rr-d2));const t0=tca-thc,t1=tca+thc;return t0>=0?t0:t1>=0?t1:Infinity;
}
export function rayBoxDistance(ox,oy,oz,dx,dy,dz,b){
 let tmin=0,tmax=Infinity;
 for(const [o,d,min,max] of [[ox,dx,b.minX,b.maxX],[oy,dy,b.minY,b.maxY],[oz,dz,b.minZ,b.maxZ]]){
  if(Math.abs(d)<1e-9){if(o<min||o>max)return Infinity;continue}
  let t1=(min-o)/d,t2=(max-o)/d;if(t1>t2){const q=t1;t1=t2;t2=q}
  tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return Infinity;
 }
 return tmin>=0?tmin:tmax>=0?tmax:Infinity;
}
export function chooseAimTarget(origin,dir,enemies,maxRange,assistAngle,boxes=[]){
 let best=null,bestScore=Infinity;
 for(const e of enemies){
  if(e.dead||e.hp<=0)continue;const vx=e.x-origin.x,vy=(e.hitY??.9)-origin.y,vz=e.z-origin.z,dist=Math.hypot(vx,vy,vz);if(dist>maxRange||dist<.01)continue;
  const inv=1/dist,dot=clamp(vx*inv*dir.x+vy*inv*dir.y+vz*inv*dir.z,-1,1),ang=Math.acos(dot);if(ang>assistAngle)continue;
  const blocked=boxes.some(b=>{const t=rayBoxDistance(origin.x,origin.y,origin.z,vx*inv,vy*inv,vz*inv,b);return t<dist-.2});if(blocked)continue;
  const score=ang*8+dist*.01;if(score<bestScore){best=e;bestScore=score}
 }
 return best;
}
export function formatTime(sec){sec=Math.max(0,Math.floor(sec));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')}


export function makeWeaponInventory(){
 return Object.fromEntries(Object.entries(WEAPONS).map(([id,w])=>[id,{ammo:w.mag,reserve:w.reserve}]));
}
export function switchWeaponState(inventory,currentId,nextId,currentAmmo,currentReserve){
 const inv={...inventory,[currentId]:{ammo:Math.max(0,currentAmmo|0),reserve:Math.max(0,currentReserve|0)}};
 const fallback=WEAPONS[nextId]||WEAPONS.ar;
 const next=inv[nextId]||{ammo:fallback.mag,reserve:fallback.reserve};
 inv[nextId]={ammo:next.ammo,reserve:next.reserve};
 return {inventory:inv,ammo:next.ammo,reserve:next.reserve};
}
export function selectAttackers(enemies,px,pz,maxCommon=3){
 const alive=(enemies||[]).filter(e=>!e.dead&&e.hp>0).map(e=>({e,d:Math.hypot(e.x-px,e.z-pz)})).sort((a,b)=>a.d-b.d);
 const out=new Set(),common=[];
 for(const item of alive){
  const cfg=INFECTED[item.e.type];
  if(cfg?.special&&item.d<Math.max(2.2,cfg.range+1.1))out.add(item.e.id);
  else if(!cfg?.special)common.push(item);
 }
 for(const item of common.slice(0,maxCommon))out.add(item.e.id);
 return out;
}
