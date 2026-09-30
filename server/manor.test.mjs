import test from 'node:test';
import assert from 'node:assert/strict';
import {rooms,portals,wallSegments,spawn,roomAt} from '../public/modules/virtual-manor/engine/layout.js';
import {movePlayer,circleHits,radius} from '../public/modules/virtual-manor/engine/collision.js';
import * as T from '../public/modules/virtual-manor/vendor/three.module.min.js';
import {buildWorld} from '../public/modules/virtual-manor/engine/world.js';
test('the fixed ground floor is connected and every portal is usable by a player capsule',()=>{
 const reached=new Set(['hall']);for(let k=0;k<rooms.length;k++)for(const p of portals){if(reached.has(p.from))reached.add(p.to);if(reached.has(p.to))reached.add(p.from);assert.ok(p.max-p.min>radius*2+.2);}
 assert.equal(reached.size,rooms.length);assert.equal(roomAt(spawn.x,spawn.z).id,'hall');
 const walls=rooms.flatMap(wallSegments).map(s=>s.axis==='x'?{x0:s.at-.12,x1:s.at+.12,z0:s.min,z1:s.max}:{x0:s.min,x1:s.max,z0:s.at-.12,z1:s.at+.12});
 for(const p of portals){const middle=(p.min+p.max)/2,player=p.axis==='x'?{x:p.at-.8,z:middle}:{x:middle,z:p.at-.8};movePlayer(player,p.axis==='x'?1.6:0,p.axis==='z'?1.6:0,walls);assert.ok(Math.abs((p.axis==='x'?player.x:player.z)-(p.at+.8))<.001,`${p.from} to ${p.to} blocked`);}
});
test('authored furniture leaves every room reachable and merged geometry stays inside the foundation budget',()=>{
 const keys=['wood','darkWood','brass','black','plaster','wallpaper','marble','darkMarble','rug','tile','grass','leaf','soil','terracotta','leather','linen','light','glass','water','portrait','bookRed','bookGreen','bookTan','paper'];
 const materials=Object.fromEntries(keys.map(k=>[k,new T.MeshStandardMaterial()]));const world=buildWorld(materials);
 try{
  assert.ok(world.root.children.length<=24);let tris=0;
  for(const mesh of world.root.children){const g=mesh.geometry;for(const v of g.attributes.position.array)assert.ok(Number.isFinite(v));for(const id of g.index.array)assert.ok(id<g.attributes.position.count);tris+=g.index.count/3;}
  assert.ok(tris<120000);
  const step=.25,start=[80,12],seen=new Set(),queue=[start],reached=new Set();
  for(let i=0;i<queue.length;i++){const [ix,iz]=queue[i],key=ix+','+iz;if(seen.has(key))continue;seen.add(key);const x=ix*step-20,z=iz*step,room=roomAt(x,z);if(!room||world.colliders.some(b=>circleHits(x,z,radius,b)))continue;reached.add(room.id);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=ix+dx,nz=iz+dz;if(nx>=0&&nx<=160&&nz>=0&&nz<=320&&!seen.has(nx+','+nz))queue.push([nx,nz]);}}
  assert.deepEqual([...reached].sort(),rooms.map(r=>r.id).sort(),'Furniture disconnected a room');
 }finally{world.dispose();for(const mat of Object.values(materials))mat.dispose();}
});
test('movement cannot tunnel through walls and slides along furniture without entering it',()=>{
 const wall={x0:1,x1:1.2,z0:-10,z1:10};const p={x:0,z:0};movePlayer(p,10,0,[wall]);assert.ok(p.x<=1-radius);assert.ok(!circleHits(p.x,p.z,radius,wall));
 const q={x:.7,z:0};movePlayer(q,1,3,[wall]);assert.ok(q.x<=1-radius);assert.ok(q.z>2.9);
 const closed=[{x0:-.2,x1:.2,z0:1,z1:2}];const r={x:0,z:0};movePlayer(r,0,100,closed);assert.ok(r.z<1);
});
