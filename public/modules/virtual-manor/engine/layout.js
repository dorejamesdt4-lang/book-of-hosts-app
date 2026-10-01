// Coordinates follow the verified Dore Trading ground floor: X east, Z north.
export const rooms=[
 {id:'hall',name:'Entrance Hall',bounds:[-6,0,6,12],floor:'marble'},
 {id:'gallery',name:'Long Gallery',bounds:[-2,12,2,36],floor:'runner'},
 {id:'drawing',name:'Drawing Room',bounds:[-16,14,-2,26],floor:'wood'},
 {id:'library',name:'Library',bounds:[-16,26,-2,36],floor:'wood'},
 {id:'dining',name:'Dining Room',bounds:[2,14,16,26],floor:'wood'},
 {id:'conserv',name:'Conservatory',bounds:[-8,36,8,48],floor:'tile'},
 {id:'garden',name:'Moonlit Garden',bounds:[-20,48,20,80],floor:'grass'}
];
// New fixed doorway positions within the original bounds, recorded explicitly.
export const portals=[
 {from:'hall',to:'gallery',axis:'z',at:12,min:-1.6,max:1.6},
 {from:'gallery',to:'drawing',axis:'x',at:-2,min:18,max:20.4},
 {from:'gallery',to:'library',axis:'x',at:-2,min:29,max:31.4},
 {from:'gallery',to:'dining',axis:'x',at:2,min:18,max:20.4},
 {from:'drawing',to:'library',axis:'z',at:26,min:-10.2,max:-7.8},
 {from:'gallery',to:'conserv',axis:'z',at:36,min:-1.6,max:1.6},
 {from:'conserv',to:'garden',axis:'z',at:48,min:-1.6,max:1.6}
];
export const spawn={x:0,z:8,yaw:0};
export const roomAt=(x,z)=>rooms.find(r=>x>=r.bounds[0]&&x<=r.bounds[2]&&z>=r.bounds[1]&&z<=r.bounds[3]);
export function wallSegments(room){
 const [x0,z0,x1,z1]=room.bounds,edges=[['x',x0,z0,z1],['x',x1,z0,z1],['z',z0,x0,x1],['z',z1,x0,x1]];
 return edges.flatMap(([axis,at,min,max])=>{
  const gaps=portals.filter(p=>p.axis===axis&&p.at===at&&(p.from===room.id||p.to===room.id)).sort((a,b)=>a.min-b.min);
  const out=[];let cursor=min;
  for(const gap of gaps){if(gap.min>cursor)out.push({axis,at,min:cursor,max:gap.min});cursor=gap.max;}
  if(cursor<max)out.push({axis,at,min:cursor,max});return out;
 });
}
