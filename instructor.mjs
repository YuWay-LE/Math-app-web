const schoolLabels={not_started:'Noch nicht begonnen',started:'Begonnen',current:'Aktuell',completed:'Abgeschlossen'};
const missionLabels={planned:'Vorbereitet',active:'In Arbeit',completed:'Abgeschlossen',abandoned:'Abgebrochen',cancelled:'Aufgehoben'};
const taskLabels={pending:'Noch offen',active:'In Arbeit',completed:'Bearbeitet',skipped:'Übersprungen'};
const correctness={correct:'Richtig',partial:'Teilweise richtig',incorrect:'Noch nicht richtig',not_answered:'Nicht beantwortet'};
const types={retrieval:'Wiederholung',worked_example:'Durchgerechnetes Beispiel',faded_example:'Rechenweg mit Lücken',standard_independent:'Selbstständige Aufgabe',representation_switch:'Andere Darstellung',modelling_translation:'Text in Mathematik übersetzen',error_analysis:'Fehler finden',transfer_challenge:'Neue Anwendung'};
const pad=v=>String(v).padStart(2,'0');
function pauseText(v){if(!v)return '';const d=new Date(v);return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function parsePause(v){if(!v.trim())return null;const m=/^(\d{2})\.(\d{2})\.(\d{4}),? (\d{2}):(\d{2})$/.exec(v.trim());if(!m)throw new Error('Bitte das Pausenende als TT.MM.JJJJ, HH:MM eingeben.');const [,day,month,year,hour,minute]=m.map(Number),d=new Date(year,month-1,day,hour,minute);if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day||d.getHours()!==hour||d.getMinutes()!==minute)throw new Error('Bitte ein gültiges Pausenende eingeben.');return d.toISOString();}
const date=v=>v?new Date(v).toLocaleString('de-AT',{dateStyle:'medium',timeStyle:'short'}):'Noch nicht vorhanden';
export function reviewAnswerText(payload,prompt){
 const response=payload.response??payload.answer??payload;
 if(response==='__worked_ack__')return 'Beispiel durchgearbeitet';
 const option=prompt.options?.find(o=>o.id===response);
 return option?option.text_de:typeof response==='string'?response:JSON.stringify(response);
}
export function createInstructorUI({api,el,add,button,clear,banner,content,run,notice}){
 let user,includeTest=false,student=null,students=[],tab='overview';
 const call=(action,body={})=>api('instructor/'+action,{...body,student_id:student.id});
 function options(values,selected,id){const select=el('select',null,{id});for(const [value,title]of Object.entries(values))select.append(el('option',title,{value}));select.value=selected;return select;}
 function card(title){return add(el('section',null,{class:'card'}),el('h2',title));}
 function list(parent,values,empty){if(!values.length)parent.append(el('p',empty,{class:'muted'}));else{const ul=el('ul');for(const v of values)ul.append(el('li',v));parent.append(ul);}}
 function frame(title,description){clear();banner(title,description);appRoot().append(button('Zur Schülerübersicht',dashboard,'quiet'));}
 function appRoot(){return document.querySelector('#app');}
 async function dashboard(){
  students=await api('instructor/students',{include_test:includeTest});student=students.find(s=>s.id===student?.id)??students[0]??null;
  const data=student?await call('dashboard'):null;clear();banner('Lernen begleiten.',`${user.name_de} · Aufgaben und Fortschritt im Blick.`);
  const selection=card('Schüler auswählen'),toggle=el('input',null,{type:'checkbox',id:'include-test'});toggle.checked=includeTest;
  toggle.addEventListener('change',()=>run(async()=>{includeTest=toggle.checked;student=null;await dashboard();}));
  const label=add(el('label',null,{class:'check-label'}),toggle,el('span','TEST-Konto anzeigen'));selection.append(label);
  if(student){const select=options(Object.fromEntries(students.map(s=>[s.id,s.display_name+(s.is_test?' · Testkonto':'')])),student.id,'student');select.addEventListener('change',()=>run(async()=>{student=students.find(s=>s.id===select.value);await dashboard();}));add(selection,el('label','Schülerkonto',{for:'student'}),select,el('p',student.permission==='manage'?'Verwaltung: Du kannst Schulstand und Übungseinstellungen ändern.':'Nur Lesen: Du kannst Aufgaben und Ergebnisse ansehen.',{class:'muted permission'}));}
  else selection.append(el('p','Keine verknüpften Schülerkonten in dieser Auswahl.'));
  appRoot().append(selection);if(!data)return;
  const nav=el('nav',null,{class:'row tabs','aria-label':'Begleitansicht'});
  for(const [key,label]of [['overview','Fortschritt'],['tasks','Aufgaben'],['school','Schulstand']]){const b=button(label,async()=>{tab=key;await dashboard();},tab===key?'':'quiet');b.setAttribute('aria-pressed',String(tab===key));nav.append(b);}appRoot().append(nav);
  if(tab==='overview')overview(data);if(tab==='tasks')await tasks(data);if(tab==='school')school(data);
 }
 function overview(data){
  const week=card('Die letzten 7 Tage');
  for(const [title,values,empty]of [['Geübt',data.weekly.trained_de,'In diesem Zeitraum wurden noch keine Aufgaben bearbeitet.'],['Fortschritte',data.weekly.improved_de,'Noch kein höherer Lernstand durch Nachweise bestätigt.'],['Weiter unterstützen',data.weekly.needs_help_de,'Derzeit keine bestätigten offenen Förderhinweise.']]){week.append(el('h3',title));list(week,values,empty);}
  add(week,el('h3','Nächster Schritt'),el('p',data.weekly.next_de),el('small',`Stand: ${date(data.as_of)}`));appRoot().append(week,el('h2','Lernziele'));
  for(const s of data.skills){const box=add(el('section',null,{class:'skill-row'}),el('h3',s.title_de),el('p',`${s.state_de} · Sicherheit der Einschätzung: ${s.confidence_de}`,{class:'muted'}),el('p',s.reason_de.join(' ')),button('Details ansehen',()=>skill(s.id),'quiet'));appRoot().append(box);}
 }
 async function skill(id){const s=await call('skill',{skill_id:id});frame(s.title_de,s.description_de);const details=card('Lernstand');
  for(const [label,value]of [['Stand',s.state_de],['Sicherheit der Einschätzung',s.confidence_de],['Genauigkeit',s.accuracy_de],['Fehlerschwerpunkt',s.dominant_error_de],['Zuletzt geübt',date(s.last_practiced_at)],['Wiederholung fällig',date(s.due_at)]])details.append(add(el('p'),el('strong',label+': '),el('span',value)));
  add(details,el('p',s.prior_de),el('h3',`Warum übt ${student.display_name} das?`));list(details,s.reason_de,'');for(const d of s.dependencies)details.append(el('p',`${d.reason_de} Benötigter Stand: ${d.minimum_de}.`,{class:'muted'}));
  appRoot().append(details);const evidence=card('Nachweise aus Aufgaben');evidence.append(el('p','Gezählt werden bewertete Nachweise, keine Beherrschungs-Prozente. Mehrere Dimensionen können zur selben Antwort gehören.',{class:'muted'}));
  for(const d of s.dimensions)evidence.append(add(el('div',null,{class:'evidence-row'}),el('strong',d.title_de),el('span',`${d.positive} stärkend · ${d.negative} abschwächend · ${d.neutral} ohne Änderung`)));appRoot().append(evidence);
  const controls=card('Übungseinstellungen');
  if(student.permission==='manage'){
   const form=el('form'),bias=options({reduced:'Weniger üben',normal:'Normal üben',increased:'Mehr üben'},s.control.practice_bias,'bias'),pause=el('input',null,{id:'pause',type:'text',placeholder:'TT.MM.JJJJ, HH:MM',maxlength:'17'}),note=el('textarea',s.control.note_de??'',{id:'skill-note',maxlength:'2000',rows:'3'});
   pause.value=pauseText(s.control.paused_until);
   add(form,el('label','Übungshäufigkeit',{for:'bias'}),bias,el('label','Pausiert bis (leer = nicht pausiert)',{for:'pause'}),pause,el('label','Notiz',{for:'skill-note'}),note,el('button','Einstellungen speichern',{type:'submit'}));
   form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{const r=await call('control',{skill_id:id,practice_bias:bias.value,paused_until:parsePause(pause.value),note_de:note.value});await skill(id);notice.textContent=r.message_de;});});controls.append(form);
   controls.append(button(s.control.force_diagnostic?'Diagnoseanfrage zurücknehmen':'Diagnose anfordern',async()=>{const r=await call('control',{skill_id:id,force_diagnostic:!s.control.force_diagnostic});await skill(id);notice.textContent=r.message_de;},'quiet'));
  }else list(controls,[{normal:'Normal üben',reduced:'Weniger üben',increased:'Mehr üben'}[s.control.practice_bias],s.control.paused_until?'Pausiert bis '+date(s.control.paused_until):'Nicht pausiert',s.control.force_diagnostic?'Diagnose angefordert':'Keine Diagnose angefordert',s.control.note_de??'Keine Notiz hinterlegt.'],'');
  controls.append(el('p','Übungseinstellungen verändern keine Nachweise und setzen keinen Lernstand. Eine Diagnose wird erst in einer passenden Mission wirksam.',{class:'muted'}));appRoot().append(controls);
  const history=card('Letzte Antworten');if(!s.attempts.length)history.append(el('p','Noch keine Antworten vorhanden.'));for(const a of s.attempts)history.append(button(`${date(a.submitted_at)} · ${correctness[a.correctness]} · Hilfe H${a.max_hint_level}`,()=>task(a.mission_item_id),'quiet history-button'));appRoot().append(history);
 }
 async function tasks(data){
  const bank=card('Aufgaben ansehen');bank.append(el('p','Aufgaben und Hinweise prüfen, ohne Schülerergebnisse zu verändern. Zum interaktiven Ausprobieren bitte mit TEST anmelden.'));
  const families=await call('families');const select=options(Object.fromEntries(families.map((f,n)=>[f.code,`${f.title_de} · ${types[f.exercise_type]} (${n+1})`])),families[0]?.code,'family');
  if(families.length)add(bank,el('label','Aufgabe',{for:'family'}),select,button('Vorschau ansehen',()=>preview(select.value)));else bank.append(el('p','Noch keine Aufgaben freigegeben.'));appRoot().append(bank);
  if(student.permission==='manage'){
   const check=card('Lernstandscheck'),duration=options({'10':'10 Minuten','20':'20 Minuten','30':'30 Minuten'},'20','check-duration');
   add(check,el('p','Für das nächste aktuelle Lernziel. Benötigte Grundlagen und Lernschritte behalten Vorrang. Eine offene Mission muss vorher abgeschlossen oder im Schülerkonto abgebrochen werden.'),el('label','Geplante Dauer',{for:'check-duration'}),duration,button('Lernstandscheck vorbereiten',async()=>{const r=await call('checkpoint',{duration_min:Number(duration.value)});await dashboard();notice.textContent=r.message_de??r.reason_de;}));appRoot().append(check);
  }
  appRoot().append(el('h2','Letzte 20 Missionen'));if(!data.missions.length)appRoot().append(el('p','Noch keine Mission vorhanden.'));
  for(const m of data.missions){const box=card(`${date(m.created_at)} · ${missionLabels[m.status]}`);add(box,el('p',m.reason_summary_de),button('Aufgaben dieser Mission',()=>mission(m.id),'quiet'));appRoot().append(box);}
 }
 async function preview(code){const p=await call('preview',{family_code:code,seed:7});frame('Aufgabenvorschau',p.message_de);const c=card('Aufgabe');content(c,p.prompt);if(p.prompt.worked_solution_de)c.append(el('p',p.prompt.worked_solution_de));if(p.prompt.options)list(c,p.prompt.options.map(o=>o.text_de),'');c.append(el('p',p.prompt.answer_instruction_de??'',{class:'muted'}));
  const details=el('details');details.append(el('summary','Hinweise und Erklärung ansehen'));p.hints_de.forEach((h,n)=>{const box=add(el('div',null,{class:'hint'}),el('strong',`Hinweis ${n+1}`));content(box,h);details.append(box);});c.append(details);appRoot().append(c);}
 async function mission(id){const m=await call('mission',{mission_id:id});frame('Mission ansehen',m.reason_summary_de);for(const t of m.items){const c=card(`${t.position}. ${t.title_de}`);add(c,el('p',taskLabels[t.status]),el('p',t.inserted_reason_de),button('Aufgabe und Antworten',()=>task(t.id),'quiet'));appRoot().append(c);}}
 async function task(id){const t=await call('task',{mission_item_id:id});frame(t.title_de,'Nur Ansicht · Schülerergebnisse bleiben unverändert.');const c=card('Aufgabe');content(c,t.prompt);if(t.prompt.worked_solution_de)c.append(el('p',t.prompt.worked_solution_de));if(t.prompt.options)list(c,t.prompt.options.map(o=>o.text_de),'');add(c,el('p',t.prompt.answer_instruction_de??'',{class:'muted'}),el('h3','Warum diese Aufgabe?'),el('p',t.reason_de));appRoot().append(c);
  const answers=card('Antworten');if(!t.attempts.length)answers.append(el('p','Noch keine Antwort abgegeben.'));for(const a of t.attempts){const d=el('div',null,{class:'answer-review'});const response=reviewAnswerText(a.response_payload,t.prompt);
   add(d,el('h3',`Versuch ${a.attempt_number} · ${correctness[a.correctness]}`),el('p',response),el('p',a.feedback_de),el('p',`Hilfe H${a.max_hint_level} · ${date(a.submitted_at)}`,{class:'muted'}));
   list(d,a.support_trace.map(h=>h.kind==='protocol'?`Einstieg ${h.step}: ${h.text_de}`:`Hinweis H${h.level} verwendet`),'Keine zusätzlichen Hilfen angefordert.');answers.append(d);}appRoot().append(answers);
 }
 function school(data){
  appRoot().append(el('p','AHS 5 · vollständiger Lernweg. Schulstand = Stand in der Klasse; Lernstand = durch App-Nachweise belegte Selbstständigkeit. Schulstand allein bedeutet keine Beherrschung.',{class:'muted'}));
  const contentLabels={available:'Lernaufgaben verfügbar',maintenance:'Wiederholung verfügbar',unreleased:'Noch nicht freigegeben'};
  let chapter=null;
  for(const u of data.school){
   if(chapter!==u.chapter_no){chapter=u.chapter_no;appRoot().append(el('h2',`${u.chapter_no}. ${u.chapter_title_de}`));}
   const c=card(`${u.unit_code.replace('LW5-','')} ${u.title_de}`);
   add(c,el('p',`Schulstand: ${schoolLabels[u.status]}`),el('p',`Lernstand: ${u.learning_state_de??'—'}`),el('p',`App-Inhalt: ${contentLabels[u.content_status]}`));
   if(u.content_status==='unreleased')c.append(el('p','Dieser Abschnitt kann als Schulstand dokumentiert werden, erzeugt aber noch keine Lernmission.',{class:'muted'}));
   if(student.permission!=='manage'){add(c,el('p','Priorität: '+['Niedrig','Normal','Hoch'][u.priority]),el('p',u.admin_note_de??'Keine Notiz.'));}
   else{const form=el('form'),status=options(schoolLabels,u.status,'status-'+u.id),priority=options({'0':'Niedrig','1':'Normal','2':'Hoch'},String(u.priority),'priority-'+u.id),note=el('textarea',u.admin_note_de??'',{id:'note-'+u.id,maxlength:'2000',rows:'2'});
    add(form,el('label','Schulstand',{for:status.id}),status,el('label','Priorität',{for:priority.id}),priority,el('label','Schul- oder Hausübungsnotiz',{for:note.id}),note,el('button','Schulstand speichern',{type:'submit'}));form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{const r=await call('school',{unit_id:u.id,status:status.value,priority:Number(priority.value),note_de:note.value});await dashboard();notice.textContent=r.message_de;});});c.append(form);}
   c.append(el('small','Zuletzt geändert: '+date(u.updated_at)));appRoot().append(c);
  }
 }
 return {open:async(session,previewMode)=>{user=session;student=null;tab='overview';includeTest=previewMode;await dashboard();}};
}
