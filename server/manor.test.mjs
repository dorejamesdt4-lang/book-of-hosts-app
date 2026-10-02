import test from 'node:test';
import assert from 'node:assert/strict';
import {rooms,portals,wallSegments,spawn,roomAt} from '../public/modules/virtual-manor/engine/layout.js';
import {movePlayer,circleHits,radius,movementVector} from '../public/modules/virtual-manor/engine/collision.js';
import * as T from '../public/modules/virtual-manor/vendor/three.module.min.js';
import {buildWorld} from '../public/modules/virtual-manor/engine/world.js';
import {CompatibilityRenderer} from '../public/modules/virtual-manor/engine/compatibility.js';
test('software preview depth keeps near surfaces in front regardless of mesh order',()=>{
 let frame;
 const context={setTransform(){},fillRect(){},clearRect(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(image){frame=image;}};
 const canvas={getContext(){return context;}},renderer=new CompatibilityRenderer(canvas);renderer.setSize(64,64);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(66,1,.08,100);
 const red=new T.MeshStandardMaterial({color:'#ff0000'}),blue=new T.MeshStandardMaterial({color:'#0000ff'});
 const near=new T.Mesh(new T.PlaneGeometry(3,3),red),far=new T.Mesh(new T.PlaneGeometry(8,8),blue);near.position.z=-2;far.position.z=-4;
 try{for(const order of [[near,far],[far,near]]){scene.clear();scene.add(...order);renderer.render(scene,camera);const center=16*32+16,off=center*4;assert.ok(frame.data[off]>100);assert.equal(frame.data[off+2],0);assert.ok(Math.abs(renderer.depth[center]-2)<.0001);}}
 finally{near.geometry.dispose();far.geometry.dispose();red.dispose();blue.dispose();renderer.dispose();}
});
test('forward and right movement follow the actual first-person camera orientation',()=>{
 for(const yaw of [0,.5,Math.PI/2,Math.PI]){const camera=new T.PerspectiveCamera();camera.rotation.set(0,Math.PI+yaw,0);camera.updateMatrixWorld(true);const f=new T.Vector3();camera.getWorldDirection(f);const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),walk=movementVector(yaw,0,1,1),strafe=movementVector(yaw,1,0,1);assert.ok(f.dot(new T.Vector3(walk.dx,0,walk.dz))>.999);assert.ok(right.dot(new T.Vector3(strafe.dx,0,strafe.dz))>.999);}
});
test('the fixed ground floor is connected and every portal is usable by a player capsule',()=>{
 const reached=new Set(['hall']);for(let k=0;k<rooms.length;k++)for(const p of portals){if(reached.has(p.from))reached.add(p.to);if(reached.has(p.to))reached.add(p.from);assert.ok(p.max-p.min>radius*2+.2);}
 assert.equal(reached.size,rooms.length);assert.equal(roomAt(spawn.x,spawn.z).id,'hall');
 const walls=rooms.flatMap(wallSegments).map(s=>s.axis==='x'?{x0:s.at-.12,x1:s.at+.12,z0:s.min,z1:s.max}:{x0:s.min,x1:s.max,z0:s.at-.12,z1:s.at+.12});
 for(const p of portals){const middle=(p.min+p.max)/2,player=p.axis==='x'?{x:p.at-.8,z:middle}:{x:middle,z:p.at-.8};movePlayer(player,p.axis==='x'?1.6:0,p.axis==='z'?1.6:0,walls);assert.ok(Math.abs((p.axis==='x'?player.x:player.z)-(p.at+.8))<.001,`${p.from} to ${p.to} blocked`);}
});
test('authored furniture leaves every room reachable and merged geometry stays inside the foundation budget',()=>{
 const keys=['contact','stoneFloor','parquet','wood','darkWood','brass','black','plaster','wallpaper','marble','darkMarble','rug','tile','grass','leaf','soil','terracotta','leather','linen','light','glass','water','portrait','landscape','bookRed','bookGreen','bookTan','paper'];
 const materials=Object.fromEntries(keys.map(k=>[k,new T.MeshStandardMaterial()]));const world=buildWorld(materials);
 try{
  assert.ok(world.root.children.length<=27);let tris=0;
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

test('hall and gallery share a continuous centred floor texture grid',()=>{
 const keys=['contact','stoneFloor','parquet','wood','darkWood','brass','black','plaster','wallpaper','marble','darkMarble','rug','tile','grass','leaf','soil','terracotta','leather','linen','light','glass','water','portrait','landscape','bookRed','bookGreen','bookTan','paper'];
 const mats=Object.fromEntries(keys.map(k=>[k,new T.MeshStandardMaterial()])),world=buildWorld(mats);
 try{const g=world.root.children.find(mesh=>mesh.material===mats.stoneFloor).geometry;
 assert.equal(g.attributes.position.count,8);
 for(let i=0;i<8;i++){const p=g.attributes.position,uv=g.attributes.uv;assert.ok(Math.abs(uv.getX(i)-(p.getX(i)/3+.5))<1e-6);assert.ok(Math.abs(uv.getY(i)+p.getZ(i)/3)<1e-6);}
 }finally{world.dispose();Object.values(mats).forEach(m=>m.dispose());}
});

import {Architecture} from '../public/modules/virtual-manor/engine/geometry.js?v=manor-10';
test('every gallery picture backing clears the complete doorway moulding',()=>{
 const keys=['contact','stoneFloor','parquet','wood','darkWood','brass','black','plaster','wallpaper','marble','darkMarble','rug','tile','grass','leaf','soil','terracotta','leather','linen','light','glass','water','portrait','landscape','bookRed','bookGreen','bookTan','paper'];
 const mats=Object.fromEntries(keys.map(k=>[k,new T.MeshStandardMaterial()])),frames=[],lamps=[],original=Architecture.prototype.bevel,originalBox=Architecture.prototype.box;
 Architecture.prototype.bevel=function(w,h,d,x,y,z,...rest){if(Math.abs(Math.abs(x)-1.8)<1e-6&&y===2.37)frames.push({x,z,half:w/2+.012});return original.call(this,w,h,d,x,y,z,...rest);};
 Architecture.prototype.box=function(w,h,d,x,y,z,...rest){if(w===.14&&h===.38&&Math.abs(Math.abs(x)-1.76)<1e-6)lamps.push({x,z});return originalBox.call(this,w,h,d,x,y,z,...rest);};
 let world;
 try{world=buildWorld(mats);assert.equal(frames.length,8);for(const f of frames)for(const p of portals.filter(p=>p.axis==='x'&&Math.sign(p.at)===Math.sign(f.x)&&(p.from==='gallery'||p.to==='gallery'))){assert.ok(f.z+f.half<p.min-.34||f.z-f.half>p.max+.34,`Picture at ${f.z} overlaps ${p.to}`);}assert.equal(lamps.length,8);for(const lamp of lamps){for(const f of frames.filter(f=>Math.sign(f.x)===Math.sign(lamp.x)))assert.ok(Math.abs(lamp.z-f.z)>f.half+.14,'Lamp overlaps picture');for(const p of portals.filter(p=>p.axis==='x'&&Math.sign(p.at)===Math.sign(lamp.x)&&(p.from==='gallery'||p.to==='gallery')))assert.ok(lamp.z+.14<p.min-.34||lamp.z-.14>p.max+.34,'Lamp overlaps doorway');}}
 finally{Architecture.prototype.bevel=original;Architecture.prototype.box=originalBox;world?.dispose();Object.values(mats).forEach(m=>m.dispose());}
});
