import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp' : 'sharp');
const base=new URL('../',import.meta.url).href;
const T=await import(base+'public/modules/virtual-manor/vendor/three.module.min.js');
const {makeMaterials}=await import(base+'public/modules/virtual-manor/engine/materials.js');
const {buildWorld}=await import(base+'public/modules/virtual-manor/engine/world.js');
const {CompatibilityRenderer}=await import(base+'public/modules/virtual-manor/engine/compatibility.js');
// Only the Canvas texture sampler is supplied here; the software rasterizer and
// actual world/material modules are used unchanged. No WebGL lighting is claimed.
class Canvas{
 width=256;height=256;data=null;
 getContext(){const c=this;let transform=[1,0,0,1,0,0];const stack=[];return {save(){stack.push([...transform]);},restore(){transform=stack.pop()||[1,0,0,1,0,0];},translate(x,y){const [a,b,d,e,f,g]=transform;transform=[a,b,d,e,f+a*x+d*y,g+b*x+e*y];},rotate(angle){const [a,b,d,e,f,g]=transform,cs=Math.cos(angle),sn=Math.sin(angle);transform=[a*cs+d*sn,b*cs+e*sn,d*cs-a*sn,e*cs-b*sn,f,g];},strokeRect(){},setTransform(...values){transform=values;},clearRect(){},fillRect(){},createRadialGradient(){return {addColorStop(){}};},
 drawImage(img,...args){let sx=0,sy=0,sw=img.width,sh=img.height,dx,dy,dw,dh;if(args.length===4)[dx,dy,dw,dh]=args;else [sx,sy,sw,sh,dx,dy,dw,dh]=args;
 const [a,b,d,e,f,g]=transform,det=a*e-b*d,corners=[[dx,dy],[dx+dw,dy],[dx,dy+dh],[dx+dw,dy+dh]].map(([x,y])=>[a*x+d*y+f,b*x+e*y+g]);
 c.data??=new Uint8ClampedArray(c.width*c.height*4);for(let y=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[1]))));y<Math.min(c.height,Math.ceil(Math.max(...corners.map(p=>p[1]))));y++)for(let x=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[0]))));x<Math.min(c.width,Math.ceil(Math.max(...corners.map(p=>p[0]))));x++){
 const px=x+.5-f,py=y+.5-g,lx=(e*px-d*py)/det,ly=(-b*px+a*py)/det;if(lx<dx||lx>=dx+dw||ly<dy||ly>=dy+dh)continue;
 const ix=Math.min(img.width-1,Math.max(0,Math.floor(sx+(lx-dx)*sw/dw))),iy=Math.min(img.height-1,Math.max(0,Math.floor(sy+(ly-dy)*sh/dh))),from=(iy*img.width+ix)*4,to=(y*c.width+x)*4;c.data.set(img.data.subarray(from,from+4),to);}},
 getImageData(){return {data:c.data||new Uint8ClampedArray(c.width*c.height*4)};},putImageData(d){c.data=d.data;},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};}};}
}
globalThis.document={createElement(){return new Canvas();}};
T.TextureLoader.prototype.loadAsync=async function(url){const {data,info}=await sharp(new URL(url).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});return new T.Texture({width:info.width,height:info.height,data});};
const materials=await makeMaterials(),world=buildWorld(materials.m),scene=new T.Scene();scene.add(world.root);
// Contact gradients and stroked parquet seams still require browser Canvas.
// Hide contact decals; the sampler supports the rotated wood texture itself.
world.root.children.find(m=>m.material===materials.m.contact).visible=false;
const polish=process.argv.includes('--polish');
const views=polish?[
 {name:'hall',position:[-.6,1.8,7.2],target:[-3.1,1.1,10.3],label:'Hall / shield-back chair and folded foliage'},
 {name:'drawing',position:[-6,1.7,18.4],target:[-10.5,.9,23.4],label:'Drawing room / upholstered seating'},
 {name:'dining',position:[3.2,1.8,17.1],target:[9,1,21],label:'Dining room / seating and table details'},
 {name:'conservatory',position:[0,1.8,39.7],target:[3.6,1.5,44.8],label:'Conservatory / ferns, ironwork and potting bench'},
 {name:'foliage',position:[4.5,1.7,43],target:[6,1.05,45.7],label:'Conservatory / folded fern fronds and potting details'}
]:[
 {name:'hall-floor',position:[0,2.8,6],target:[0,0,11.5],label:'Hall / gallery floor continuity'},
 {name:'drawing-door',position:[1.25,1.65,23],target:[-2,1.75,19.8],label:'Drawing-room doorway / pictures'},
 {name:'library-door',position:[1.25,1.65,33.5],target:[-2,1.8,30],label:'Library doorway / pictures'},
 {name:'dining-door',position:[-1.25,1.65,23],target:[2,1.75,19.8],label:'Dining-room doorway / pictures'}
];
for(const v of views){const canvas=new Canvas(),renderer=new CompatibilityRenderer(canvas);renderer.setSize(1600,1000);const camera=new T.PerspectiveCamera(66,1.6,.08,100);camera.position.set(...v.position);camera.lookAt(new T.Vector3(...v.target));renderer.render(scene,camera);
 const label=Buffer.from(`<svg width="800" height="58"><rect width="800" height="58" fill="#10241f"/><text x="16" y="23" fill="#e9cd88" font-size="17">${v.label}</text><text x="16" y="45" fill="white" font-size="13">Actual meshes + selected textures | Software diagnostic: no WebGL lighting</text></svg>`);
 await sharp(Buffer.from(canvas.data),{raw:{width:800,height:500,channels:4}}).extend({top:58,bottom:0,left:0,right:0,background:'#10241f'}).composite([{input:label,top:0,left:0}]).jpeg({quality:90}).toFile(new URL('docs/visuals/'+(polish?'astra-polish-':'pr2-')+v.name+'.jpg',base).pathname);console.log(v.name,renderer.info.render);renderer.dispose();}
console.log('Full world',world.root.children.length,'material meshes',world.root.children.reduce((total,mesh)=>total+mesh.geometry.index.count/3,0),'triangles');
world.dispose();materials.dispose();
