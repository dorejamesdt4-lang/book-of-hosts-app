import http from 'node:http';
import {liveRequest} from './live.mjs';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const root=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.glb':'model/gltf-binary'};
export function resolvePath(url){let p;try{p=decodeURIComponent(new URL(url,'http://localhost').pathname)}catch{return null}if(p.includes('\0'))return null;const f=path.resolve(root,'.'+p);return f===root||f.startsWith(root+path.sep)?f:null}
export const server=http.createServer(async(req,res)=>{if(await liveRequest(req,res))return;if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return}let f=resolvePath(req.url);if(!f){res.writeHead(400);res.end('Invalid path');return}try{if((await stat(f)).isDirectory())f=path.join(f,'index.html');const data=await readFile(f);res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('This feature is not available. Return to the dashboard at /.')}});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Book of Hosts: http://localhost:'+(process.env.PORT||3000)));
