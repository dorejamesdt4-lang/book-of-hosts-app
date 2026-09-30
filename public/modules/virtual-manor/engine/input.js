export class FirstPersonInput {
 constructor(canvas,ui,{interact,pause}){
  this.canvas=canvas;this.keys=new Set();this.look={x:0,y:0};this.stick={x:0,y:0};this.sensitivity=1;this.active=false;this.abort=new AbortController();const opts={signal:this.abort.signal};
  const key=(e,down)=>{if(!this.active||e.target.matches('input,select,textarea'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(down)this.keys.add(e.code);else this.keys.delete(e.code);if(down&&!e.repeat&&e.code==='KeyE')interact();if(down&&!e.repeat&&e.code==='Escape')pause();};
  window.addEventListener('keydown',e=>key(e,true),opts);window.addEventListener('keyup',e=>key(e,false),opts);window.addEventListener('blur',()=>{this.clear();if(this.active)pause();},opts);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();if(this.active)pause();}},opts);
  document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&this.active&&!this.touching)pause();},opts);
  canvas.addEventListener('click',()=>{if(this.active&&!matchMedia('(pointer:coarse)').matches)canvas.requestPointerLock?.()?.catch?.(()=>{});},opts);
  document.addEventListener('mousemove',e=>{if(this.active&&document.pointerLockElement===canvas){this.look.x+=e.movementX*.002*this.sensitivity;this.look.y+=e.movementY*.002*this.sensitivity;}},opts);
  let moveId=null,lookId=null,startX=0,startY=0,lastX=0,lastY=0;
  const capture=(el,e)=>{el.setPointerCapture(e.pointerId);e.preventDefault();this.touching=true;};
  ui.stick.addEventListener('pointerdown',e=>{if(!this.active||moveId!==null)return;moveId=e.pointerId;const r=ui.stick.getBoundingClientRect();startX=r.x+r.width/2;startY=r.y+r.height/2;capture(ui.stick,e);},opts);
  ui.stick.addEventListener('pointermove',e=>{if(!this.active||e.pointerId!==moveId)return;const x=e.clientX-startX,y=e.clientY-startY,l=Math.max(1,Math.hypot(x,y)/42);this.stick={x:x/l/42,y:y/l/42};ui.knob.style.transform=`translate(${x/l}px,${y/l}px)`;},opts);
  const endMove=e=>{if(e.pointerId===moveId){moveId=null;this.stick={x:0,y:0};ui.knob.style.transform='';}};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])ui.stick.addEventListener(event,endMove,opts);
  ui.look.addEventListener('pointerdown',e=>{if(!this.active||lookId!==null)return;lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;capture(ui.look,e);},opts);
  ui.look.addEventListener('pointermove',e=>{if(!this.active||e.pointerId!==lookId)return;this.look.x+=(e.clientX-lastX)*.004*this.sensitivity;this.look.y+=(e.clientY-lastY)*.004*this.sensitivity;lastX=e.clientX;lastY=e.clientY;},opts);
  const endLook=e=>{if(e.pointerId===lookId)lookId=null;};for(const event of ['pointerup','pointercancel','lostpointercapture'])ui.look.addEventListener(event,endLook,opts);
  this.clearTouch=()=>{moveId=lookId=null;ui.knob.style.transform='';};
 }
 axes(){let x=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))+this.stick.x;let z=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-this.stick.y;const l=Math.max(1,Math.hypot(x,z));return {x:x/l,z:z/l};}
 consumeLook(){const v={...this.look};this.look.x=this.look.y=0;return v;}
 clear(){this.keys.clear();this.stick={x:0,y:0};this.look={x:0,y:0};this.clearTouch?.();}
 setActive(active){this.active=active;this.clear();if(!active&&document.pointerLockElement===this.canvas)document.exitPointerLock?.();}
 dispose(){this.setActive(false);this.abort.abort();}
}
