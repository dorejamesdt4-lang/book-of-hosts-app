const $=id=>document.getElementById(id),ui={stick:$('stick'),knob:$('knob'),look:$('look-zone')};let engine,started=false;
document.body.classList.add('paused');
function dismiss(){for(const id of ['welcome','menu','object','error'])$(id).close();}
function open(id){dismiss();$(id).showModal();}
function pause(){if(!started||!engine)return;engine.pause();document.body.classList.add('paused');open('menu');}
function resume(){dismiss();document.body.classList.remove('paused');started=true;engine.start();}
function failure(error){engine?.pause();document.body.classList.add('paused');$('error-text').textContent=error?.message||'The graphics could not load. Try reloading this standalone world.';open('error');}
const callbacks={
 mode(text){$('render-mode').hidden=false;$('render-mode').textContent=text;},
 progress(value,text){$('loading').value=value;$('status').textContent=text;},pause,failure,
 location(name){$('room').textContent=name;},
 target(item){$('inspect').hidden=!item;$('inspect').textContent=item?.name||'Inspect';},
 interact(item){if(!item)return;engine.pause();document.body.classList.add('paused');$('object-title').textContent=item.title;$('object-text').textContent=item.text;$('object-link').hidden=!item.href;if(item.href){$('object-link').href=item.href;$('object-link').textContent='Open Theatre';}open('object');},
 metrics(data){$('metrics').textContent=`${data.fps} fps in this browser · ${data.drawCalls} draw calls · ${data.triangles.toLocaleString()} triangles · ${data.quality} · ${data.renderer}. These are current browser measurements, not a phone benchmark.`;}
};
try{
 const {createManor}=await import('./engine/runtime.js?v=manor-8');engine=await createManor($('scene'),ui,callbacks);$('enter').disabled=false;
 $('quality').value=engine.diagnostics().quality;
 let settings;try{settings=JSON.parse(localStorage.getItem('boh.manor.settings'));}catch{}if(settings){for(const id of ['quality','sensitivity','fov'])if(settings[id]!=null)$(id).value=settings[id];engine.settings({quality:$('quality').value,sensitivity:Number($('sensitivity').value),fov:Number($('fov').value)});}
 // Diagnostic output is explicitly opt-in and contains no secrets or game answers.
 if(new URLSearchParams(location.search).has('debug'))window.manorDiagnostics=()=>engine.diagnostics();
}catch(error){failure(error);}
$('enter').onclick=resume;$('resume').onclick=resume;$('pause').onclick=pause;$('close-object').onclick=resume;
$('inspect').onclick=()=>engine?.inspect();$('restart').onclick=()=>{engine?.restart();resume();};$('retry').onclick=()=>location.reload();
for(const id of ['quality','sensitivity','fov'])$(id).addEventListener('change',()=>{const settings={quality:$('quality').value,sensitivity:Number($('sensitivity').value),fov:Number($('fov').value)};engine?.settings(settings);try{localStorage.setItem('boh.manor.settings',JSON.stringify(settings));}catch{}});
for(const id of ['menu','object'])$(id).addEventListener('cancel',e=>{e.preventDefault();resume();});for(const id of ['welcome','error'])$(id).addEventListener('cancel',e=>e.preventDefault());
window.addEventListener('pagehide',()=>engine?.dispose());
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});

$('touch-mode').onchange=()=>document.body.classList.toggle('touch-mode',$('touch-mode').checked);
