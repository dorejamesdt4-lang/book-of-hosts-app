// Software preview of the same meshes for environments without WebGL2.
// This does not certify the preferred GPU renderer or phone performance.
import * as T from '../vendor/three.module.min.js';
export class CompatibilityRenderer {
 constructor(canvas){this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:false});if(!this.context)throw new Error('Neither WebGL2 nor compatibility rendering is available.');this.info={render:{calls:0,triangles:0}};this.shadowMap={};this.textures=new Map();}
 setPixelRatio(){}
 setSize(w,h){this.canvas.width=Math.floor(w*.5);this.canvas.height=Math.floor(h*.5);this.frame=this.context.createImageData(this.canvas.width,this.canvas.height);this.depth=new Float32Array(this.canvas.width*this.canvas.height);}
 render(scene,camera){
  const ctx=this.context,w=this.canvas.width,h=this.canvas.height;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#17252b';ctx.fillRect(0,0,w,h);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),faces=[],eye=camera.position;let calls=0;
  scene.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.visible)return;const g=mesh.geometry,p=g.attributes.position,uv=g.attributes.uv,idx=g.index,m=mesh.material,mat=new T.Matrix4().multiplyMatrices(vp,mesh.matrixWorld),array=p.array,localEye=eye.clone().applyMatrix4(mesh.matrixWorld.clone().invert()),projected=new Float32Array(p.count*4);
   for(let i=0;i<p.count;i++){const off=i*3,x=array[off],y=array[off+1],z=array[off+2],e=mat.elements;projected[i*4]=e[0]*x+e[4]*y+e[8]*z+e[12];projected[i*4+1]=e[1]*x+e[5]*y+e[9]*z+e[13];projected[i*4+2]=e[2]*x+e[6]*y+e[10]*z+e[14];projected[i*4+3]=e[3]*x+e[7]*y+e[11]*z+e[15];}
   for(let i=0;i<idx.count;i+=3){const ids=[idx.array[i],idx.array[i+1],idx.array[i+2]];let v=ids.map(id=>({x:projected[id*4],y:projected[id*4+1],z:projected[id*4+2],q:projected[id*4+3],u:uv?.array[id*2]||0,t:uv?.array[id*2+1]||0}));if(v.every(t=>t.q<.08))continue;
    if(v.some(t=>t.q<.08)){const clipped=[];for(let k=0;k<3;k++){const a=v[k],b=v[(k+1)%3],inside=a.q>=.08;if(inside)clipped.push(a);if(inside!==(b.q>=.08)){const f=(.08-a.q)/(b.q-a.q),n={};for(const key of ['x','y','z','q','u','t'])n[key]=a[key]+(b[key]-a[key])*f;clipped.push(n);}}v=clipped;}
    if(v.length<3)continue;v=v.map(t=>({...t,x:t.x/t.q,y:t.y/t.q,z:t.z/t.q}));if(v.every(t=>t.z>1)||['x','y'].some(axis=>v.every(t=>t[axis]<-1.1)||v.every(t=>t[axis]>1.1)))continue;
    const [ia,ib,ic]=ids.map(id=>id*3),ax=array[ia],ay=array[ia+1],az=array[ia+2],bx=array[ib]-ax,by=array[ib+1]-ay,bz=array[ib+2]-az,cx=array[ic]-ax,cy=array[ic+1]-ay,cz=array[ic+2]-az,nx=by*cz-bz*cy,ny=bz*cx-bx*cz,nz=bx*cy-by*cx;
    if(m.side!==T.DoubleSide&&((nx*(localEye.x-ax)+ny*(localEye.y-ay)+nz*(localEye.z-az)<=0)!==(m.side===T.BackSide)))continue;
    const distance=v.reduce((s,t)=>s+t.q,0)/v.length;if(distance>28)continue;const nl=Math.hypot(nx,ny,nz)||1,shade=Math.min(1,.67+.25*Math.max(0,(nx*.25+ny*.8+nz*.35)/nl));
    const screen=v.map(t=>({x:(t.x*.5+.5)*w,y:(-.5*t.y+.5)*h,u:t.u,t:t.t,q:t.q}));for(let k=1;k<screen.length-1;k++){const tri=[screen[0],screen[k],screen[k+1]],area=Math.abs((tri[1].x-tri[0].x)*(tri[2].y-tri[0].y)-(tri[1].y-tri[0].y)*(tri[2].x-tri[0].x));if(area<3)continue;faces.push({v:tri,uv,m,distance,shade});}
   }calls++;
  });faces.sort((a,b)=>b.distance-a.distance);
  const pixels=this.frame.data,depth=this.depth;depth.fill(Infinity);for(let i=0;i<pixels.length;i+=4){pixels[i]=23;pixels[i+1]=37;pixels[i+2]=43;pixels[i+3]=255;}
  // A depth buffer prevents the intersecting-wall artefacts of painter sorting.
  const ordered=[...faces.filter(f=>!f.m.transparent).reverse(),...faces.filter(f=>f.m.transparent)];
  for(const f of ordered){
   const [a,b,c]=f.v,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<.001)continue;
   const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
   const image=f.m.map?.image;let texture=null;if(image&&f.uv){if(!this.textures.has(image)){const sample=document.createElement('canvas');sample.width=sample.height=256;const sc=sample.getContext('2d');sc.drawImage(image,0,0,256,256);this.textures.set(image,sc.getImageData(0,0,256,256).data);}texture=this.textures.get(image);}
   const color=f.m.color.clone().convertLinearToSRGB(),shade=f.m.emissiveIntensity>1?1:f.shade,alpha=f.m.transparent?f.m.opacity:1;
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const w0=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den,w1=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den,w2=1-w0-w1;if(w0<0||w1<0||w2<0)continue;
    const inv=w0/a.q+w1/b.q+w2/c.q,z=1/inv,at=y*w+x;if(z>=depth[at])continue;
    let r=255,g=255,blue=255;if(texture){const u=(w0*a.u/a.q+w1*b.u/b.q+w2*c.u/c.q)/inv,t=(w0*a.t/a.q+w1*b.t/b.q+w2*c.t/c.q)/inv,tx=Math.min(255,Math.floor((u-Math.floor(u))*256)),ty=Math.min(255,Math.floor((1-t-Math.floor(1-t))*256)),off=(ty*256+tx)*4;r=texture[off];g=texture[off+1];blue=texture[off+2];}
    const off=at*4;pixels[off]=pixels[off]*(1-alpha)+r*color.r*shade*alpha;pixels[off+1]=pixels[off+1]*(1-alpha)+g*color.g*shade*alpha;pixels[off+2]=pixels[off+2]*(1-alpha)+blue*color.b*shade*alpha;if(!f.m.transparent)depth[at]=z;
   }
  }
  ctx.putImageData(this.frame,0,0);this.info.render={calls,triangles:faces.length};
 }
 dispose(){this.textures.clear();this.frame=null;this.depth=null;this.context.clearRect(0,0,this.canvas.width,this.canvas.height);}
}
