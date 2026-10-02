import * as T from '../vendor/three.module.min.js';
import {makeMaterials} from './materials.js?v=manor-11';
import {buildWorld} from './world.js?v=manor-11';
import {FirstPersonInput} from './input.js?v=manor-11';
import {movePlayer,movementVector} from './collision.js?v=manor-11';
import {spawn,roomAt} from './layout.js?v=manor-11';
import {CompatibilityRenderer} from './compatibility.js?v=manor-11';
export async function createManor(canvas,ui,callbacks,options={}){
 const abort=new AbortController();let disposed=false,playing=false,raf=0,last=0,frames=0,elapsed=0,target=null;
 const scene=new T.Scene();scene.background=new T.Color('#16242b');scene.fog=new T.Fog('#19272b',22,75);
 const camera=new T.PerspectiveCamera(66,1,.08,100);camera.rotation.order='YXZ';
 let renderer,compatibility=false;try{renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});}catch{renderer=new CompatibilityRenderer(canvas);compatibility=true;callbacks.mode?.('Compatibility preview · WebGL2 unavailable');}renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 const mobile=matchMedia('(pointer:coarse)').matches;let quality=mobile?'low':'balanced';
 let materials,world,input,observer,environmentTarget;
 try{
  callbacks.progress(10,'Preparing the renderer');
  materials=await makeMaterials(f=>callbacks.progress(10+f*55,'Loading mansion materials'));
  callbacks.progress(70,'Building the mansion');world=(options.buildWorld||buildWorld)(materials.m);scene.add(world.root);
  const ambient=new T.HemisphereLight('#dcc7a6','#483528',.48);scene.add(ambient);
  const moon=new T.DirectionalLight('#9ebfda',.08);moon.position.set(9,16,51);scene.add(moon);
  const hallLight=new T.SpotLight('#ffdbad',32,20,.85,.5,1.6);hallLight.position.set(0,3.8,8);hallLight.target.position.set(0,0,10);hallLight.castShadow=true;hallLight.shadow.mapSize.set(1024,1024);hallLight.shadow.bias=-.00015;scene.add(hallLight,hallLight.target);
  const locations=[[-1.92,1.85,10.35],[1.92,1.85,10.35],[0,3.5,13],[0,3.5,23],[0,3.5,32],[-9.6,1.9,32.8],[-13,2,22],[10,3,21],[0,3,42]];
  const lights=Array.from({length:3},()=>{const l=new T.PointLight('#ffdbad',10,10,1.7);scene.add(l);return l;});
  // Fixed low-energy gallery pools keep the vista lit while nearby lamps are selected.
  const galleryLights=[16,24,32,42].map(z=>{const l=new T.PointLight(z===42?'#7faac7':'#ffd29b',9,9,1.8);l.position.set(0,2.9,z);scene.add(l);return l;});
  const startingPoint=options.spawn||spawn,resolveRoom=options.roomAt||roomAt;const player={...startingPoint,pitch:0};let lastRoom='';
  input=new FirstPersonInput(canvas,ui,{interact:()=>callbacks.interact(target),pause:()=>callbacks.pause()});
  function resize(){const r=canvas.getBoundingClientRect(),cap=quality==='low'?1:quality==='high'?1.75:1.25;renderer.setPixelRatio(Math.min(devicePixelRatio||1,cap));renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();if(!playing)render(0);}
  function setQuality(value){quality=['low','balanced','high'].includes(value)?value:'balanced';galleryLights.forEach(l=>l.visible=quality!=='low');renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=T.PCFSoftShadowMap;resize();}
  function render(dt){
   camera.position.set(player.x,1.65,player.z);camera.rotation.set(player.pitch,Math.PI+player.yaw,0);
   const sorted=locations.map(p=>({p,d:(p[0]-player.x)**2+(p[2]-player.z)**2})).sort((a,b)=>a.d-b.d);lights.forEach((l,i)=>{l.position.set(...sorted[i].p);l.intensity=quality==='low'&&i===2?0:10;});
   const forward=new T.Vector3();camera.getWorldDirection(forward);target=null;let nearest=2.3;
   for(const item of world.interactions){const pos=new T.Vector3(...item.position),direction=pos.sub(camera.position),distance=direction.length();if(distance<nearest&&direction.normalize().dot(forward)>.5){target=item;nearest=distance;}}
   const room=resolveRoom(player.x,player.z);moon.intensity=room?.id==='garden'||room?.id==='conserv'?1.1:.08;callbacks.location(room?.name||'Doorway');if(room?.id!==lastRoom){lastRoom=room?.id;callbacks.room?.({id:room?.id||null,name:room?.name||'Doorway'});}callbacks.target(target);renderer.render(scene,camera);
   frames++;elapsed+=dt;if(elapsed>=1){callbacks.metrics({fps:Math.round(frames/elapsed),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality,renderer:compatibility?'software preview':'WebGL2'});frames=0;elapsed=0;}
  }
  function loop(now){if(disposed||!playing)return;const actualDt=(now-last)/1000,dt=Math.min(.04,actualDt);last=now;try{const v=input.axes(),look=input.consumeLook();player.yaw-=look.x;player.pitch=T.MathUtils.clamp(player.pitch-look.y,-1.2,1.2);const speed=input.keys.has('ShiftLeft')?3.6:2.4;const {dx,dz}=movementVector(player.yaw,v.x,v.z,speed*dt);movePlayer(player,dx,dz,world.colliders);render(actualDt);raf=requestAnimationFrame(loop);}catch(e){playing=false;input.setActive(false);callbacks.failure(e);}}
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;input.setActive(false);cancelAnimationFrame(raf);callbacks.failure(new Error('Graphics connection interrupted. Reload the manor to recover.'));},{signal:abort.signal});
  observer=new ResizeObserver(resize);observer.observe(canvas);setQuality(quality);
  if(!compatibility){callbacks.progress(90,'Preparing the room reflections');environmentTarget=new T.WebGLCubeRenderTarget(quality==='low'?64:128,{type:T.UnsignedByteType,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});const capture=new T.CubeCamera(.1,60,environmentTarget);capture.position.set(0,1.8,6);renderer.shadowMap.autoUpdate=false;capture.update(renderer,scene);renderer.shadowMap.autoUpdate=true;scene.environment=environmentTarget.texture;scene.environmentIntensity=.22;render(0);}
  callbacks.progress(100,'The manor is ready');
  return {
   start(){if(disposed||playing)return;playing=true;input.setActive(true);last=performance.now();frames=elapsed=0;raf=requestAnimationFrame(loop);},
   pause(){playing=false;input.setActive(false);cancelAnimationFrame(raf);},
   restart(){Object.assign(player,startingPoint,{pitch:0});input.clear();render(0);},
   setInteractions(items){if(!Array.isArray(items)||items.length>500)throw new Error('Supply up to 500 interaction anchors');const seen=new Set();for(const i of items){if(!i||typeof i.id!=='string'||seen.has(i.id)||!Array.isArray(i.position)||i.position.length!==3||i.position.some(v=>!Number.isFinite(v)))throw new Error('Interaction IDs and world positions must be valid');seen.add(i.id);}world.interactions=structuredClone(items);target=null;if(!playing)render(0);},
   settings({quality:q,sensitivity,fov}){if(q)setQuality(q);if(sensitivity)input.sensitivity=sensitivity;if(fov){camera.fov=fov;camera.updateProjectionMatrix();}if(!playing)render(0);},
   inspect(){callbacks.interact(target);},
   diagnostics(){return {player:{...player},room:resolveRoom(player.x,player.z)?.id,quality,renderer:compatibility?'software preview':'WebGL2',drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},
   dispose(){if(disposed)return;disposed=true;playing=false;cancelAnimationFrame(raf);input.dispose();abort.abort();observer.disconnect();world.dispose();materials.dispose();environmentTarget?.dispose();renderer.dispose();scene.clear();}
  };
 }catch(error){disposed=true;input?.dispose();world?.dispose();materials?.dispose();environmentTarget?.dispose();observer?.disconnect();abort.abort();renderer.dispose();throw error;}
}
