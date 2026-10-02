// All props are real geometry batched into the architecture.
export function makeProps(a,m){
 const b=(w,h,d,x,y,z,mat=m.wood,ry=0)=>a.box(w,h,d,x,y,z,mat,ry);
 function cabinet(x,z,w=2.1){
  a.floor(w+.55,1.25,x,z,m.contact,0,.01);
  a.bevel(w+.05,.1,.7,x,.98,z,m.wood);a.bevel(w+.1,.045,.73,x,1.035,z,m.darkWood);
  b(w,.5,.58,x,.68,z);a.bevel(w+.04,.06,.63,x,.405,z,m.darkWood);
  for(const xx of [x-w/2+.14,x+w/2-.14])for(const zz of [z-.21,z+.21])a.turned([[.07,0],[.09,.035],[.065,.07],[.04,.14],[.065,.22],[.055,.3],[.07,.38]],xx,.015,zz,m.darkWood);
  for(let row=0;row<2;row++){a.bevel(w-.2,.195,.055,x,.55+row*.23,z-.306,m.darkWood);for(const xx of [x-.45,x+.45]){a.sphere(.029,xx,.55+row*.23,z-.35,m.brass);a.rod([xx-.025,.52+row*.23,z-.36],[xx+.025,.52+row*.23,z-.36],.012,m.brass);}}
  for(const xx of [x-w/2+.07,x+w/2-.07])b(.045,.5,.055,xx,.68,z-.315,m.wood);
  a.obstacle(x,z,w,.73);
 }
 function lamp(x,z,y=1.05){a.turned([[.23,0],[.25,.025],[.24,.045],[.16,.07],[.1,.1],[.07,.16],[.085,.24],[.11,.29],[.1,.32],[.05,.37],[.035,.5],[.035,.62]],x,y,z,m.brass);a.cylinder(.18,.32,.42,x,y+.81,z,m.linen,24);a.cylinder(.185,.325,.025,x,y+.59,z,m.brass,24);a.cylinder(.185,.185,.025,x,y+1.03,z,m.brass,24);a.sphere(.105,x,y+.8,z,m.light);}
 function book(x,y,z,material=m.bookRed,w=.1,h=.3){b(w,h,.23,x,y+h/2,z,material);b(w*.85,h*.94,.22,x,y+h/2,z+.012,m.paper);b(w*.99,.016,.235,x,y+.05,z,m.brass);}
 function shelf(x,z,w=2.2,ry=0){ // local coords for wall-aligned shelf
  const X=(xx,zz)=>[x+xx*Math.cos(ry)+zz*Math.sin(ry),z-xx*Math.sin(ry)+zz*Math.cos(ry)];
  const bb=(ww,hh,dd,xx,yy,zz,mat)=>{const p=X(xx,zz);b(ww,hh,dd,p[0],yy,p[1],mat,ry);};
  bb(w,2.8,.08,0,1.4,.15,m.darkWood);bb(.13,2.9,.45,-w/2,1.45,0,m.wood);bb(.13,2.9,.45,w/2,1.45,0,m.wood);bb(w+.2,.12,.5,0,2.95,0,m.brass);
  for(let row=0;row<6;row++){const y=.12+row*.45;bb(w,.07,.45,0,y,0,m.wood);for(let k=0;k<13;k++){const xx=-w/2+.14+k*(w-.28)/13;bb(.09,.22+(k%4)*.055,.25,xx,y+.18,0,[m.bookRed,m.bookGreen,m.bookTan][(k+row)%3]);bb(.085,.014,.26,xx,y+.09,-.006,m.brass);}}
  a.obstacle(x,z,Math.abs(Math.cos(ry))*w+.5*Math.abs(Math.sin(ry)),Math.abs(Math.sin(ry))*w+.5*Math.abs(Math.cos(ry)));
 }
 function chair(x,z,ry=0,wide=.72){
  const point=(xx,yy,zz)=>[x+xx*Math.cos(ry)+zz*Math.sin(ry),yy,z-xx*Math.sin(ry)+zz*Math.cos(ry)];
  a.floor(1.1,1.1,x,z,m.contact,0,.01);b(wide,.09,.64,x,.36,z,m.darkWood,ry);a.bevel(wide-.03,.14,.64,x,.45,z,m.leather,ry);
  // A shield back and turned feet replace the original rectangular blocks.
  const shield=(w,h)=>[[-w*.3,-h*.5],[w*.3,-h*.5],[w*.5,-h*.1],[w*.48,h*.32],[w*.25,h*.5],[-w*.25,h*.5],[-w*.48,h*.32],[-w*.5,-h*.1]];
  a.outline(shield(wide,.66),.08,...point(0,.88,.28),m.darkWood,ry);
  a.outline(shield(wide-.12,.54),.045,...point(0,.9,.222),m.leather,ry);
  for(const xx of [-wide*.34,wide*.34])for(const zz of [-.23,.23]){const [px,,pz]=point(xx,0,zz);a.turned([[.027,0],[.04,.035],[.025,.15],[.047,.25],[.04,.32]],px,.015,pz,m.darkWood,8);}
  for(const xx of [-wide*.31,wide*.31])a.rod(point(xx,.36,.24),point(xx,.7,.28),.026,m.darkWood);
  a.obstacle(x,z,Math.abs(Math.cos(ry))*wide+Math.abs(Math.sin(ry))*.75,Math.abs(Math.sin(ry))*wide+Math.abs(Math.cos(ry))*.75);
 }
 function sofa(x,z,w=3){
  a.floor(w+.45,1.5,x,z,m.contact,0,.012);b(w-.12,.15,.92,x,.28,z,m.darkWood);
  for(const xx of [x-w/2+.22,x+w/2-.22])for(const zz of [z-.36,z+.36])a.turned([[.045,0],[.065,.04],[.045,.12],[.075,.24]],xx,.015,zz,m.darkWood,8);
  a.bevel(w-.08,.64,.2,x,.76,z+.43,m.darkWood);
  const cushion=(w-.6)/3;for(let k=0;k<3;k++){const xx=x+(k-1)*cushion;a.bevel(cushion-.025,.18,.84,xx,.43,z-.015,m.leather);a.bevel(cushion-.018,.56,.18,xx,.78,z+.3,m.leather);}
  for(const side of [-1,1]){const xx=x+side*(w/2-.15);a.bevel(.24,.34,.87,xx,.54,z,m.leather);a.sphere(.19,xx,.73,z,m.leather,.9,.8,2.6);}
  a.obstacle(x,z,w,1.2);
 }
 function plant(x,z,y=0,scale=1,kind='broadleaf'){
  const point=(xx,yy,zz)=>[x+xx*scale,y+yy*scale,z+zz*scale];
  if(y===0)a.floor(scale*.85,scale*.85,x,z,m.contact,0,.012);
  a.cylinder(.24*scale,.18*scale,.4*scale,x,y+.2*scale,z,m.terracotta);a.cylinder(.255*scale,.25*scale,.055*scale,x,y+.375*scale,z,m.terracotta);a.cylinder(.215*scale,.215*scale,.025,x,y+.405*scale,z,m.soil);
  if(kind==='fern'){
   for(let k=0;k<7;k++){const angle=k*2.4+x*.17,dx=Math.sin(angle),dz=Math.cos(angle),rise=.62+(k%3)*.09;
    const stem=t=>point(dx*.65*t,.42+Math.sin(t*2.7)*rise,dz*.65*t);
    for(let j=0;j<3;j++)a.rod(stem(j/3),stem((j+1)/3),.007*scale,m.bookGreen);
    for(let j=1;j<=5;j++){const t=j/6,base=stem(t),spread=.24*(1-t)+.055;for(const side of [-1,1])a.leaf(base,point(dx*(.65*t+.075)+side*dz*spread,.42+Math.sin(t*2.7)*rise-.08,dz*(.65*t+.075)-side*dx*spread),(.12-.05*t)*scale,k%2?m.leaf:m.bookGreen);}
    a.leaf(stem(.85),stem(1.1),.075*scale,m.leaf);
   }
  }else{
   for(let k=0;k<9;k++){const angle=k*2.4+x*.17,dx=Math.sin(angle),dz=Math.cos(angle),height=.63+(k%3)*.22;const from=point(dx*.055,height,dz*.055);a.rod(point(0,.4,0),from,.009*scale,m.bookGreen);a.leaf(from,point(dx*(.37+(k%2)*.05),height-.15+(k%3)*.1,dz*(.37+(k%2)*.05)),.25*scale,k%3?m.leaf:m.bookGreen);}
  }
 }
 function frame(x,y,z,w=1.25,h=1.65,ry=0,art=m.portrait){const xx=Math.cos(ry),zz=-Math.sin(ry),front=[Math.sin(ry),Math.cos(ry)];a.bevel(w+.22,h+.22,.1,x,y,z,m.darkWood,ry);for(const d of [.035,.1,.17]){const ww=w+d,hh=h+d;b(ww,.038,.1,x,y-hh/2,z,m.brass,ry);b(ww,.038,.1,x,y+hh/2,z,m.brass,ry);for(const s of [-1,1])b(.04,hh,.1,x+s*ww/2*xx,y,z+s*ww/2*zz,m.brass,ry);}b(w,h,.018,x+front[0]*.058,y,z+front[1]*.058,art,ry);}
 function wallLamp(x,y,z,ry=0){b(.14,.38,.06,x,y-.23,z,m.brass,ry);a.sphere(.1,x,y-.2,z,m.brass);a.cylinder(.04,.1,.22,x,y,z,m.brass);a.sphere(.12,x,y+.17,z,m.light,.75,1.5,.75);a.cylinder(.12,.09,.05,x,y+.34,z,m.brass);}
 function hangingLantern(x,z){a.cylinder(.015,.015,.76,x,3.74,z,m.brass,8);a.cylinder(.04,.22,.18,x,3.27,z,m.brass,4);a.cylinder(.16,.23,.56,x,2.9,z,m.glass,4);a.cylinder(.235,.18,.09,x,2.58,z,m.brass,4);a.sphere(.09,x,2.83,z,m.light,.7,1.6,.7);for(const sx of [-1,1])for(const sz of [-1,1])a.rod([x+sx*.16,3.18,z+sz*.16],[x+sx*.23,2.62,z+sz*.23],.018,m.brass);a.cylinder(.018,.035,.16,x,2.49,z,m.brass,8);}
 return {cabinet,lamp,book,shelf,chair,sofa,plant,frame,wallLamp,hangingLantern};
}
