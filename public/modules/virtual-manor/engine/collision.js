export const radius=.24;
export function circleHits(x,z,r,box){const qx=Math.max(box.x0,Math.min(x,box.x1)),qz=Math.max(box.z0,Math.min(z,box.z1));return (x-qx)**2+(z-qz)**2<r*r;}
export function movePlayer(player,dx,dz,boxes){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));dx/=steps;dz/=steps;
 for(let i=0;i<steps;i++){
  const x=player.x+dx;if(!boxes.some(b=>circleHits(x,player.z,radius,b)))player.x=x;
  const z=player.z+dz;if(!boxes.some(b=>circleHits(player.x,z,radius,b)))player.z=z;
 }
 return player;
}
