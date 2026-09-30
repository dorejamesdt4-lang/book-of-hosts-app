// Browser print preview: choose Save as PDF to create a printable PDF locally.
export function printGame(game,kind){
 const win=window.open('','_blank');if(!win){throw Error('Allow the print-preview window, then try again.');}
 const doc=win.document;doc.title=(game.event_title||game.game_title)+' — '+(kind==='guests'?'Guest cards':kind==='host'?'Host pack':'Game rules');doc.documentElement.lang='en';
 const meta=doc.createElement('meta');meta.name='viewport';meta.content='width=device-width,initial-scale=1';doc.head.append(meta);
 const style=doc.createElement('style');style.textContent=`@page{size:A4;margin:16mm}*{box-sizing:border-box}body{background:#e6dcc4;color:#243632;font:16px Georgia,serif;margin:0;padding:28px}main{max-width:800px;margin:auto}h1,h2,h3{font-weight:normal;color:#344b45}h1{font-size:30px}h2{font-size:24px;border-bottom:1px solid #b5924f;padding-bottom:10px}h3{font-size:19px}p{line-height:1.55;white-space:pre-wrap}section{background:#fffaf0;border:1px solid #b5924f;padding:24px;margin:20px 0}button{padding:12px 20px;background:#245a54;color:#fff6df;border:1px solid #b5924f;border-radius:6px;cursor:pointer;font:inherit}.toolbar{max-width:800px;margin:auto;padding-bottom:20px}.note{font-size:13px;color:#6d5530}.brand{font-size:12px;letter-spacing:2px;color:#82632d}.guest-card{break-after:page}.guest-card:last-child{break-after:auto}.secret{font-weight:bold}.solution{border:2px solid #8d573d}@media print{body{background:white;padding:0;font-size:11pt}.toolbar{display:none}section{background:white;box-shadow:none}h2,h3{break-after:avoid}p{orphans:3;widows:3}main{max-width:none}.guest-card{margin:0;border:1px solid #b5924f}button{display:none}}`;doc.head.append(style);
 const el=(tag,text,parent=doc.body)=>{const e=doc.createElement(tag);e.textContent=text;parent.append(e);return e};
 const bar=el('div','');bar.className='toolbar';el('p','Print or choose “Save as PDF” in your browser’s destination menu.',bar);const btn=el('button','Print / Save as PDF',bar);btn.onclick=()=>win.print();
 const main=el('main','');el('p','THE BOOK OF HOSTS · DORE TRADING UK',main).className='brand';el('h1',game.event_title||game.game_title,main);
 if(kind==='jester'){
  const s=el('section','',main);el('p',`${game.player_count_range.min}–${game.player_count_range.max} players · ${game.estimated_duration_minutes||'—'} minutes · ${game.venue||''}`,s);
  for(const [h,t] of [['Props',game.props_used.join(', ')||'None'],['Setup',game.setup],['Rules',game.rules],['Scoring / winning',game.scoring_or_win_condition],['Health & safety',game.health_and_safety.join('\n')]]){el('h2',h,s);el('p',t,s);}
 }else if(kind==='guests'){
  el('p','Private character cards — give each guest only their own page.',main).className='note';
  for(const c of game.characters){const s=el('section','',main);s.className='guest-card';el('h2',c.character_name,s);el('p',c.is_host_character?'Host character':`Guest ${c.guest_index+1}`,s);el('h3',c.role_title,s);el('p',c.personality_traits,s);el('h3','Your private secret',s);el('p',c.secret,s);el('h3','Costume',s);el('p',c.costume_suggestion,s);el('h3','Lines to try',s);el('p',(c.dialogue_lines||[]).join('\n'),s);for(const a of game.acts){const tasks=a.guest_instructions.filter(x=>x.guest_index===c.guest_index);if(tasks.length){el('h3',`Act ${a.act_number}: ${a.act_title}`,s);el('p','Read these instructions when the host reaches this act.',s).className='note';tasks.forEach(x=>el('p',x.instructions,s));}}}
 }else{
  el('p','HOST ONLY — includes private character details and the final solution. Keep away from players.',main).className='secret';
  const cast=el('section','',main);el('h2','Cast and guest links',cast);for(const c of game.characters){el('h3',`${c.character_name} — ${c.is_host_character?'Host':`Guest ${c.guest_index+1}`}`,cast);el('p',`${c.role_title}\nSecret: ${c.secret}\nCulprit: ${c.is_killer?'Yes':'No'}`,cast);}
  for(const a of game.acts){const s=el('section','',main);el('h2',`Act ${a.act_number}: ${a.act_title}`,s);if(a.narrator_script){el('h3','Narrator',s);el('p',a.narrator_script,s);}el('h3','Clues',s);el('p',a.clues_revealed.join('\n'),s);for(const t of a.guest_instructions){el('h3',game.characters.find(c=>c.guest_index===t.guest_index).character_name,s);el('p',t.instructions,s);}}
  if(game.mini_games?.length){const s=el('section','',main);el('h2','Selected mini-games',s);for(const g of game.mini_games){el('h3',g.title,s);el('p',g.description,s);}}
  const s=el('section','',main);s.className='solution';el('h2','Final solution — host only',s);el('p',game.solution.final_reveal_script,s);el('h3','Motive',s);el('p',game.solution.motive,s);el('h3','How it happened',s);el('p',game.solution.how_it_was_done,s);
 }
 win.focus();
}
