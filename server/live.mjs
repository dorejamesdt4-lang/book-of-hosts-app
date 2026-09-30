import {randomBytes} from 'node:crypto';
import {readPackage} from '../public/modules/theatre/package.js';
import {checkRuby} from '../public/modules/shared/contracts.js';
import {defaultLook,validLook} from '../public/modules/wardrobe/appearance.js';
const token=()=>randomBytes(24).toString('hex');
const rooms=new Map(),creation=new Map();
const fail=(status,message)=>Object.assign(Error(message),{status});
const now=()=>Date.now();
function position(room){return room.state.offset+(room.state.playing?(now()-room.state.updatedAt)/1000:0)}
function expire(){for(const [code,r] of rooms)if(now()-r.createdAt>6*3600e3)rooms.delete(code)}
async function body(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>32*1024*1024)throw fail(413,'This live package is too large. Use shorter narration clips.');chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw fail(400,'Invalid request.')}}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function member(req,room){const key=(req.headers.authorization||'').replace(/^Bearer /,'');if(key===room.hostToken)return {role:'host'};const m=room.members.find(m=>m.token===key);if(!m)throw fail(401,'This invitation is not valid.');return m}
function pauseMissingHost(r){if(now()-r.hostSeen>8000&&r.state.playing){r.state={...r.state,offset:position(r),playing:false,updatedAt:now(),revision:r.state.revision+1}}}
export async function liveRequest(req,res){if(!req.url.startsWith('/api/live'))return false;
 const origin=req.headers.origin,own='http://'+req.headers.host;const allowed=new Set((process.env.LIVE_ALLOWED_ORIGINS||'https://dorejamesdt4-lang.github.io').split(',').map(s=>s.trim()));
 if(origin&&(origin===own||origin==='https://'+req.headers.host||allowed.has(origin))){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Live-Key');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')}
 else if(origin){send(res,403,{error:'This site is not allowed to use the live connection.'});return true}
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return true}
 try{expire();const path=new URL(req.url,'http://localhost').pathname.split('/').filter(Boolean);
 if(path.length===3&&path[2]==='rooms'&&req.method==='POST'){
 if(process.env.LIVE_CREATE_KEY&&req.headers['x-live-key']!==process.env.LIVE_CREATE_KEY)throw fail(403,'The host connection key is required.');
 const ip=req.socket.remoteAddress,last=creation.get(ip)||[];const recent=last.filter(t=>now()-t<3600e3);if(recent.length>=10||[...rooms.values()].filter(r=>!r.closed).length>=10)throw fail(429,'Live sessions are busy. Retry later.');
 const input=await body(req),pack=readPackage(input.script);if(!['hosted','online'].includes(input.mode))throw fail(400,'Choose hosted Showbox or fully live play.');
 const game=input.game?checkRuby(input.game):null;if(game&&game.event_title!==pack.title)throw fail(400,'Player cards belong to a different story.');
 const clips={};for(const [id,clip] of Object.entries(input.clips||{})){if(!pack.steps.some(s=>s.id===id&&s.type==='line')||typeof clip!=='string'||!/^data:audio\/(wav|mpeg|ogg);base64,[A-Za-z0-9+/=]+$/.test(clip))throw fail(400,'Invalid narration clip.');clips[id]=clip}
 const appearances={};for(const [key,v] of Object.entries(input.appearances||{}))if(!['__proto__','constructor','prototype'].includes(key))appearances[key]=validLook(v);
 let code;do{code=randomBytes(4).toString('hex').toUpperCase()}while(rooms.has(code));
 const hostToken=token(),screenToken=token(),r={code,hostToken,pack,game,clips,appearances,mode:input.mode,createdAt:now(),hostSeen:now(),closed:false,members:[{id:'screen',name:'Shared screen',token:screenToken,role:'screen',lastSeen:0}],state:{index:0,offset:0,playing:false,updatedAt:now(),revision:0,narrator:'magician'}};rooms.set(code,r);creation.set(ip,[...recent,now()]);send(res,201,{code,hostToken,screenToken});return true;
 }
 const room=rooms.get(path[3]);if(!room)throw fail(404,'This live session is not available.');if(room.closed)throw fail(410,'The host has ended this session.');
 const action=path[4];if(action==='join'&&req.method==='POST'){if(room.members.length>=40)throw fail(409,'This session is full.');const data=await body(req);if(typeof data.name!=='string'||!data.name.trim()||data.name.length>60)throw fail(400,'Enter your player name.');const m={id:token().slice(0,12),token:token(),name:data.name.trim(),role:'pending',lastSeen:now()};room.members.push(m);send(res,201,{token:m.token,id:m.id});return true}
 const m=member(req,room);pauseMissingHost(room);if(m.role==='host')room.hostSeen=now();else m.lastSeen=now();
 if(action==='state'&&req.method==='GET'){
 if(m.role==='pending'){send(res,200,{pending:true,serverTime:now(),hostOnline:now()-room.hostSeen<8000});return true}
 const step=room.pack.steps[room.state.index];const c=room.game?.characters.find(c=>'guest-'+c.guest_index===m.seat);const act=room.game?.acts.find(a=>a.act_title===step.actTitle);const character=c?{name:c.character_name,role:c.role_title,personality:c.personality_traits,secret:c.secret,instructions:(act?.guest_instructions||[]).filter(t=>t.guest_index===c.guest_index).map(t=>t.instructions)}:null;
 const {audio,...scene}=step;const current={title:room.pack.title,mode:room.mode,state:room.state,scene,audioReady:!!room.clips[step.id],serverTime:now(),hostOnline:now()-room.hostSeen<8000,role:m.role,character,characterTemplate:room.pack.characters.find(c=>c.id===m.seat)?.presentation||'magician',appearance:m.seat?room.appearances[room.pack.id+'::'+m.seat]||defaultLook(room.pack.id+'::'+m.seat,room.pack.characters.find(c=>c.id===m.seat)?.presentation||'magician'):null,speakerAppearance:room.appearances[room.pack.id+'::'+step.speaker]||room.appearances['narrator-'+room.state.narrator]||null,speakerTemplate:room.pack.characters.find(c=>c.id===step.speaker)?.presentation||room.state.narrator};
 if(m.role==='host'){current.members=room.members.map(({token,...p})=>({...p,online:now()-p.lastSeen<7000}));current.cast=room.pack.characters;current.totalScenes=room.pack.steps.length}
 send(res,200,current);return true;
 }
 if(action==='audio'&&req.method==='GET'){if(m.role==='pending')throw fail(403,'Wait for the host to admit you.');const id=room.pack.steps[room.state.index].id;if(new URL(req.url,'http://localhost').searchParams.get('scene')!==id)throw fail(409,'The host has moved to another scene.');const clip=room.clips[id];if(!clip)throw fail(404,'This scene has no recording.');const type=clip.slice(5,clip.indexOf(';')),buffer=Buffer.from(clip.slice(clip.indexOf(',')+1),'base64');res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(buffer);return true}
 if(action==='ready'&&req.method==='POST'&&['player','screen'].includes(m.role)){const d=await body(req);if(d.sceneId!==room.pack.steps[room.state.index].id||typeof d.ready!=='boolean'||typeof d.sound!=='boolean')throw fail(409,'The current scene changed.');m.readyScene=d.ready?d.sceneId:null;m.sound=d.sound;send(res,200,{ok:true});return true}
 if(m.role!=='host')throw fail(403,'Only the host controls the show.');
 if(action==='control'&&req.method==='POST'){const d=await body(req);if(!Number.isInteger(d.index)||d.index<0||d.index>=room.pack.steps.length||!Number.isFinite(d.offset)||d.offset<0||d.offset>86400||typeof d.playing!=='boolean'||!['magician','jester'].includes(d.narrator))throw fail(400,'Invalid host control.');if(d.playing&&(room.pack.steps[d.index].type!=='line'||!room.clips[room.pack.steps[d.index].id]))throw fail(400,'This scene has no playable narration.');room.state={index:d.index,offset:d.offset,playing:d.playing,narrator:d.narrator,updatedAt:now(),revision:room.state.revision+1};send(res,200,{ok:true});return true}
 if(action==='admit'&&req.method==='POST'){const d=await body(req),player=room.members.find(p=>p.id===d.id&&p.role!=='screen');if(!player)throw fail(404,'Player not found.');if(d.remove){room.members=room.members.filter(p=>p!==player);send(res,200,{ok:true});return true}if(!room.pack.characters.some(c=>c.id===d.seat)||room.members.some(p=>p!==player&&p.seat===d.seat))throw fail(409,'Choose an available character.');player.seat=d.seat;player.role='player';send(res,200,{ok:true});return true}
 if(action==='close'&&req.method==='POST'){room.closed=true;room.clips={};send(res,200,{ok:true});return true}
 throw fail(404,'Live action not found.');
 }catch(e){send(res,e.status||400,{error:e.status?e.message:'The live package could not be opened: '+e.message})}return true;
}
