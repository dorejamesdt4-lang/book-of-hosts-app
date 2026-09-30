const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
function require(ok,message){if(!ok)throw Error(message)}
export function checkRuby(g){
 require(object(g),'Expected a game object.');
 require(text(g.event_title),'Original Ruby JSON needs event_title.');
 require(Array.isArray(g.characters)&&g.characters.length>0,'Characters are required.');
 const ids=new Set();
 for(const c of g.characters){require(object(c)&&text(c.character_name)&&Number.isInteger(c.guest_index)&&c.guest_index>=0,'Each character needs character_name and guest_index.');require(!ids.has(c.guest_index),'Duplicate guest_index.');ids.add(c.guest_index);require(typeof c.is_killer==='boolean','Each character needs is_killer.');}
 require(Array.isArray(g.acts)&&g.acts.length>0,'Original Ruby acts must be an array.');
 g.acts.forEach((a,i)=>{require(object(a)&&a.act_number===i+1&&text(a.act_title),'Acts must be numbered in order from 1.');require(a.narrator_script===null||typeof a.narrator_script==='string','Invalid narrator_script.');require(Array.isArray(a.clues_revealed)&&a.clues_revealed.every(text),'Invalid clues_revealed.');require(Array.isArray(a.guest_instructions)&&a.guest_instructions.every(x=>object(x)&&ids.has(x.guest_index)&&text(x.instructions)),'Invalid guest instructions or guest link.');});
 require(object(g.solution)&&ids.has(g.solution.killer_guest_index)&&text(g.solution.motive)&&text(g.solution.how_it_was_done)&&text(g.solution.final_reveal_script),'A linked final solution is required.');
 require(g.characters.filter(c=>c.is_killer).length===1&&g.characters.find(c=>c.is_killer).guest_index===g.solution.killer_guest_index,'Killer flag must match the solution.');
 if(g.narration_cues!==undefined)require(Array.isArray(g.narration_cues)&&g.narration_cues.every(c=>object(c)&&Number.isInteger(c.act)&&c.act>0&&c.act<=g.acts.length&&text(c.play_cue)&&text(c.pause_cue)),'Invalid narrator playback cues.');
 return g;
}
export function checkJester(g){
 require(object(g)&&text(g.game_title)&&text(g.rules)&&text(g.setup)&&text(g.scoring_or_win_condition),'Original Jester JSON needs game_title, setup, rules and scoring_or_win_condition.');
 require(object(g.player_count_range)&&Number.isInteger(g.player_count_range.min)&&g.player_count_range.min>0&&Number.isInteger(g.player_count_range.max)&&g.player_count_range.max>=g.player_count_range.min,'Invalid player count range.');
 require(Array.isArray(g.props_used)&&g.props_used.every(text),'Invalid props_used.');
 require(Array.isArray(g.health_and_safety)&&g.health_and_safety.every(text),'Invalid health_and_safety.');
 require(typeof g.swearing_used==='boolean','swearing_used must be a boolean.');
 return g;
}
