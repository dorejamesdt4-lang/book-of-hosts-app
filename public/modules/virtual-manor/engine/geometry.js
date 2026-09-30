import * as T from '../vendor/three.module.min.js';
// Merge static pieces by material: no per-trim mesh/draw call in the runtime.
export class Architecture {
 constructor(){this.parts=new Map();this.colliders=[];this.resources=[];}
 add(geometry,material,x,y,z,ry=0){const m=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(0,ry,0)),new T.Vector3(1,1,1));geometry.applyMatrix4(m);if(!this.parts.has(material))this.parts.set(material,[]);this.parts.get(material).push(geometry);}
 box(w,h,d,x,y,z,mat,ry=0){this.add(new T.BoxGeometry(w,h,d),mat,x,y,z,ry);}
 cylinder(rt,rb,h,x,y,z,mat,n=12){this.add(new T.CylinderGeometry(rt,rb,h,n),mat,x,y,z);}
 sphere(r,x,y,z,mat,sx=1,sy=1,sz=1){const g=new T.SphereGeometry(r,12,8);g.scale(sx,sy,sz);this.add(g,mat,x,y,z);}
 obstacle(x,z,w,d){this.colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});}
 finish(){const root=new T.Group();
  for(const [material,parts] of this.parts){let vc=0,ic=0;for(const g of parts){vc+=g.attributes.position.count;ic+=g.index.count;}
   const attrs={position:new Float32Array(vc*3),normal:new Float32Array(vc*3),uv:new Float32Array(vc*2)},index=new Uint32Array(ic);let vo=0,io=0;
   for(const g of parts){for(const key of Object.keys(attrs))attrs[key].set(g.attributes[key].array,vo*g.attributes[key].itemSize);for(let i=0;i<g.index.count;i++)index[io+i]=g.index.array[i]+vo;vo+=g.attributes.position.count;io+=g.index.count;g.dispose();}
   const g=new T.BufferGeometry();for(const key of Object.keys(attrs))g.setAttribute(key,new T.BufferAttribute(attrs[key],key==='uv'?2:3));g.setIndex(new T.BufferAttribute(index,1));g.computeBoundingSphere();
   const mesh=new T.Mesh(g,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;root.add(mesh);this.resources.push(g);
  }this.parts.clear();return root;
 }
 dispose(){for(const g of this.resources)g.dispose();this.resources=[];}
}
