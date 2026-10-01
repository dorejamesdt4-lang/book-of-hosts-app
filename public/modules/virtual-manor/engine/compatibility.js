// Software preview of the same meshes for environments without WebGL2.
// This does not certify the preferred GPU renderer or phone performance.
import * as T from '../vendor/three.module.min.js';
export class CompatibilityRenderer {
 constructor(canvas){this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:false});if(!this.context)throw new Error('Neither WebGL2 nor compatibility rendering is available.');this.info={render:{calls:0,triangles:0}};this.shadowMap={};}
 setPixelRatio(){}
 setSize(w,h){this.canvas.width=Math.floor(w*.7);this.canvas.height=Math.floor(h*.7);}
 render(scene,camera){
  const ctx=this.context,w=this.canvas.width,h=this.canvas.height;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#17252b';ctx.fillRect(0,0,w,h);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),faces=[],eye=camera.position;let calls=0;
  scene.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.visible)return;const g=mesh.geometry,p=g.attributes.position,uv=g.attributes.uv,idx=g.index,m=mesh.material,mat=new T.Matrix4().multiplyMatrices(vp,mesh.matrixWorld),array=p.array,projected=new Float32Array(p.count*4);
   for(let i=0;i<p.count;i++){const off=i*3,x=array[off],y=array[off+1],z=array[off+2],e=mat.elements;projected[i*4]=e[0]*x+e[4]*y+e[8]*z+e[12];projected[i*4+1]=e[1]*x+e[5]*y+e[9]*z+e[13];projected[i*4+2]=e[2]*x+e[6]*y+e[10]*z+e[14];projected[i*4+3]=e[3]*x+e[7]*y+e[11]*z+e[15];}
   for(let i=0;i<idx.count;i+=3){const ids=[idx.array[i],idx.array[i+1],idx.array[i+2]];let v=ids.map(id=>({x:projected[id*4],y:projected[id*4+1],z:projected[id*4+2],q:projected[id*4+3],u:uv?.array[id*2]||0,t:uv?.array[id*2+1]||0}));if(v.every(t=>t.q<.08))continue;
    if(v.some(t=>t.q<.08)){const clipped=[];for(let k=0;k<3;k++){const a=v[k],b=v[(k+1)%3],inside=a.q>=.08;if(inside)clipped.push(a);if(inside!==(b.q>=.08)){const f=(.08-a.q)/(b.q-a.q),n={};for(const key of ['x','y','z','q','u','t'])n[key]=a[key]+(b[key]-a[key])*f;clipped.push(n);}}v=clipped;}
    if(v.length<3)continue;v=v.map(t=>({...t,x:t.x/t.q,y:t.y/t.q,z:t.z/t.q}));if(v.every(t=>t.z>1)||['x','y'].some(axis=>v.every(t=>t[axis]<-1.1)||v.every(t=>t[axis]>1.1)))continue;
    const [ia,ib,ic]=ids.map(id=>id*3),ax=array[ia],ay=array[ia+1],az=array[ia+2],bx=array[ib]-ax,by=array[ib+1]-ay,bz=array[ib+2]-az,cx=array[ic]-ax,cy=array[ic+1]-ay,cz=array[ic+2]-az,nx=by*cz-bz*cy,ny=bz*cx-bx*cz,nz=bx*cy-by*cx;
    if(nx*(eye.x-ax)+ny*(eye.y-ay)+nz*(eye.z-az)<=0)continue;
    const distance=v.reduce((s,t)=>s+t.q,0)/v.length;if(distance>28)continue;const nl=Math.hypot(nx,ny,nz)||1,shade=Math.min(1,.67+.25*Math.max(0,(nx*.25+ny*.8+nz*.35)/nl));
    const screen=v.map(t=>({x:(t.x*.5+.5)*w,y:(-.5*t.y+.5)*h,u:t.u,t:t.t}));for(let k=1;k<screen.length-1;k++){const tri=[screen[0],screen[k],screen[k+1]],area=Math.abs((tri[1].x-tri[0].x)*(tri[2].y-tri[0].y)-(tri[1].y-tri[0].y)*(tri[2].x-tri[0].x));if(area<5)continue;faces.push({v:tri,uv,m,distance,shade});}
   }calls++;
  });faces.sort((a,b)=>b.distance-a.distance);
  for(const f of faces){const [a,b,c]=f.v;ctx.setTransform(1,0,0,1,0,0);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();const image=f.m.map?.image;
   if(image&&f.uv){const [u,v,t]=f.v.map(p=>({x:p.u*image.width,y:(1-p.t)*image.height})),det=(v.x-u.x)*(t.y-u.y)-(t.x-u.x)*(v.y-u.y);
    if(Math.abs(det)>.001){const A=((b.x-a.x)*(t.y-u.y)-(c.x-a.x)*(v.y-u.y))/det,B=((b.y-a.y)*(t.y-u.y)-(c.y-a.y)*(v.y-u.y))/det,C=((c.x-a.x)*(v.x-u.x)-(b.x-a.x)*(t.x-u.x))/det,D=((c.y-a.y)*(v.x-u.x)-(b.y-a.y)*(t.x-u.x))/det;ctx.save();ctx.clip();ctx.setTransform(A,B,C,D,a.x-A*u.x-C*u.y,a.y-B*u.x-D*u.y);ctx.drawImage(image,0,0);ctx.restore();ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle=f.m.color.getStyle();ctx.fill();ctx.restore();ctx.fillStyle=`rgba(0,0,0,${1-f.shade})`;ctx.fill();}
   }else{ctx.fillStyle=f.m.emissiveIntensity>1?'#ffe2a8':f.m.color.getStyle();ctx.globalAlpha=f.m.transparent?f.m.opacity:1;ctx.fill();ctx.globalAlpha=1;if(!f.m.transparent){ctx.fillStyle=`rgba(0,0,0,${1-f.shade})`;ctx.fill();}}
  }this.info.render={calls,triangles:faces.length};
 }
 dispose(){this.context.clearRect(0,0,this.canvas.width,this.canvas.height);}
}
