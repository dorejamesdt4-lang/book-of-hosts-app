// All props are real geometry batched into the architecture.
export function makeProps(a,m){
 const b=(w,h,d,x,y,z,mat=m.wood,ry=0)=>a.box(w,h,d,x,y,z,mat,ry);
 function cabinet(x,z,w=2.1){a.bevel(w,.12,.64,x,.96,z,m.marble);b(w,.75,.58,x,.53,z);a.bevel(w+.06,.08,.64,x,.12,z,m.darkWood);for(const xx of [x-w/2+.11,x+w/2-.11]){b(.12,.17,.5,xx,.065,z,m.darkWood);b(.075,.74,.07,xx,.55,z-.325,m.brass);}for(let row=0;row<3;row++){a.bevel(w-.23,.19,.05,x,.28+row*.22,z-.306,m.darkWood);for(const xx of [x-.45,x+.45])a.sphere(.035,xx,.28+row*.22,z-.35,m.brass);}a.obstacle(x,z,w,.68);}
 function lamp(x,z,y=1.05){a.turned([[.23,0],[.25,.025],[.24,.045],[.16,.07],[.1,.1],[.07,.16],[.085,.24],[.11,.29],[.1,.32],[.05,.37],[.035,.5],[.035,.62]],x,y,z,m.brass);a.cylinder(.18,.32,.42,x,y+.81,z,m.linen,24);a.cylinder(.185,.325,.025,x,y+.59,z,m.brass,24);a.cylinder(.185,.185,.025,x,y+1.03,z,m.brass,24);a.sphere(.105,x,y+.8,z,m.light);}
 function book(x,y,z,material=m.bookRed,w=.1,h=.3){b(w,h,.23,x,y+h/2,z,material);b(w*.85,h*.94,.22,x,y+h/2,z+.012,m.paper);b(w*.99,.016,.235,x,y+.05,z,m.brass);}
 function shelf(x,z,w=2.2,ry=0){ // local coords for wall-aligned shelf
  const X=(xx,zz)=>[x+xx*Math.cos(ry)+zz*Math.sin(ry),z-xx*Math.sin(ry)+zz*Math.cos(ry)];
  const bb=(ww,hh,dd,xx,yy,zz,mat)=>{const p=X(xx,zz);b(ww,hh,dd,p[0],yy,p[1],mat,ry);};
  bb(w,2.8,.08,0,1.4,.15,m.darkWood);bb(.13,2.9,.45,-w/2,1.45,0,m.wood);bb(.13,2.9,.45,w/2,1.45,0,m.wood);bb(w+.2,.12,.5,0,2.95,0,m.brass);
  for(let row=0;row<6;row++){const y=.12+row*.45;bb(w,.07,.45,0,y,0,m.wood);for(let k=0;k<13;k++){const xx=-w/2+.14+k*(w-.28)/13;bb(.09,.22+(k%4)*.055,.25,xx,y+.18,0,[m.bookRed,m.bookGreen,m.bookTan][(k+row)%3]);bb(.085,.014,.26,xx,y+.09,-.006,m.brass);}}
  a.obstacle(x,z,Math.abs(Math.cos(ry))*w+.5*Math.abs(Math.sin(ry)),Math.abs(Math.sin(ry))*w+.5*Math.abs(Math.cos(ry)));
 }
 function chair(x,z,ry=0,wide=.72){b(wide,.16,.66,x,.43,z,m.leather,ry);b(wide,.62,.12,x,.76,z+.29,m.leather,ry);for(const xx of [-.26,.26])for(const zz of [-.25,.25])b(.07,.38,.07,x+xx,.19,z+zz,m.darkWood);a.obstacle(x,z,wide,.75);}
 function plant(x,z,y=0,scale=1){a.cylinder(.24*scale,.18*scale,.4*scale,x,y+.2*scale,z,m.terracotta);a.cylinder(.215*scale,.215*scale,.025,x,y+.405*scale,z,m.soil);for(let k=0;k<7;k++){const t=k*2.4,r=.12+Math.sin(k)*.06;a.cylinder(.014,.018,.6*scale,x+Math.sin(t)*r,y+.69*scale,z+Math.cos(t)*r,m.darkWood,6);a.sphere(.15*scale,x+Math.sin(t)*.23*scale,y+(.65+k*.07)*scale,z+Math.cos(t)*.23*scale,m.leaf,1.8,.22,1);}}
 function frame(x,y,z,w=1.25,h=1.65,ry=0,art=m.portrait){const xx=Math.cos(ry),zz=-Math.sin(ry),front=[Math.sin(ry),Math.cos(ry)];b(w+.16,h+.16,.08,x,y,z,m.darkWood,ry);for(const d of [.04,.1]){const ww=w+d,hh=h+d;b(ww,.038,.1,x,y-hh/2,z,m.brass,ry);b(ww,.038,.1,x,y+hh/2,z,m.brass,ry);for(const s of [-1,1])b(.04,hh,.1,x+s*ww/2*xx,y,z+s*ww/2*zz,m.brass,ry);}b(w,h,.018,x+front[0]*.058,y,z+front[1]*.058,art,ry);}
 function wallLamp(x,y,z,ry=0){b(.14,.38,.06,x,y-.23,z,m.brass,ry);a.sphere(.1,x,y-.2,z,m.brass);a.cylinder(.04,.1,.22,x,y,z,m.brass);a.sphere(.12,x,y+.17,z,m.light,.75,1.5,.75);a.cylinder(.12,.09,.05,x,y+.34,z,m.brass);}
 return {cabinet,lamp,book,shelf,chair,plant,frame,wallLamp};
}
