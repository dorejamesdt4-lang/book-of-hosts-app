// Move existing controls between chapters; never recreate them on Back/Next.
export function storybook(form,kind){
 const titles=kind==='ruby'?['Set the scene','Gather your cast','Open the Mystery Box','Rehearse your tale']:['Choose your game','Gather your props','Summon the Jester','Test your mini-game'];
 const notes=kind==='ruby'?['Every mystery begins with a place, a time and a little intrigue.','Give each guest a character seed and choose the evening’s extras.','Build your prompt, copy it to your AI assistant and bring the story back.','Paste the original JSON, then explore the story one act at a time.']:['A quick challenge, a little mischief, a memorable evening.','Tell the Jester what is available and where you will play.','Build and copy your prompt. The Jester’s rules travel with it.','Bring back the JSON to preview, save and test your invention.'];
 const storage='boh.intake.'+kind;
 const key=e=>e.dataset.draftKey||e.id||e.name;
 let draft={};try{draft=JSON.parse(sessionStorage.getItem(storage)||'{}')}catch{}
 // Restore the cast size first, then the generated guest controls.
 const players=form.querySelector('#players');if(players&&draft.values?.players){players.value=draft.values.players.value;players.dispatchEvent(new Event('change'));}
 for(const e of form.querySelectorAll('input,select,textarea')){const v=draft.values?.[key(e)];if(!v)continue;if(e.type==='checkbox')e.checked=v.checked;else e.value=v.value;e.dispatchEvent(new Event('input'));if(e.id==='host-playing')e.dispatchEvent(new Event('change'));}
 const status=form.querySelector('#status');if(status)status.remove();
 const original=[...form.children];let phase=0;
 const header=document.createElement('div');header.className='chapter-heading';header.innerHTML='<span class="chapter-seal" aria-hidden="true">✦</span><p class="eyebrow">YOUR STORY, ONE PAGE AT A TIME</p>';
 const nav=document.createElement('nav');nav.className='chapter-tabs';nav.setAttribute('aria-label','Intake chapters');
 const pages=titles.map((title,i)=>{const page=document.createElement('section');page.className='story-page';const h=document.createElement('h2');h.textContent=title;h.tabIndex=-1;const p=document.createElement('p');p.className='chapter-note';p.textContent=notes[i];page.append(h,p);return page});
 for(const e of original){if(e.tagName==='BUTTON'&&e.type==='submit')phase=2;if(e.querySelector('#response'))phase=3;
 let target=phase;
 if(phase<2){const control=e.querySelector('input,select,textarea');const first=kind==='ruby'?['event_theme','timeline_era','backstory','format','game_length','difficulty']:['game_type','player_count'];target=control&&first.includes(control.name)?0:1;}
 pages[target].append(e);}
 const controls=document.createElement('div');controls.className='chapter-controls';const back=document.createElement('button');back.type='button';back.textContent='← Previous page';const progress=document.createElement('span');progress.setAttribute('aria-live','polite');const next=document.createElement('button');next.type='button';next.textContent='Next page →';controls.append(back,progress,next);
 form.prepend(header,nav);form.append(...pages,controls);if(status)form.append(status);form.classList.add('storybook-intake');form.noValidate=true;
 let current=Math.min(3,Math.max(0,Number(draft.chapter)||0));
 const tabs=titles.map((title,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${['I','II','III','IV'][i]} · ${title}`;b.onclick=()=>{if(i>current&&!validBefore(i))return;show(i)};nav.append(b);return b;});
 function save(){const values={};for(const e of form.querySelectorAll('input,select,textarea')){if(key(e))values[key(e)]={value:e.value,checked:e.checked};}try{sessionStorage.setItem(storage,JSON.stringify({values,chapter:current}))}catch{}}
 function show(i,focus=true){current=i;pages.forEach((p,n)=>p.hidden=n!==i);tabs.forEach((b,n)=>{b.setAttribute('aria-current',n===i?'step':'false')});back.disabled=i===0;next.hidden=i===3;progress.textContent=`Page ${i+1} of 4 · Answers kept in this tab`;if(focus)pages[i].querySelector('h2').focus({preventScroll:true});save();}
 function validBefore(end){for(let i=0;i<end;i++){for(const e of pages[i].querySelectorAll('input,select,textarea')){if(e.closest('[hidden]')&&e.closest('[hidden]')!==pages[i])continue;if(!e.checkValidity()){show(i);e.reportValidity();return false}}}return true;}
 back.onclick=()=>show(current-1);next.onclick=()=>{if(validBefore(current+1))show(current+1)};
 form.addEventListener('input',save);form.addEventListener('change',save);
 form.addEventListener('submit',e=>{if(current<2){e.preventDefault();e.stopImmediatePropagation();if(validBefore(current+1))show(current+1);return}if(!validBefore(2)){e.preventDefault();e.stopImmediatePropagation();return}setTimeout(save,0)},true);
 show(current,false);
}
