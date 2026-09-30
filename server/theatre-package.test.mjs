import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readPackage,safePath,clipName} from '../public/modules/theatre/package.js';
const game=JSON.parse(await readFile(new URL('../public/modules/ruby/sample.json',import.meta.url)));
test('Ruby script becomes ordered narration and explicit host stops',()=>{const p=readPackage(game);assert.equal(p.title,game.event_title);assert.equal(p.steps[0].type,'line');assert.ok(p.steps.some(s=>s.type==='pause'));assert.equal(clipName(p.steps[0]),'A1-narration.wav');assert.equal(p.steps.at(-1).type,'pause')});
test('uploaded voiced Showbox preserves clip references and pause cue',()=>{const p=readPackage({title:'Show',acts:[{title:'First act',steps:[{id:'L1',type:'line',text:'Welcome.',audio:'audio/L1.wav'},{id:'P1',type:'pause',prompt:'Discuss the clue.'}]}]});assert.equal(p.steps[0].audio,'audio/L1.wav');assert.equal(p.steps[1].prompt,'Discuss the clue.')});
test('invalid scene data and duplicate identifiers rejected',()=>{assert.throws(()=>readPackage({title:'Show',acts:[{steps:[{id:'one',type:'line',text:'Hi'},{id:'one',type:'pause'}]}]}),/unique/);assert.throws(()=>readPackage({title:'Show',acts:[{steps:[{id:'one',type:'line'}]}]}),/script/)});
test('audio paths stay inside uploaded package',()=>{assert.equal(safePath('audio/L1.wav'),'audio/L1.wav');for(const path of ['../a.wav','/a.wav','https://example.com/a.wav','audio\\a.wav'])assert.throws(()=>safePath(path));});
