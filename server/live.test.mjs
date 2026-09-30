import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {server} from './index.mjs';
import {showboxManifest} from '../public/modules/ruby/kit-content.js';
const game=JSON.parse(await readFile(new URL('../public/modules/ruby/sample.json',import.meta.url))),script=showboxManifest(game);
test('independent devices follow the host, keep private seats, and cannot control or read future scenes',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,{token,data,method=data?'POST':'GET',headers={}}={})=>{const r=await fetch(base+'/api/live/'+path,{method,headers:{...headers,...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()}};
 try{
 const created=await call('rooms',{data:{mode:'online',script,game,clips:{'A1-narration':'data:audio/wav;base64,UklGRg=='}}});assert.equal(created.status,201);const {code,hostToken,screenToken}=created.data,p='rooms/'+code+'/';
 const a=(await call(p+'join',{data:{name:'First device'}})).data,b=(await call(p+'join',{data:{name:'Second device'}})).data;
 assert.equal((await call(p+'state',{token:a.token})).data.pending,true);
 assert.equal((await call(p+'audio?scene=A1-narration',{token:a.token})).status,403);
 assert.equal((await call(p+'state')).status,401);
 for(const [player,seat] of [[a,'guest-0'],[b,'guest-1']])assert.equal((await call(p+'admit',{token:hostToken,data:{id:player.id,seat}})).status,200);
 const control={index:0,offset:2,playing:true,narrator:'jester'};assert.equal((await call(p+'control',{token:a.token,data:control})).status,403);assert.equal((await call(p+'control',{token:hostToken,data:control})).status,200);
 const first=(await call(p+'state',{token:a.token})).data,second=(await call(p+'state',{token:b.token})).data,screen=(await call(p+'state',{token:screenToken})).data;
 assert.equal(first.state.playing,true);assert.equal(first.state.revision,second.state.revision);assert.equal(first.scene.id,second.scene.id);assert.equal(first.character.secret,game.characters[0].secret);assert.equal(second.character.secret,game.characters[1].secret);assert.equal(screen.character,null);assert.equal(first.members,undefined);assert.equal(first.cast,undefined);assert.equal(first.scene.audio,undefined);assert.ok(!JSON.stringify(first).includes(game.solution.final_reveal_script));
 assert.equal((await call(p+'audio?scene=final-reveal',{token:a.token})).status,409);
 const audio=await fetch(base+'/api/live/'+p+'audio?scene=A1-narration',{headers:{Authorization:'Bearer '+a.token}});assert.equal(audio.status,200);assert.equal(audio.headers.get('content-type'),'audio/wav');
 assert.equal((await call(p+'ready',{token:a.token,data:{sceneId:'A1-narration',ready:true,sound:true}})).status,200);assert.equal((await call(p+'state',{token:hostToken})).data.members.find(m=>m.id===a.id).readyScene,'A1-narration');const realNow=Date.now;try{Date.now=()=>realNow()+9000;assert.equal((await call(p+'state',{token:b.token})).data.state.playing,false)}finally{Date.now=realNow}
 await call(p+'control',{token:hostToken,data:{...control,playing:false,offset:4}});assert.equal((await call(p+'state',{token:b.token})).data.state.offset,4);assert.equal((await call(p+'state',{token:a.token})).data.state.playing,false);
 assert.equal((await call(p+'control',{token:hostToken,data:{...control,index:1}})).status,400);
 await call(p+'control',{token:hostToken,data:{...control,index:1,playing:false,offset:0}});assert.equal((await call(p+'state',{token:b.token})).data.scene.type,'clue');
 const finalIndex=script.acts.flatMap(a=>a.steps).findIndex(s=>s.id==='final-reveal');await call(p+'control',{token:hostToken,data:{...control,index:finalIndex,playing:false,offset:0}});assert.equal((await call(p+'state',{token:b.token})).data.scene.text,game.solution.final_reveal_script);
 await call(p+'admit',{token:hostToken,data:{id:a.id,remove:true}});assert.equal((await call(p+'state',{token:a.token})).status,401);
 const hostState=(await call(p+'state',{token:hostToken})).data;assert.equal(hostState.members.filter(m=>m.role==='player').length,1);assert.ok(hostState.members.every(m=>!Object.hasOwn(m,'token')));
 await call(p+'close',{token:hostToken,data:{}});assert.equal((await call(p+'state',{token:b.token})).status,410);
 const hosted=await call('rooms',{data:{mode:'hosted',script,game}});assert.equal(hosted.status,201);assert.equal((await call('rooms/'+hosted.data.code+'/state',{token:hosted.data.screenToken})).data.mode,'hosted');
 const blocked=await call('rooms',{headers:{Origin:'https://unknown.example'},data:{mode:'hosted',script}});assert.equal(blocked.status,403);
 const cors=await fetch(base+'/api/live/rooms',{method:'OPTIONS',headers:{Origin:'https://dorejamesdt4-lang.github.io'}});assert.equal(cors.status,204);assert.equal(cors.headers.get('access-control-allow-origin'),'https://dorejamesdt4-lang.github.io');
 }finally{await new Promise(r=>server.close(r))}
});
