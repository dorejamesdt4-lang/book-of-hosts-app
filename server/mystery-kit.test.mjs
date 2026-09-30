import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {kitDocuments,showboxManifest} from '../public/modules/ruby/kit-content.js';
import {packToGame,nameRuleProblems} from '../public/modules/legacy/living-script-v3/engine/showpack.js';
const game=JSON.parse(await readFile(new URL('../public/modules/ruby/sample.json',import.meta.url)));
test('kit exports every character separately plus story narrator rules and keepsake',()=>{const docs=kitDocuments(game);assert.equal(docs.length,game.characters.length+4);assert.equal(new Set(docs.map(d=>d.filename)).size,docs.length);const first=docs.find(d=>d.id==='character-0');assert.ok(!first.sections.some(s=>s.heading==='Final reveal'));assert.ok(!first.sections.some(s=>s.text.includes(game.characters[1].secret)));});
test('narrator play/pause cues are separate from spoken narration',()=>{const g=structuredClone(game);g.narration_cues=[{act:1,play_cue:'Press play after seating.',pause_cue:'Wait five minutes.'}];const docs=kitDocuments(g);const narrator=docs.find(d=>d.id==='narrator');assert.equal(narrator.sections[0].text,'Press play after seating.');assert.equal(narrator.sections[1].text,g.acts[0].narrator_script);assert.equal(narrator.sections[2].text,'Wait five minutes.');});
test('Showbox preparation uses original step contract and explicit host pauses',()=>{const m=showboxManifest(game);assert.deepEqual(nameRuleProblems(m),[]);assert.equal(m.acts.length,game.acts.length);assert.ok(m.acts.every(a=>a.steps.some(s=>s.type==='pause')));assert.equal(m.production.audioIncluded,false);assert.ok(m.acts.flatMap(a=>a.steps).every(s=>!s.audio));assert.ok(packToGame(m));});
