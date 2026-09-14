import assert from 'node:assert/strict';
import {WEAPONS,INFECTED,makeDirector,directorStep,circleIntersectsBox,moveCircle,lineBlocked,raySphereDistance,rayBoxDistance,chooseAimTarget,formatTime,makeWeaponInventory,switchWeaponState,selectAttackers} from './core.js';
assert.equal(Object.keys(WEAPONS).length,3);
assert.equal(Object.keys(INFECTED).length,3);
const box={minX:1,maxX:2,minZ:1,maxZ:2,minY:0,maxY:2};
assert.equal(circleIntersectsBox(1.1,1.1,.3,box),true);
assert.equal(circleIntersectsBox(0,0,.3,box),false);
let m=moveCircle(0,1.5,2,0,.35,[box],{minX:-10,maxX:10,minZ:-10,maxZ:10});
assert(m.x<1,'player may not tunnel through wall');
assert.equal(lineBlocked(0,1.5,3,1.5,[box]),true);
assert.equal(lineBlocked(0,0,0,3,[box]),false);
const rs=raySphereDistance(0,0,0,1,0,0,5,0,0,1);assert(Math.abs(rs-4)<1e-6);
const rb=rayBoxDistance(0,1,1.5,1,0,0,{minX:3,maxX:4,minY:0,maxY:2,minZ:1,maxZ:2});assert(Math.abs(rb-3)<1e-6);
const target=chooseAimTarget({x:0,y:1,z:0},{x:1,y:0,z:0},[{x:6,z:.1,hitY:1,hp:50,dead:false}],20,.05,[]);assert(target);
const blocked=chooseAimTarget({x:0,y:1,z:0},{x:1,y:0,z:0},[{x:6,z:0,hitY:1,hp:50,dead:false}],20,.05,[{minX:2,maxX:3,minY:0,maxY:2,minZ:-1,maxZ:1}]);assert.equal(blocked,null);
let d=makeDirector(),evt=null;for(let i=0;i<40;i++){const r=directorStep(d,{hp:100,nearby:0,ammoRatio:1},.5);d=r.director;if(r.event?.type==='horde'){evt=r.event;break}}assert(evt);
assert.equal(formatTime(125.9),'2:05');

const inv=makeWeaponInventory();const sw=switchWeaponState(inv,'ar','shotgun',7,91);
assert.equal(sw.inventory.ar.ammo,7);assert.equal(sw.inventory.ar.reserve,91);assert.equal(sw.ammo,WEAPONS.shotgun.mag);
const slots=selectAttackers([
 {id:'a',type:'runner',x:1,z:0,hp:10,dead:false},{id:'b',type:'runner',x:1.1,z:0,hp:10,dead:false},
 {id:'c',type:'runner',x:1.2,z:0,hp:10,dead:false},{id:'d',type:'runner',x:1.3,z:0,hp:10,dead:false},
 {id:'s',type:'stalker',x:1.5,z:0,hp:10,dead:false}
],0,0,3);assert(slots.has('s'));assert.equal([...slots].filter(x=>x!=='s').length,3);

console.log('PASS weapon roster');
console.log('PASS infected roster');
console.log('PASS player collision');
console.log('PASS wall line-of-sight');
console.log('PASS ray/sphere hit math');
console.log('PASS ray/box occlusion');
console.log('PASS aim assist visibility');
console.log('PASS director cycle');
console.log('PASS timer formatting');
console.log('PASS per-weapon ammo persistence');
console.log('PASS infected attack-slot cap');
console.log('11/11 combat core tests passed');
