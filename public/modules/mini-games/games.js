import {printGame} from '../shared/print.js';
import {checkJester} from '../shared/contracts.js';
import {q,node,jesterCard,download} from '../shared/ui.js';
function load(){const games=JSON.parse(localStorage.getItem('boh.jester.games')||'[]');if(!Array.isArray(games))throw Error('Saved library is invalid.');return games;}
function render(){q('#games').replaceChildren();try{let shown=0;for(const g of load()){checkJester(g);if(g.swearing_used&&!q('#adult').checked)continue;shown++;const article=node('article','',q('#games'));article.className='ruby-result';jesterCard(g,article);const b=node('button','Download JSON',article);b.onclick=()=>download('mini-game.json',g);const print=node('button','Print / Save as PDF',article);print.onclick=()=>{try{printGame(g,'jester')}catch(e){q('#status').textContent=e.message}};}if(!shown)node('p','No mini-games to show yet. Generate one with Game Jester or import its JSON.',q('#games'));}catch(e){q('#status').textContent=e.message}}
q('#adult').onchange=render;
q('#import').onclick=()=>{try{const g=checkJester(JSON.parse(q('#response').value));if(g.swearing_used&&!q('#adult').checked)throw Error('Confirm the adult audience first.');const games=load();games.push(g);localStorage.setItem('boh.jester.games',JSON.stringify(games));q('#status').textContent='Mini-game imported.';render()}catch(e){q('#status').textContent=e.message}};
render();
