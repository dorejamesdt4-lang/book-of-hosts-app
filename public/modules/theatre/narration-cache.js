let opening;
function db(){return opening||(opening=new Promise((resolve,reject)=>{const r=indexedDB.open('boh-narration',1);r.onupgradeneeded=()=>r.result.createObjectStore('clips');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}).catch(e=>{opening=null;throw e}))}
async function run(mode,key,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('clips',mode),store=tx.objectStore('clips');const req=value===undefined?store.get(key):store.put(value,key);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Narration storage was interrupted.'))})}
export const readClip=key=>run('readonly',key);
export const saveClip=(key,blob)=>run('readwrite',key,blob);
