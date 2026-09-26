const scope=new URL('.',import.meta.url).pathname;
const SESSION_KEY='math-session'+(scope==='/'?'':scope),PENDING_KEY='math-pending'+(scope==='/'?'':scope);
import {API_BASE} from './config.mjs';
import {createInstructorUI} from './instructor.mjs';
const app=document.querySelector('#app'),notice=document.querySelector('#notice'),logout=document.querySelector('#logout');
let auth=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'),preview=false,busy=false,mission=null;
const drafts=new Map(),blobs=[];
function el(tag,text,attrs={}){const e=document.createElement(tag);if(text!==null&&text!==undefined)e.textContent=text;for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function add(parent,...nodes){for(const n of nodes.flat())if(n)parent.append(n);return parent;}
function button(text,fn,cls=''){const b=el('button',text,{type:'button',class:cls});b.addEventListener('click',()=>run(fn));return b;}
function clear(){blobs.splice(0).forEach(URL.revokeObjectURL);app.replaceChildren();notice.textContent='';logout.hidden=!auth;if(preview)app.append(el('p','Lokale TEST-Vorschau · Keine Ergebnisse von Maxim oder anderen Schülern.',{class:'preview'}));}
function saveAuth(v){auth=v;if(v)sessionStorage.setItem(SESSION_KEY,JSON.stringify(v));else sessionStorage.removeItem(SESSION_KEY);}
async function run(fn){if(busy)return;busy=true;notice.textContent='';document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){notice.textContent=e.message||'Das hat gerade nicht funktioniert.';}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function request(path,body,token=auth?.access_token){
 let r;try{r=await fetch(API_BASE+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}catch{throw new Error('Keine Verbindung. Deine Eingabe bleibt hier. Bitte versuche es erneut, sobald du online bist.');}
 const data=await r.json();if(!r.ok){const e=new Error(data.message_de);e.status=r.status;throw e;}return data;
}
async function api(action,body={}){
 const key=action+':'+JSON.stringify(body);let pending=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'{}');
 if(['create','submit','support','instructor/checkpoint'].includes(action)){pending[key]??=crypto.randomUUID();body={...body,request_id:pending[key]};sessionStorage.setItem(PENDING_KEY,JSON.stringify(pending));}
 let result;try{result=await request(action,body);}catch(e){if(e.status!==401||!auth?.refresh_token)throw e;saveAuth(await request('refresh',{refresh_token:auth.refresh_token},null));result=await request(action,body);}
 delete pending[key];sessionStorage.setItem(PENDING_KEY,JSON.stringify(pending));return result;
}
function banner(title,desc){app.append(el('p','DEIN MATHEWEG',{class:'eyebrow'}),el('h1',title),el('p',desc,{class:'lead'}));}
async function login(){clear();banner('Schritt für Schritt.','Wähle dein Konto und melde dich an.');const card=el('section',null,{class:'card'}),form=el('form'),select=el('select',null,{id:'account',required:''});
 const accounts=await fetch(API_BASE+'accounts',{cache:'no-store'}).then(r=>r.json());for(const a of accounts)select.append(el('option',`${a.display_name} · ${a.account_label_de}`,{value:a.login_key}));
 const pw=el('input',null,{id:'password',type:'password',autocomplete:'current-password',required:''});
 add(form,el('label','Konto',{for:'account'}),select);if(!preview)add(form,el('label','Passwort',{for:'password'}),pw);
 const submit=el('button',preview?'Vorschau öffnen':'Anmelden',{type:'submit'});form.append(submit);
 form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{saveAuth(await request('login',{login_key:select.value,password:pw.value},null));pw.value='';sessionStorage.removeItem(PENDING_KEY);await home();});});
 add(card,form);app.append(card);}
const instructor=createInstructorUI({api,el,add,button,clear,banner,content,run,notice});
async function home(){const session=await api('instructor/session');if(session.role==='admin')return instructor.open(session,preview);const data=await api('home');clear();banner(`Hallo, ${data.name_de}.`,'Ein Lernziel. Passende Aufgaben. Hilfe bei jedem Schritt.');
 const card=el('section',null,{class:'card'});add(card,el('span','HEUTE',{class:'eyebrow'}),el('h2','Heutige Mission'));
 if(data.mission){add(card,el('p',data.mission.reason_de),el('p',`Etwa ${data.mission.duration_min} Minuten · ${data.mission.completed_count} Aufgaben bearbeitet`,{class:'muted'}),button(data.mission.status==='planned'?'Mission starten':'Weiterüben',async()=>{mission=await api(data.mission.status==='planned'?'start':'get',{mission_id:data.mission.id});showMission(mission);}));}
 else{add(card,el('p','Wie viel Zeit möchtest du dir nehmen?'));let duration=data.default_duration_min;const durations=el('div',null,{class:'duration','aria-label':'Übungsdauer'});
  for(const n of [10,20,30]){const b=button(`${n} Min.`,()=>{duration=n;durations.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});b.setAttribute('aria-pressed',String(n===duration));durations.append(b);}card.append(durations);
  card.append(button('Mission vorbereiten',async()=>{const m=await api('create',{duration_min:duration});if(m.status==='unavailable'){notice.textContent=m.message_de;return;}mission=await api('start',{mission_id:m.id});showMission(mission);}));}
 app.append(card);
 if(data.progress.length){app.append(el('h2','Dein Lernstand'));for(const p of data.progress)app.append(add(el('div',null,{class:'progress-row'}),el('span',p.title_de),el('span',p.status_de)));}
 app.append(el('p','Du kannst jederzeit eine Pause machen und später weiterüben.',{class:'muted'}));}
function content(parent,p){
 if(p.text_de)parent.append(el('p',p.text_de,{class:'task-text'}));
 if(p.table_de){const t=el('table'),head=el('tr');p.table_de.headers.forEach(h=>head.append(el('th',String(h),{scope:'col'})));t.append(add(el('thead'),head));const body=el('tbody');for(const row of p.table_de.rows){const tr=el('tr');row.forEach(c=>tr.append(el('td',String(c))));body.append(tr);}t.append(body);parent.append(t);}
 const svg=p.graph_svg??p.graph?.svg;
 if(svg){const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));blobs.push(url);parent.append(el('img',null,{src:url,alt:'Koordinatensystem mit beschrifteten Achsen und einer Geraden',class:'graph'}));}
}
function showMission(m){mission=m;clear();
 if(m.status==='completed'){banner('Für heute geschafft.','Deine Ergebnisse sind gespeichert.');const card=el('section',null,{class:'card soft'});m.summary_de.slice(0,3).forEach(s=>card.append(el('p',s)));app.append(card,button('Zur Übersicht',home));return;}
 const t=m.task;banner(t?.title_de??'Deine Mission','Arbeite in deinem Tempo. Hilfe gehört zum Lernen.');
 const info=el('div',null,{class:'row spread'});add(info,el('span',`${m.completed_count} ${m.completed_count===1?'Aufgabe':'Aufgaben'} bearbeitet`,{class:'tag'}),button('Pause machen',home,'quiet'));app.append(info);
 if(!t){app.append(button('Weiter',async()=>showMission(await api('next',{mission_id:m.id}))));return;}
 const card=el('section',null,{class:'card'});content(card,t.prompt);
 if(t.prompt.worked_solution_de){add(card,el('h2','So geht der Rechenweg'),el('p',t.prompt.worked_solution_de));}
 const detail=el('details');add(detail,el('summary','Warum übe ich das?'),el('p',t.reason_de));card.append(detail);
 const form=el('form'),answer=drafts.get(t.id)??'';let value=()=>answer;
 if(t.status==='active'&&!t.prompt.worked_solution_de){
  if(t.prompt.options){const group=el('fieldset',null,{class:'options'});group.append(el('legend',t.prompt.answer_instruction_de));for(const o of t.prompt.options){const label=el('label',null,{class:'option'}),radio=el('input',null,{type:'radio',name:'answer',value:o.id,required:''});radio.checked=answer===o.id;radio.addEventListener('change',()=>drafts.set(t.id,o.id));add(label,radio,el('span',o.text_de));group.append(label);}form.append(group);value=()=>form.querySelector('input:checked')?.value??'';
  }else{const input=el('input',null,{id:'answer',autocomplete:'off',autocapitalize:'off',spellcheck:'false',required:''});input.value=answer;input.addEventListener('input',()=>drafts.set(t.id,input.value));add(form,el('label','Deine Antwort',{for:'answer'}),input,el('p',t.prompt.answer_instruction_de,{class:'muted'}));value=()=>input.value;}
 }
 if(t.status==='active'){form.append(el('button',t.prompt.worked_solution_de?'Beispiel durchgearbeitet':'Prüfen',{type:'submit'}));form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{
   const response=t.prompt.worked_solution_de?'__worked_ack__':value();if(!response.trim())return;
   const r=await api('submit',{mission_item_id:t.id,response});if(r.status!=='saved'){notice.textContent=r.feedback_de;return;}showMission(await api('get',{mission_id:m.id}));
  });});card.append(form);}
 if(t.feedback_de){const f=el('div',null,{class:'feedback','data-correct':String(t.correctness==='correct'),role:'status'});add(f,el('strong',t.correctness==='correct'?'Das stimmt.':'Schauen wir uns das an.'),el('p',t.feedback_de));card.append(f);}
 const support=el('div',null,{class:'row actions'});add(support,button(t.support.some(h=>h.kind==='hint')?'Nächster Hinweis':'Hinweis',async()=>{await api('support',{mission_item_id:t.id,kind:'hint'});showMission(await api('get',{mission_id:m.id}));},'support-btn'),
  button('Ich weiß nicht, wie ich anfangen soll',async()=>{await api('support',{mission_item_id:t.id,kind:'protocol'});showMission(await api('get',{mission_id:m.id}));},'quiet'));card.append(support);
 for(const h of t.support){const box=el('div',null,{class:'hint'});box.append(el('strong',h.kind==='protocol'?`Dein Einstieg · Schritt ${h.step} von 5`:`Hinweis ${h.level} von 6`));content(box,h);card.append(box);}
 app.append(card);
 if(t.status==='completed'){
  const actions=el('div',null,{class:'row actions'});
  if(m.remaining_count===0||m.can_finish_early)add(actions,button('Mission abschließen',async()=>showMission(await api('complete',{mission_id:m.id,early:m.can_finish_early===true}))));
  if(m.remaining_count>0)actions.append(button('Nächste Aufgabe',async()=>showMission(await api('next',{mission_id:m.id}))));
  if(m.can_try_exit)actions.append(button('Abschlussaufgabe versuchen',async()=>showMission(await api('exit',{mission_id:m.id})),'quiet'));
  app.append(actions);
 }
 const end=el('details');add(end,el('summary','Mission beenden'),el('p','Du kannst stattdessen eine Pause machen. Dann bleibt die Mission zum Weiterüben offen.'),button('Mission abbrechen',async()=>{if(!confirm('Möchtest du diese Mission abbrechen? Deine bisherigen Antworten bleiben gespeichert.'))return;await api('abandon',{mission_id:m.id});await home();},'quiet'));app.append(end);
}
logout.addEventListener('click',()=>run(async()=>{try{await api('logout');}finally{saveAuth(null);drafts.clear();sessionStorage.removeItem(PENDING_KEY);await login();}}));
window.addEventListener('offline',()=>{notice.textContent='Du bist offline. Zum Prüfen und Speichern brauchst du eine Verbindung.';});
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:'./'}).catch(()=>{});
run(async()=>{preview=(await fetch(API_BASE+'config').then(r=>r.json())).preview;if(auth)try{await home();}catch(e){if(e.status===401){saveAuth(null);await login();}else throw e;}else await login();});
