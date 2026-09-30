import {showboxManifest} from '../ruby/kit-content.js';
import {checkRuby} from '../shared/contracts.js';
export function readPackage(input){
 const pack=input?.event_title?showboxManifest(checkRuby(input)):input;
 if(!pack||typeof pack.title!=='string'||!Array.isArray(pack.acts))throw Error('This Narrator Script has no title or acts.');
 const allowed=new Set(['line','clue','pause','minigame','music']);const ids=new Set();const steps=[];
 for(const [i,act] of pack.acts.entries()){if(!Array.isArray(act.steps))throw Error('An act has no scenes.');for(const s of act.steps){if(!s||!allowed.has(s.type)||typeof s.id!=='string'||ids.has(s.id))throw Error('Each scene needs a unique name and a supported type.');ids.add(s.id);if(s.type==='line'&&typeof s.text!=='string')throw Error('A narration scene has no script.');if(s.audio!==undefined&&typeof s.audio!=='string')throw Error('Invalid audio reference.');steps.push({...s,actTitle:act.title||'Act '+(i+1),playCue:act.play_cue||'',pauseCue:act.pause_cue||''});}}
 if(!steps.length)throw Error('This Narrator Script has no scenes.');return {title:pack.title,steps};
}
export function safePath(path){if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||/^[a-z]+:/i.test(path))throw Error('Audio clips must be inside your package.');const parts=path.split('/');if(parts.some(p=>p==='..'))throw Error('Audio path leaves the package.');return parts.filter(p=>p&&p!=='.').join('/');}
export function clipName(step){return step.id+'.wav';}
