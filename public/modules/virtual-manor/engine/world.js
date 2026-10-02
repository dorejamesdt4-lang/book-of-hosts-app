import * as T from '../vendor/three.module.min.js';
import {rooms,portals,wallSegments} from './layout.js?v=manor-11';
import {Architecture} from './geometry.js?v=manor-11';
import {makeProps} from './props.js?v=manor-11';
export function buildWorld(m){
 const a=new Architecture(),p=makeProps(a,m),interactions=[];
 const b=(w,h,d,x,y,z,mat=m.wood,ry=0)=>a.box(w,h,d,x,y,z,mat,ry);
 for(const room of rooms){
  const [x0,z0,x1,z1]=room.bounds,w=x1-x0,d=z1-z0,x=(x0+x1)/2,z=(z0+z1)/2;
  if(room.id==='hall'||room.id==='gallery')a.floor(w,d,x,z,m.stoneFloor,3,.002,true);
  else if(room.floor==='wood')a.floor(w,d,x,z,m.parquet,2.4,.002);
  else a.floor(w,d,x,z,room.floor==='tile'?m.tile:m.grass,room.floor==='tile'?2:0,.002);
  if(room.id!=='garden'){
   b(w,.12,d,x,4.24,z,room.id==='conserv'?m.glass:m.plaster);
   if(room.id==='hall'||room.id==='gallery'){
    if(room.id==='gallery')a.floor(2.15,d-1,x,z,m.rug);
    for(let zz=z0+1;zz<z1;zz+=2.7){b(w-.15,.1,.14,x,4.12,zz,m.wood);b(w-.2,.035,.24,x,4.17,zz,m.plaster);}
    if(room.id==='gallery')for(const side of [-1,1]){b(.14,.12,d,side*1.58,4.1,z,m.plaster);b(.055,.055,d,side*1.47,4.07,z,m.wood);}
   }
  }
  for(const s of wallSegments(room)){
   const l=s.max-s.min,c=(s.max+s.min)/2,ry=s.axis==='x'?Math.PI/2:0,xx=s.axis==='x'?s.at:c,zz=s.axis==='x'?c:s.at;
   const local=(lx,ly,lz,ww,hh,dd,mat)=>b(ww,hh,dd,xx+lx*Math.cos(ry)+lz*Math.sin(ry),ly,zz-lx*Math.sin(ry)+lz*Math.cos(ry),mat,ry);
   const glass=room.id==='conserv',garden=room.id==='garden';
   local(0,garden?1:2.1,0,l,garden?2:4.2,.24,garden?m.leaf:glass?m.glass:m.plaster);
   const wb=s.axis==='x'?{x0:s.at-.12,x1:s.at+.12,z0:s.min,z1:s.max}:{x0:s.min,x1:s.max,z0:s.at-.12,z1:s.at+.12};a.colliders.push(wb);
   if(garden)continue;
   if(glass){for(let t=-l/2;t<=l/2;t+=1.4)local(t,2.1,0,.06,4.2,.12,m.black);for(const y of [.6,2.1,3.8])local(0,y,0,l,.06,.12,m.black);continue;}
   local(0,.58,0,l,1.16,.29,m.darkWood);
   for(const side of [-1,1]){
    for(const y of [.08,1.12,1.2,3.95,4.08])local(0,y,side*.16,l,y>3?.06:.055,.06,y===1.2?m.brass:m.wood);
    const n=Math.max(1,Math.floor(l/.9)),step=l/n;
    for(let k=0;k<n;k++){
     const t=-l/2+step*(k+.5);local(t,.61,side*.175,step-.11,.72,.035,m.wood);
     for(const y of [.22,1])local(t,y,side*.2,step-.06,.028,.035,m.darkWood);
     for(const edge of [-1,1])local(t+edge*(step-.07)/2,.61,side*.2,.035,.8,.035,m.darkWood);
    }
   }
  }
 }
 // Door frames and lintels preserve an uninterrupted walkable portal.
 for(const d of portals){const mid=(d.min+d.max)/2,w=d.max-d.min,ry=d.axis==='x'?Math.PI/2:0,x=d.axis==='x'?d.at:mid,z=d.axis==='x'?mid:d.at;
  b(w+.28,1.25,.26,x,3.58,z,m.plaster,ry);
  for(const side of [-1,1])for(let tier=0;tier<3;tier++){
   const off=side*(w/2+.06+tier*.105);
   b(.105,3.2+tier*.09,.34+tier*.055,x+off*Math.cos(ry),(3.2+tier*.09)/2,z-off*Math.sin(ry),tier===1?m.wood:m.darkWood,ry);
   b(.022,2.98,.52,x+off*Math.cos(ry),1.49,z-off*Math.sin(ry),m.wood,ry);
  }
  for(let tier=0;tier<3;tier++)b(w+.2+tier*.22,.105,.36+tier*.075,x,3.02+tier*.115,z,tier===1?m.wood:m.darkWood,ry);
  b(w+.66,.045,.55,x,3.33,z,m.brass,ry);

 }
 // Entrance Hall: deliberately modelled to the reference's cabinet/portrait sightline.
 p.cabinet(-2.6,10.35,2.2);p.lamp(-1.92,10.35);for(let k=0;k<7;k++)p.book(-3.3+k*.12,1.03,10.35,[m.bookRed,m.bookTan,m.bookGreen][k%3],.09,.25+k%3*.06);
 p.cabinet(2.6,10.35,2.2);p.lamp(1.92,10.35);p.plant(3.2,10.355,1.03,.65);
 p.frame(-5.78,2.65,5.5,1.7,2.05,Math.PI/2);p.frame(5.78,2.65,5.5,2.55,1.7,-Math.PI/2,m.landscape);
 p.frame(-3.55,2.45,11.8,1.5,1.95,Math.PI);p.frame(3.55,2.45,11.8,2.35,1.7,Math.PI,m.landscape);
 p.chair(-4.25,9.7);p.chair(4.25,9.7);p.plant(-5.1,10.6,0,1.3);p.plant(5.1,10.6,0,1.3);
 // Handrails and a front door, no time machine or wing portal.
 b(2.4,2.9,.2,0,1.45,.06,m.darkWood);for(const xx of [-.85,.85]){b(.055,2.3,.1,xx,1.5,.2,m.brass);}b(2.3,.06,.1,0,2.55,.2,m.brass);
 // Emerald damask and substantial pilasters frame the main gallery opening.
 for(const side of [-1,1]){
  b(.5,2.55,.04,side*2.2,2.52,11.84,m.wallpaper);
  for(const dx of [-.28,.28])b(.045,2.7,.065,side*2.2+dx,2.52,11.8,m.brass);
  b(.7,.14,.2,side*2.2,1.18,11.75,m.wood);
  p.wallLamp(side*2.67,2.45,11.7,Math.PI);
 }
 // Pictures occupy clear wall bays; their full frames clear the portal trim.
 const galleryPictureZ=[15,22,25.4,33],galleryLampZ=[16.7,23.7,27,34.7];
 for(let i=0;i<4;i++){const z=15+i*5.2;for(const side of [-1,1]){p.frame(side*1.8,2.37,galleryPictureZ[i],1.02,1.35,-side*Math.PI/2,i%2?m.landscape:m.portrait);p.wallLamp(side*1.76,2.35,galleryLampZ[i],-side*Math.PI/2);}if(i<3){p.plant(-1.45,z+2.9,0,.6);}}
 for(const z of [16,24,32])p.hangingLantern(0,z);
 p.hangingLantern(0,8);
 // Library shelves and desk in the verified west room.
 for(let z=27.6;z<35;z+=2.4){p.shelf(-15.6,z,2.2,Math.PI/2);if(z<29||z>31.4)p.shelf(-2.4,z,2.2,-Math.PI/2);}
 p.shelf(-12,35.5,2.6,Math.PI);p.shelf(-8.8,35.5,2.6,Math.PI);
 p.cabinet(-9,32.8,2.8);p.lamp(-9.6,32.8);p.chair(-9,31.6,Math.PI);b(3.7,.018,4,-9,.011,31,m.rug);
 a.sphere(.27,-10.3,1.36,32.8,m.water);a.cylinder(.12,.18,.18,-10.3,1.13,32.8,m.brass);
 // Drawing room fireplace and seating.
 b(2.8,1.3,.65,-15.48,.65,21.5,m.marble);b(.05,.78,1.7,-15.11,.5,21.5,m.black);b(.08,.16,.95,-15.06,.19,21.5,m.light);
 b(3,.14,.85,-15.48,1.35,21.5,m.marble);p.frame(-15.25,2.5,21.5,1.4,1.65,Math.PI/2);
 p.sofa(-10,23.9);
 for(const xx of [-11.65,-8.35])p.chair(xx,21.2,Math.PI);a.bevel(1.8,.1,.85,-10,.5,21.5,m.wood);for(const xx of [-10.65,-9.35])b(.1,.45,.65,xx,.225,21.5,m.darkWood);a.obstacle(-10,21.5,1.8,.85);b(5,.016,5,-10,.009,21.7,m.rug);
 p.lamp(-13.1,24.9,.02);p.plant(-3.1,24.9);
 // Dining room and its table; future game hooks are data-driven interactions.
 b(6,.17,1.8,9,.88,21,m.wood);for(const xx of [6.4,11.6])for(const zz of [20.4,21.6])b(.16,.8,.16,xx,.4,zz,m.darkWood);a.obstacle(9,21,6,1.8);
 for(let i=0;i<5;i++){const xx=6.6+i*1.2;p.chair(xx,19.5,Math.PI);p.chair(xx,22.5);for(const zz of [20.45,21.55]){a.cylinder(.205,.205,.018,xx,.982,zz,m.linen);a.cylinder(.15,.15,.021,xx,.988,zz,m.marble);b(.017,.012,.26,xx+.27,.981,zz,m.brass);}}
 b(4.8,.012,.4,9,.979,21,m.linen);
 for(const xx of [7.5,9,10.5]){a.turned([[.12,0],[.12,.025],[.06,.04],[.028,.12],[.045,.2],[.08,.24]],xx,.99,21,m.brass,10);a.cylinder(.035,.035,.24,xx,1.35,21,m.linen,8);a.sphere(.032,xx,1.49,21,m.light,.65,1.6,.65);}
 p.cabinet(13.8,24.9,2.8);p.lamp(13.1,24.9);p.frame(8,2.55,25.75,2.4,1.6,Math.PI,m.landscape);
 // Conservatory: iron mullions, green plants, table and glass structure.
 for(let i=0;i<4;i++)for(const xx of [-6.7,6.7])p.plant(xx,37.5+i*2.5,0,1.1,i%2?'broadleaf':'fern');
 for(let xx=-7;xx<=7;xx+=1.4){b(.055,.08,12,xx,4.04,42,m.black);}
 for(let zz=36;zz<=48;zz+=1.5)b(16,.08,.055,0,4.05,zz,m.black);
 a.cylinder(.85,.85,.08,-4,1,42,m.marble);a.cylinder(.13,.25,1,-4,.5,42,m.black);a.obstacle(-4,42,1.7,1.7);p.chair(-4,40.8,Math.PI);p.chair(-4,43.2);p.plant(-4,42,1.06,.55,'fern');
 // Curved iron knee braces and a potting bench deepen the glazed garden vista.
 for(const zz of [38,42,46])for(const side of [-1,1]){
  const curve=t=>[side*(6.45+1.35*Math.sin(t*Math.PI/2)),4.02-1.25*(1-Math.cos(t*Math.PI/2)),zz];
  for(let i=0;i<5;i++)a.rod(curve(i/5),curve((i+1)/5),.026,m.black);
  a.sphere(.065,side*6.45,4.02,zz,m.brass);
 }
 a.bevel(2.6,.08,.7,4.7,.9,46.3,m.wood);b(2.4,.06,.6,4.7,.23,46.3,m.darkWood);
 for(const xx of [3.6,5.8])for(const zz of [46.08,46.52])a.cylinder(.026,.04,.85,xx,.445,zz,m.black,8);
 a.obstacle(4.7,46.3,2.65,.75);p.plant(5.4,46.3,.95,.6,'fern');p.plant(4.5,46.3,.95,.42);
 for(const xx of [3.8,4.25,4.7]){a.cylinder(.15,.1,.23,xx,.375,46.3,m.terracotta);a.cylinder(.155,.155,.03,xx,.49,46.3,m.terracotta);a.cylinder(.125,.125,.012,xx,.51,46.3,m.soil);}
 // The glazed arch gives the straight gallery a fixed conservatory sightline.
 a.add(new T.TorusGeometry(1.65,.035,5,28,Math.PI),m.black,0,2.15,47.82);
 for(const side of [-1,1])a.rod([side*1.65,0,47.82],[side*1.65,2.15,47.82],.035,m.black);
 a.rod([-1.65,2.15,47.82],[1.65,2.15,47.82],.03,m.black);
 for(let i=1;i<8;i++){const angle=i*Math.PI/8;a.rod([0,2.15,47.82],[Math.cos(angle)*1.65,2.15+Math.sin(angle)*1.65,47.82],.018,m.black);}
 // Garden: clear route, fountain, planted edges and benches.
 for(let zz=50;zz<=78;zz+=2)b(2.2,.04,1.94,0,.005,zz,m.marble);
 a.cylinder(1.8,1.9,.4,0,.2,61,m.marble,32);a.cylinder(1.55,1.55,.025,0,.43,61,m.water,32);a.cylinder(.18,.4,1.2,0,1,61,m.marble);a.cylinder(.75,.6,.15,0,1.65,61,m.marble);a.obstacle(0,61,3.8,3.8);
 for(const xx of [-4.6,4.6]){b(2.3,.1,.58,xx,.5,57,m.wood);b(2.3,.55,.08,xx,.82,57.25,m.wood);for(const dx of [-.85,.85])b(.12,.45,.4,xx+dx,.225,57,m.black);a.obstacle(xx,57,2.4,.7);}
 for(let zz=51;zz<79;zz+=6)for(const xx of [-13,13]){a.cylinder(.18,.25,3.2,xx,1.6,zz,m.darkWood);a.sphere(1.8,xx,3.8,zz,m.leaf,1,1.5,1);a.obstacle(xx,zz,.7,.7);}
 // A real key mesh, interactable note and room hooks; no fake game generation.
 a.cylinder(.055,.055,.014,-2.65,1.065,10.2,m.brass);b(.16,.012,.025,-2.54,1.07,10.2,m.brass);b(.024,.012,.06,-2.47,1.07,10.21,m.brass);
 b(.29,.012,.22,-2.72,1.065,10.359,m.paper);
 interactions.push({id:'letter',name:'Inspect the sealed letter',position:[-2.7,1.07,10.35],title:'A letter on the hall table',text:'The house is ready for its next story. This is an exploration foundation: follow the portrait gallery, enter the library or dining room, and continue through the conservatory into the garden. Your future games can attach clues to these objects.',kind:'inspect'});
 interactions.push({id:'library-note',name:'Read the library journal',position:[-9,1.05,32.8],title:'The library journal',text:'A reusable world should keep its rooms, props and interactions separate from each game. This desk is an example interaction anchor. It does not reveal a generated mystery.',kind:'inspect'});
 interactions.push({id:'theatre',name:'Open Theatre',position:[8.4,1,21],title:'Theatre',text:'Open your Narrator Package in the existing Theatre. Returning here starts a fresh exploration.',kind:'link',href:'../theatre/'});
 const root=a.finish();return {root,colliders:a.colliders,interactions,dispose(){a.dispose();}};
}
