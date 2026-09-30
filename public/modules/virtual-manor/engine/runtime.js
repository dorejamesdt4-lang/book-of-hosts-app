import * as T from '../vendor/three.module.min.js';
import {makeMaterials} from './materials.js';
import {buildWorld} from './world.js';
import {FirstPersonInput} from './input.js';
import {movePlayer} from './collision.js';
import {spawn,roomAt} from './layout.js';
export async function createManor(canvas,ui,callbacks){
 const abort=new AbortController();let disposed=false,playing=false,raf=0,last=0,frames=0,elapsed=0,target=null;
 const scene=new T.Scene();scene.background=new T.Color('#16242b');scene.fog=new T.Fog('#19272b',22,75);
 const camera=new T.PerspectiveCamera(66,1,.08,100);camera.rotation.order='YXZ';
 const renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 const mobile=matchMedia('(pointer:coarse)').matches;let quality=mobile?'low':'balanced';
 let materials,world,input,observer;
 try{
  callbacks.progress(10,'Preparing the renderer');
  materials=await makeMaterials(f=>callbacks.progress(10+f*55,'Loading mansion materials'));
  callbacks.progress(70,'Building the mansion');world=buildWorld(materials.m);scene.add(world.root);
  const ambient=new T.HemisphereLight('#dcc7a6','#483528',1.25);scene.add(ambient);
  const moon=new T.DirectionalLight('#9ebfda',1.5);moon.position.set(9,16,51);scene.add(moon);
  const hallLight=new T.SpotLight('#ffdbad',95,20,.85,.5,1.6);hallLight.position.set(0,3.8,5.5);hallLight.target.position.set(0,0,7);hallLight.castShadow=true;hallLight.shadow.mapSize.set(1024,1024);hallLight.shadow.bias=-.00015;scene.add(hallLight,hallLight.target);
  const locations=[[-4.7,1.85,5.1],[4.6,1.85,5.1],[0,3.5,13],[0,3.5,23],[0,3.5,32],[-9.6,1.9,32.8],[-13,2,22],[10,3,21],[0,3,42]];
  const lights=Array.from({length:3},()=>{const l=new T.PointLight('#ffdbad',22,10,1.7);scene.add(l);return l;});
  const player={...spawn,pitch:0};
  input=new FirstPersonInput(canvas,ui,{interact:()=>callbacks.interact(target),pause:()=>callbacks.pause()});
  function resize(){const r=canvas.getBoundingClientRect(),cap=quality==='low'?1:quality==='high'?1.75:1.25;renderer.setPixelRatio(Math.min(devicePixelRatio||1,cap));renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();if(!playing)render(0);}
  function setQuality(value){quality=['low','balanced','high'].includes(value)?value:'balanced';renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=T.PCFSoftShadowMap;resize();}
  function render(dt){
   camera.position.set(player.x,1.65,player.z);camera.rotation.set(player.pitch,Math.PI+player.yaw,0);
   const sorted=locations.map(p=>({p,d:(p[0]-player.x)**2+(p[2]-player.z)**2})).sort((a,b)=>a.d-b.d);lights.forEach((l,i)=>{l.position.set(...sorted[i].p);l.intensity=quality==='low'&&i===2?0:22;});
   const forward=new T.Vector3();camera.getWorldDirection(forward);target=null;let nearest=2.3;
   for(const item of world.interactions){const pos=new T.Vector3(...item.position),direction=pos.sub(camera.position),distance=direction.length();if(distance<nearest&&direction.normalize().dot(forward)>.5){target=item;nearest=distance;}}
   callbacks.location(roomAt(player.x,player.z)?.name||'Doorway');callbacks.target(target);renderer.render(scene,camera);
   frames++;elapsed+=dt;if(elapsed>=1){callbacks.metrics({fps:Math.round(frames/elapsed),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality});frames=0;elapsed=0;}
  }
  function loop(now){if(disposed||!playing)return;const dt=Math.min(.04,(now-last)/1000);last=now;try{const v=input.axes(),look=input.consumeLook();player.yaw+=look.x;player.pitch=T.MathUtils.clamp(player.pitch-look.y,-1.2,1.2);const speed=input.keys.has('ShiftLeft')?3.6:2.4;const dx=(Math.sin(player.yaw)*v.z+Math.cos(player.yaw)*v.x)*speed*dt,dz=(Math.cos(player.yaw)*v.z-Math.sin(player.yaw)*v.x)*speed*dt;movePlayer(player,dx,dz,world.colliders);render(dt);raf=requestAnimationFrame(loop);}catch(e){playing=false;input.setActive(false);callbacks.failure(e);}}
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;input.setActive(false);cancelAnimationFrame(raf);callbacks.failure(new Error('Graphics connection interrupted. Reload the manor to recover.'));},{signal:abort.signal});
  observer=new ResizeObserver(resize);observer.observe(canvas);setQuality(quality);callbacks.progress(100,'The manor is ready');
  return {
   start(){if(disposed||playing)return;playing=true;input.setActive(true);last=performance.now();frames=elapsed=0;raf=requestAnimationFrame(loop);},
   pause(){playing=false;input.setActive(false);cancelAnimationFrame(raf);},
   restart(){Object.assign(player,spawn,{pitch:0});input.clear();render(0);},
   settings({quality:q,sensitivity,fov}){if(q)setQuality(q);if(sensitivity)input.sensitivity=sensitivity;if(fov){camera.fov=fov;camera.updateProjectionMatrix();}if(!playing)render(0);},
   inspect(){callbacks.interact(target);},
   diagnostics(){return {player:{...player},room:roomAt(player.x,player.z)?.id,quality,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},
   dispose(){if(disposed)return;disposed=true;playing=false;cancelAnimationFrame(raf);input.dispose();abort.abort();observer.disconnect();world.dispose();materials.dispose();renderer.dispose();scene.clear();}
  };
 }catch(error){disposed=true;input?.dispose();world?.dispose();materials?.dispose();observer?.disconnect();abort.abort();renderer.dispose();throw error;}
}
