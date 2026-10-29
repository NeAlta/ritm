/* Ритм · Семьи — общие данные через закрытые репозитории GitHub. Версия 2: несколько семей.
   Подключается в Android- и iPhone-сборках ПЕРЕД кодом приложения (в <head>).

   Семья = закрытый репозиторий (repo + папка) + ключ доступа GitHub + семейный ключ шифрования.
   Каждый участник пишет только свой файл <папка>/<memberId>.json и читает файлы остальных.
   Содержимое шифруется AES-GCM на телефоне — GitHub видит только шифр.

   Каждая запись приложения либо личная (без отметки), либо принадлежит одной семье: fam = <id семьи>.
   - Цели: задачи (fam, who = 'all' | id участника | 'g:<группа>') — в обе стороны;
   - Деньги: платежи (fam) — в обе стороны; траты (fam) — только чтение у остальных;
   - Питание: покупки и продукты дома — целиком с одной «домашней» семьёй (кроме покупок «только мне»);
   - Тело: итоги тренировок — по желанию в каждой семье.
   Слияние — «последняя правка побеждает» по каждой записи; удаления передаются метками. */
(function(){
'use strict';
if(typeof window==='undefined'||window.Fam) return;
const CFG_K='ritm-family-cfg', DATA_P='ritm-family-data-', LOCK_K='ritm-family-lock', REBASE_K='ritm-family-rebase';
const API='https://api.github.com/repos/';
const COLORS=[['#F0643C','Коралловый'],['#2FA36B','Зелёный'],['#6E63F2','Индиго'],['#E5577F','Розовый'],['#2B8CC4','Синий'],['#E0A22E','Золотой']];
const PAGE=Math.random().toString(36).slice(2);
const WATCH=['ritm-pit-state-v1','ritm-tseli-state-v1','ritm-dengi-state-v1','ritm-dengi-b-v1','ritm-telo-workouts-v1'];
const USERS='<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.13a4 4 0 0 1 0 7.75M22 21v-1a6 6 0 0 0-4-5.65"/>';

/* ---------- мелочи ---------- */
function jget(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } }
function jset(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
function raw(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function del(k){ try{ localStorage.removeItem(k); }catch(e){} }
function rid(p){ return p+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4); }
function dk(d){ d=d||new Date(); const z=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); }
function addD(k,n){ const p=k.split('-').map(Number); return dk(new Date(p[0],p[1]-1,p[2]+n,12)); }
function escH(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fnv(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36)+':'+s.length; }
const te=new TextEncoder(), td=new TextDecoder();
function b64e(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
function b64d(s){ const b=atob(s); const u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
function toUrl(s){ return s.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function fromUrl(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return s; }

/* ---------- настройки ----------
   cfg = {v:2, list:[семья…], cur:<id>, pit:<id семьи с общими покупками>|null}
   семья = {id, repo, dir, token, key, name, me, mname, color, share:{body}, joined} */
function cfgAll(){ const c=jget(CFG_K); if(!c||!Array.isArray(c.list)) return {v:2,list:[],cur:null,pit:null}; return c; }
function setAll(c){ if(c.list.length&&!c.list.some(f=>f.id===c.cur)) c.cur=c.list[0].id; if(c.pit&&!c.list.some(f=>f.id===c.pit)) c.pit=null; if(!c.list.length){ c.cur=null; c.pit=null; } jset(CFG_K,c); }
function fam(id){ const c=cfgAll(); return c.list.find(f=>f.id===(id||c.cur))||null; }
function famList(){ return cfgAll().list; }
function load(fid){ const d=jget(DATA_P+fid)||{}; d.F=d.F||{}; d.snap=d.snap||{}; d.cache=d.cache||{}; return d; }
function save(fid,D){ jset(DATA_P+fid,D); }
function setting(fid,key){ const D=load(fid); const f=D.F.settings&&D.F.settings[key]; return f&&!f.x?f.d:null; }

/* ---------- шифрование ---------- */
const keys={};
async function aesKey(f){ if(keys[f.id]&&keys[f.id].raw===f.key) return keys[f.id].k; const k=await crypto.subtle.importKey('raw',b64d(f.key),{name:'AES-GCM'},false,['encrypt','decrypt']); keys[f.id]={raw:f.key,k}; return k; }
async function seal(f,obj){ const iv=crypto.getRandomValues(new Uint8Array(12)); const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(f),te.encode(JSON.stringify(obj)))); return JSON.stringify({ritm:'family',v:2,iv:b64e(iv),ct:b64e(ct)}); }
async function unseal(f,text){ const e=JSON.parse(text); if(!e||e.ritm!=='family'||!e.iv||!e.ct) throw new Error('format'); const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(e.iv)},await aesKey(f),b64d(e.ct)); return JSON.parse(td.decode(pt)); }

/* ---------- GitHub ---------- */
class FamErr extends Error{ constructor(code,msg){ super(msg); this.code=code; } }
async function gh(f,method,path,body,accept){
 try{ return await fetch(API+f.repo+path,{method,cache:'no-store',headers:Object.assign({Authorization:'Bearer '+f.token,Accept:accept||'application/vnd.github+json'},body?{'Content-Type':'application/json'}:{}),body:body?JSON.stringify(body):undefined}); }
 catch(e){ throw new FamErr('net','Нет связи с GitHub — синхронизируем, когда появится интернет'); } }
function httpErr(r){
 if(r.status===401) return new FamErr('auth','Ключ доступа не подходит или истёк — обновите его в «Семье»');
 if(r.status===403||r.status===429){ if(r.headers&&r.headers.get('x-ratelimit-remaining')==='0') return new FamErr('rate','GitHub временно ограничил запросы — попробуем позже'); return new FamErr('perm','У ключа нет права записи: в настройках ключа нужно Contents — Read and write'); }
 if(r.status===404) return new FamErr('nf','Репозиторий не найден или ключ не даёт к нему доступа');
 return new FamErr('http','GitHub ответил ошибкой '+r.status); }
async function ghRepo(f){ const r=await gh(f,'GET',''); if(!r.ok) throw httpErr(r); return r.json(); }
async function ghList(f){ const r=await gh(f,'GET','/contents/'+f.dir); if(r.status===404) return []; if(!r.ok) throw httpErr(r); const a=await r.json(); return Array.isArray(a)?a.filter(x=>x&&x.type==='file'&&/^m[a-z0-9]+\.json$/.test(x.name)):[]; }
async function ghRaw(f,name){ const r=await gh(f,'GET','/contents/'+f.dir+'/'+name,null,'application/vnd.github.raw+json'); if(!r.ok) throw httpErr(r); return r.text(); }
async function ghPut(f,name,text,sha,msg){
 const put=s=>gh(f,'PUT','/contents/'+f.dir+'/'+name,Object.assign({message:msg,content:btoa(text)},s?{sha:s}:{}));
 let r=await put(sha);
 if(r.status===409||r.status===422){ const x=(await ghList(f)).find(y=>y.name===name); r=await put(x?x.sha:null); }
 if(!r.ok) throw httpErr(r); const j=await r.json(); return j&&j.content?j.content.sha:null; }

/* ---------- чья запись ---------- */
function scopeOf(x){ if(!x||!x.fam) return null; if(x.fam===true){ const c=cfgAll(); return c.cur||(c.list[0]&&c.list[0].id)||null; } return x.fam; }
function inFam(fid){ return x=>scopeOf(x)===fid; }

/* ---------- коллекции, общие в обе стороны ---------- */
function twoFor(fid){ const pit=cfgAll().pit===fid; const L={};
 if(pit){ L.shop={key:'ritm-pit-state-v1',arr:'shop',pick:x=>!!x&&!x.priv}; L.home={key:'ritm-pit-state-v1',arr:'home',pick:x=>!!x&&!x.priv}; }
 L.tasks={key:'ritm-tseli-state-v1',arr:'tasks',pick:inFam(fid),out:t=>{ const o=Object.assign({},t); delete o.goal; o.fam=fid; return o; },in:(d,old)=>Object.assign({},d,{fam:fid,goal:old&&old.goal||null})};
 L.pays={key:'ritm-dengi-state-v1',arr:'pays',pick:p=>inFam(fid)(p)&&!p.fresh,out:p=>{ const o=Object.assign({},p); delete o.acc; o.fam=fid; return o; },in:(d,old,st)=>Object.assign({},d,{fam:fid,acc:old&&old.acc||(st.accs&&st.accs[0]&&st.accs[0].id)||'card'})};
 return L; }
function norm(c,x){ const o=c.out?c.out(x):Object.assign({},x); delete o.fa; return o; }
function collectTwo(fid,D,now,me){
 for(const [name,c] of Object.entries(twoFor(fid))){ const st=jget(c.key); if(!st) continue;
  const arr=(Array.isArray(st[c.arr])?st[c.arr]:[]).filter(c.pick); const snap=D.snap[name]||{}; const coll=D.F[name]||(D.F[name]={}); const seen=new Set();
  for(const x of arr){ if(!x||!x.id) continue; seen.add(x.id); const d=norm(c,x); if(snap[x.id]!==JSON.stringify(d)){ const p=coll[x.id]; coll[x.id]={id:x.id,d,u:now,b:me,c:p&&p.c||now,a:p&&p.a||me}; } }
  for(const id of Object.keys(snap)) if(!seen.has(id)){ const p=coll[id]; if(!p||!p.x) coll[id]={id,x:1,u:now,b:me,c:p&&p.c||now,a:p&&p.a||me}; } } }
function applyTwo(fid,D,me){ const states={}; const touched=[];
 for(const [name,c] of Object.entries(twoFor(fid))){ const coll=D.F[name]||{};
  let st=states[c.key]; if(!st){ st=jget(c.key); if(!st){ if(!Object.values(coll).some(f=>!f.x)) continue; st={v:1,setup:false}; } states[c.key]=st; }
  const arr=Array.isArray(st[c.arr])?st[c.arr]:[]; const keep=arr.filter(x=>!c.pick(x)); const mine=arr.filter(c.pick); const ids=new Set(arr.map(x=>x&&x.id)); const out=[];
  const mk=(f,old)=>{ const n=c.in?c.in(f.d,old,st):Object.assign({},f.d); if(f.a&&f.a!==me) n.fa=f.a; else delete n.fa; return n; };
  for(const x of mine){ const f=coll[x.id]; if(f&&f.x) continue; out.push(f?mk(f,x):x); }
  /* новые записи семьи; запись с тем же id, ставшая у нас личной или другой семьи, не перезаписывается */
  for(const f of Object.values(coll).filter(f=>!f.x&&f.d&&!ids.has(f.id)).sort((a,b)=>(a.c||0)-(b.c||0))) out.push(mk(f,null));
  st[c.arr]=keep.concat(out);
  const snap={}; for(const x of out) if(coll[x.id]) snap[x.id]=JSON.stringify(norm(c,x)); D.snap[name]=snap; }
 for(const [k,st] of Object.entries(states)){ const t=JSON.stringify(st); if(raw(k)!==t){ try{ localStorage.setItem(k,t); touched.push(k); }catch(e){} } }
 return touched; }

/* ---------- свои записи (только чтение у остальных) ---------- */
function own(D,name,id,d,now,me){ const coll=D.F[name]||(D.F[name]={}); const p=coll[id]; if(p&&!p.x&&JSON.stringify(p.d)===JSON.stringify(d)) return; coll[id]={id,d,u:now,b:me,c:p&&p.c||now,a:me}; }
function drop(D,name,id,now,me){ const coll=D.F[name]||{}; const p=coll[id]; if(p&&!p.x&&(p.a===me||name==='settings')) coll[id]={id,x:1,u:now,b:me,c:p.c,a:p.a}; }
function setS(D,key,d,now,me){ const s=D.F.settings||(D.F.settings={}); const p=s[key]; s[key]={id:key,d,u:now,b:me,c:p&&p.c||now,a:p&&p.a||me}; }
function collectOwned(fid,D,now,f){ const me=f.me;
 own(D,'members',me,{name:f.mname,color:f.color},now,me);
 const ds=jget('ritm-dengi-state-v1'), db=jget('ritm-dengi-b-v1')||{}; const from=addD(dk(),-62); const mine=new Set(); const isF=inFam(fid);
 const cat=id=>{ const x=ds&&Array.isArray(ds.cats)?ds.cats.find(y=>y.id===id):null; return x?{cn:x.n,ci:x.ic}:{cn:'Другое',ci:'dots'}; };
 for(const b of Object.values(db)) for(const o of (b&&b.ops)||[]){ if(!o||!isF(o)||o.t!=='exp'||!(o.date>=from)) continue; mine.add(o.id); own(D,'ops',o.id,Object.assign({date:o.date,sum:o.sum,cat:o.cat,note:o.note||''},cat(o.cat)),now,me); }
 for(const [id,x] of Object.entries(D.F.ops||{})) if(x.a===me&&!x.x&&!mine.has(id)) drop(D,'ops',id,now,me);
 const shB=!f.share||f.share.body!==false, shP=!f.share||f.share.preg!==false; const body={};
 if(shB){ const W=jget('ritm-telo-workouts-v1'); const days={}; const from2=addD(dk(),-21);
  if(Array.isArray(W)) for(const w of W){ if(!w||!w.date||w.date<from2) continue; const x=days[w.date]||(days[w.date]={n:0,t:[],min:0}); x.n++; x.min+=Math.round(w.dur||0); if(w.day&&x.t.length<3) x.t.push(String(w.day).slice(0,30)); }
  body.days=days; }
 /* срок беременности (общая запись Питания и Тела) — если не скрыт для этой семьи */
 const pg=jget('ritm-preg-state-v1'); if(shP&&pg&&pg.on&&pg.due) body.preg={due:pg.due};
 if(body.days||body.preg) own(D,'body',me,body,now,me); else drop(D,'body',me,now,me); }
function mergeIn(D,R){ for(const [name,coll] of Object.entries(R||{})){ if(!coll||typeof coll!=='object') continue; const L=D.F[name]||(D.F[name]={});
  for(const [id,r] of Object.entries(coll)){ if(!r||typeof r.u!=='number') continue; const l=L[id]; if(!l||r.u>l.u||(r.u===l.u&&String(r.b)>String(l.b))) L[id]=r; } } }
function purge(D){ const lim=Date.now()-60*864e5; for(const coll of Object.values(D.F)) for(const [id,f] of Object.entries(coll)) if(f&&f.x&&f.u<lim) delete coll[id];
 const lo=addD(dk(),-62); for(const [id,f] of Object.entries(D.F.ops||{})) if(f&&!f.x&&f.d&&f.d.date<lo) delete D.F.ops[id]; }

/* ---------- синхронизация ---------- */
let busy=null, active=!document.hidden, lastRun=0, raws={}, selfEvent=false, timer=null; const state={busy:false};
function rawsNow(){ const o={}; for(const k of WATCH) o[k]=raw(k)||''; return o; }
function changed(){ const n=rawsNow(); return WATCH.some(k=>n[k]!==raws[k]); }
function lock(){ try{ const l=jget(LOCK_K); if(l&&l.id!==PAGE&&Date.now()-l.t<45000) return false; jset(LOCK_K,{id:PAGE,t:Date.now()}); return true; }catch(e){ return true; } }
function unlock(){ try{ const l=jget(LOCK_K); if(l&&l.id===PAGE) del(LOCK_K); }catch(e){} }
function flushApp(){ try{ if(typeof Store!=='undefined'&&Store&&typeof Store.flush==='function') Store.flush(); }catch(e){} }
function emit(){ try{ window.dispatchEvent(new Event('ritm-family')); }catch(e){} }
function sync(o){ if(busy) return busy; busy=runAll(o||{}).finally(()=>{ busy=null; }); return busy; }
async function runAll(o){
 const list=o.only?famList().filter(f=>f.id===o.only):famList(); if(!list.length) return {ok:false};
 if(!lock()) return {ok:false,locked:true};
 lastRun=Date.now(); state.busy=true; emit(); let ok=true, touched=[], err=null;
 try{ for(const f of list){ const r=await runOne(f,o); if(!r.ok){ ok=false; err=err||r.err; } touched=touched.concat(r.touched||[]); } }
 finally{ try{ del(REBASE_K); }catch(e){} raws=rawsNow(); unlock(); state.busy=false;
  if(touched.length){ selfEvent=true; try{ window.dispatchEvent(new Event('ritm-resume')); }catch(e){} selfEvent=false; }
  emit(); }
 return {ok,touched:[...new Set(touched)],err}; }
async function runOne(f,o){ const fid=f.id, me=f.me;
 try{
  let D=load(fid);
  const L=await ghList(f); let mineSha=null;
  for(const x of L){ const id=x.name.slice(0,-5); if(id===me){ mineSha=x.sha; continue; } const ch=D.cache[x.name]; if(ch&&ch.sha===x.sha) continue;
   try{ const p=await unseal(f,await ghRaw(f,x.name)); D=load(fid); mergeIn(D,p.F); D.cache[x.name]={sha:x.sha,at:p.at||0,m:p.m||id}; save(fid,D); }
   catch(e){ if(e instanceof FamErr) throw e; D=load(fid); D.cache[x.name]={sha:x.sha,at:0,m:id,bad:1}; save(fid,D); } }
  D=load(fid); for(const n of Object.keys(D.cache)) if(!L.some(x=>x.name===n)) delete D.cache[n];
  /* меня удалили из семьи — выходим у себя */
  const RM=D.F.settings&&D.F.settings.removed; const rmD=RM&&!RM.x?RM.d:null;
  if(rmD&&rmD[me]&&!o.leave){ save(fid,D); await localLeave(fid,'Вас удалили из семьи «'+famName(fid)+'»'); return {ok:true,touched:['removed']}; }
  flushApp(); const now=Date.now(); const rebase=!!raw(REBASE_K); let touched=[];
  if(o.leave){ for(const name of ['members','body']) drop(D,name,me,now,me); for(const [id,x] of Object.entries(D.F.ops||{})) if(x.a===me) drop(D,'ops',id,now,me); }
  else { if(!rebase) collectTwo(fid,D,now,me); collectOwned(fid,D,now,f); purge(D); touched=applyTwo(fid,D,me); }
  const body=JSON.stringify(D.F); const h=fnv(body); save(fid,D);
  if(o.force||!mineSha||h!==D.pushHash||mineSha!==D.mySha){ const text=await seal(f,{v:2,f:fid,m:me,at:now,F:D.F}); const sha=await ghPut(f,me+'.json',text,mineSha,'Ритм: '+(f.mname||'участник'));
   const D2=load(fid); D2.mySha=sha; D2.pushHash=h; D2.pushedAt=now; save(fid,D2); }
  const D3=load(fid); D3.at=Date.now(); D3.err=null; save(fid,D3);
  return {ok:true,touched}; }
 catch(e){ const D=load(fid); D.err={code:e.code||'err',msg:e instanceof FamErr?e.message:'Не удалось синхронизировать: '+(e&&e.message||e),at:Date.now()}; save(fid,D); return {ok:false,err:D.err}; } }
function soon(ms,force){ clearTimeout(timer); timer=setTimeout(()=>{ if(!famList().length||!active) return; if(force||Date.now()-lastRun>15000||changed()) sync(); },ms||1000); }

/* ---------- создать, присоединиться, выйти ---------- */
function genKey(){ return b64e(crypto.getRandomValues(new Uint8Array(32))); }
function cleanRepo(s){ s=String(s||'').trim().replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/,'').replace(/\/+$/,''); return /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(s)?s:null; }
function okToken(t){ return /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(String(t||'').trim()); }
async function check(f){ const r=await ghRepo(f); if(r&&r.private===false) throw new FamErr('public','Репозиторий открытый — для семьи нужен закрытый (Private)'); return r; }
function myDefaults(){ const L=famList(); const f=L[0]; return f?{mname:f.mname,color:f.color}:{}; }
async function addFam(f,first){ const c=cfgAll(); if(c.list.some(x=>x.id===f.id)) throw new FamErr('dup','Вы уже в этой семье');
 c.list.push(f); c.cur=f.id; if(!c.pit&&f.pit!==false) c.pit=f.id; delete f.pit; setAll(c); save(f.id,first||{F:{},snap:{},cache:{}});
 const r=await sync({force:true,only:f.id}); if(r&&r.ok) return f;
 const c2=cfgAll(); c2.list=c2.list.filter(x=>x.id!==f.id); setAll(c2); del(DATA_P+f.id); emit();
 const e=r&&r.err; throw new FamErr(e?e.code:'err',e?e.msg:'Не удалось синхронизировать — попробуйте ещё раз'); }
async function create(o){ const repo=cleanRepo(o.repo); if(!repo) throw new FamErr('repo','Укажите репозиторий в виде имя/репозиторий, например NeAlta/ritm-family');
 const token=String(o.token||'').trim(); if(!okToken(token)) throw new FamErr('token','Это не похоже на ключ GitHub — он начинается с github_pat_');
 const fid=rid('f'); const me=rid('m'); const d=myDefaults(); const now=Date.now(); const name=String(o.family||'Наша семья').slice(0,40);
 const f={id:fid,repo,dir:o.dir||(famList().some(x=>x.repo===repo)?'f-'+fid:'family'),token,key:genKey(),name,me,mname:String(o.name||d.mname||'Я').slice(0,24),color:o.color||d.color||COLORS[0][0],share:{body:true},joined:now,pit:o.pit};
 await check(f);
 const first={F:{settings:{name:{id:'name',d:{n:name},u:now,b:me,c:now,a:me},roles:{id:'roles',d:{[me]:'admin'},u:now,b:me,c:now,a:me}}},snap:{},cache:{}};
 return addFam(f,first); }
function invite(fid){ const f=fam(fid); if(!f) return ''; return 'RITM-FAMILY:'+toUrl(b64e(te.encode(JSON.stringify({v:2,f:f.id,r:f.repo,d:f.dir,t:f.token,k:f.key,n:famName(f.id)})))); }
function parseInvite(s){ const m=String(s||'').match(/RITM-FAMILY:([A-Za-z0-9_-]+)/); if(!m) return null; try{ const o=JSON.parse(td.decode(b64d(fromUrl(m[1])))); return o&&o.r&&o.t&&o.k?o:null; }catch(e){ return null; } }
async function join(text,o){ const inv=parseInvite(text); if(!inv) throw new FamErr('invite','Это не приглашение Ритма — скопируйте его целиком, вместе с RITM-FAMILY:');
 const d=myDefaults(); const f={id:inv.f||rid('f'),repo:inv.r,dir:inv.d||'family',token:inv.t,key:inv.k,name:inv.n||'Семья',me:rid('m'),mname:String(o.name||d.mname||'Я').slice(0,24),color:o.color||d.color||COLORS[1][0],share:{body:true},joined:Date.now(),pit:o.pit};
 await check(f); return addFam(f); }
/* убрать семью у себя: семейные записи остаются личными */
async function localLeave(fid,notice){ const c=cfgAll(); const wasPit=c.pit===fid; const isF=inFam(fid);
 const tasks=jget('ritm-tseli-state-v1'); if(tasks&&Array.isArray(tasks.tasks)){ for(const t of tasks.tasks) if(isF(t)){ delete t.fam; delete t.who; delete t.fa; } jset('ritm-tseli-state-v1',tasks); }
 const ds=jget('ritm-dengi-state-v1'); if(ds&&Array.isArray(ds.pays)){ for(const p of ds.pays) if(isF(p)){ delete p.fam; delete p.fa; } jset('ritm-dengi-state-v1',ds); }
 const db=jget('ritm-dengi-b-v1'); if(db){ for(const b of Object.values(db)) for(const o of (b&&b.ops)||[]) if(isF(o)) delete o.fam; jset('ritm-dengi-b-v1',db); }
 if(wasPit){ const ps=jget('ritm-pit-state-v1'); if(ps){ for(const k of ['shop','home']) for(const x of ps[k]||[]) delete x.fa; jset('ritm-pit-state-v1',ps); } }
 c.list=c.list.filter(x=>x.id!==fid); if(notice) c.notice=notice; setAll(c); del(DATA_P+fid); delete keys[fid]; emit();
 selfEvent=true; try{ window.dispatchEvent(new Event('ritm-resume')); }catch(e){} selfEvent=false; }
async function leave(fid){ fid=fid||cfgAll().cur; if(!fam(fid)) return; await (busy||Promise.resolve()); try{ await sync({force:true,leave:true,only:fid}); }catch(e){} await localLeave(fid); }
async function edit(fid,fn){ await (busy||Promise.resolve()); const f=fam(fid); if(!f) return; const D=load(f.id); fn(D,f,Date.now()); save(f.id,D); soon(300,true); emit(); }
async function editApp(key,fn){ await (busy||Promise.resolve()); const st=jget(key)||{v:1,setup:false}; fn(st); jset(key,st); soon(300,true); emit(); }

/* ---------- чтение для экранов ---------- */
function famName(fid){ const f=fam(fid); if(!f) return 'Семья'; const s=setting(f.id,'name'); return s&&s.n||f.name||'Семья'; }
function roles(fid){ return setting(fid,'roles')||{}; }
function removed(fid){ return setting(fid,'removed')||{}; }
function groupsOf(fid){ const g=setting(fid,'groups'); return g&&Array.isArray(g.list)?g:{list:[],of:{}}; }
function members(fid){ const f=fam(fid); if(!f) return []; const D=load(f.id); const R=roles(f.id), X=removed(f.id), G=groupsOf(f.id);
 const L=Object.values(D.F.members||{}).filter(x=>!x.x&&x.d&&!X[x.id]).map(x=>{ const ch=Object.values(D.cache).find(y=>y.m===x.id); const me=x.id===f.me;
  return {id:x.id,name:me?f.mname:x.d.name,color:me?f.color:x.d.color,me,at:me?D.at||0:ch?ch.at:0,role:R[x.id]==='admin'?'admin':'member',group:G.of&&G.of[x.id]||null}; });
 if(!L.some(m=>m.me)) L.unshift({id:f.me,name:f.mname,color:f.color,me:true,at:D.at||0,role:R[f.me]==='admin'?'admin':'member',group:G.of&&G.of[f.me]||null});
 return L.sort((a,b)=>(b.me-a.me)||String(a.name).localeCompare(String(b.name),'ru')); }
function allMembers(){ const out=[]; for(const f of famList()) for(const m of members(f.id)) out.push(Object.assign({fid:f.id},m)); return out; }
function member(id){ return allMembers().find(m=>m.id===id)||null; }
function nameOf(id){ const m=member(id); return m?(m.me?'Вы':m.name):'Участник'; }
function colorOf(id){ const m=member(id); return m?m.color:'#8A8178'; }
function tag(id,lbl){ if(!id) return ''; return `<span class="ftag"><i style="background:${escH(colorOf(id))}"></i>${escH(lbl||nameOf(id))}</span>`; }
function isAdmin(fid){ const f=fam(fid); return !!f&&roles(f.id)[f.me]==='admin'; }
function myIds(){ return famList().map(f=>f.me); }
/* задача для меня? (who: 'all' | id участника | 'g:<группа>') */
function mine(t){ const fid=scopeOf(t); if(!fid) return true; const f=fam(fid); if(!f) return true; const w=t.who; if(!w||w==='all'||w===f.me) return true;
 if(String(w).startsWith('g:')){ const G=groupsOf(f.id); return (G.of||{})[f.me]===w.slice(2); } return false; }
function whoLabel(t){ const fid=scopeOf(t); const w=t.who; if(!w||w==='all') return 'Все'; if(String(w).startsWith('g:')){ const g=groupsOf(fid).list.find(x=>x.id===w.slice(2)); return g?g.name:'Группа'; } return nameOf(w); }
function status(fid){ const f=fam(fid); if(!f) return {busy:state.busy,at:0,err:null}; const D=load(f.id); return {busy:state.busy,at:D.at||0,pushedAt:D.pushedAt||0,err:D.err||null}; }
function anyErr(){ return famList().map(f=>load(f.id).err).find(Boolean)||null; }

/* ---------- управление (владельцы семьи) ---------- */
const admin={
 setRole:(fid,id,role)=>edit(fid,(D,f,now)=>{ const r=Object.assign({},roles(f.id)); if(role==='admin') r[id]='admin'; else delete r[id]; setS(D,'roles',r,now,f.me); }),
 remove:(fid,id)=>edit(fid,(D,f,now)=>{ const x=Object.assign({},removed(f.id)); x[id]=Date.now(); setS(D,'removed',x,now,f.me); const r=Object.assign({},roles(f.id)); delete r[id]; setS(D,'roles',r,now,f.me); }),
 setGroups:(fid,list)=>edit(fid,(D,f,now)=>{ const G=groupsOf(f.id); const ids=new Set(list.map(g=>g.id)); const of={}; for(const [m,g] of Object.entries(G.of||{})) if(ids.has(g)) of[m]=g; setS(D,'groups',{list,of},now,f.me); }),
 setGroupOf:(fid,id,gid)=>edit(fid,(D,f,now)=>{ const G=groupsOf(f.id); const of=Object.assign({},G.of); if(gid) of[id]=gid; else delete of[id]; setS(D,'groups',{list:G.list,of},now,f.me); }),
 setName:(fid,n)=>edit(fid,(D,f,now)=>{ setS(D,'name',{n:String(n).slice(0,40)},now,f.me); }),
 setBudget:(fid,sum)=>edit(fid,(D,f,now)=>{ setS(D,'budget',{sum:Math.max(0,Math.round(sum||0))},now,f.me); })
};

/* ---------- кнопка «Семья» в шапке приложений ---------- */
function openFam(){ try{ if(window.RitmNative&&window.RitmNative.open&&window.RitmNative.open('semya')!==false) return; }catch(e){} location.href='semya.html'; }
function isFamPage(){ return window.RITM_PAGE==='semya'||(typeof APP!=='undefined'&&APP&&APP.id==='fam'); }
function inject(){ if(!famList().length||isFamPage()) return; const tops=document.querySelectorAll('.top'); for(const t of tops){ if(t.querySelector('.fam-btn')) continue; const host=t.querySelector('.row')||t; const last=host.lastElementChild; if(!last) continue;
  const b=document.createElement('button'); b.type='button'; b.className='ibtn fam-btn'+(host===t?' solo':''); b.setAttribute('aria-label','Семейный ритм'); b.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+USERS+'</svg>'+(anyErr()?'<i class="fam-dot"></i>':'');
  b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); openFam(); }); host.insertBefore(b,last); } }
const CSS='.fam-btn{position:relative}.fam-btn.solo{margin-left:auto;margin-right:8px}.fam-dot{position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:var(--bad,#D9483B)}'+
 '.ftag{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--muted,#5F5A52);white-space:nowrap}.ftag i{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}'+
 '.fsc{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--muted,#5F5A52)}';

function boot(){ try{ const s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }catch(e){}
 raws=rawsNow();
 try{ if(typeof A!=='undefined'&&A) for(const k of ['bkRestore','resetDo']){ const fn=A[k]; if(typeof fn==='function'&&!fn.__fam){ const w=async function(){ const r=await fn.apply(this,arguments); try{ if(famList().length) localStorage.setItem(REBASE_K,'1'); }catch(e){} soon(1200,true); return r; }; w.__fam=true; A[k]=w; } } }catch(e){}
 let q=0; try{ new MutationObserver(()=>{ if(q) return; q=requestAnimationFrame(()=>{ q=0; inject(); }); }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
 inject(); if(famList().length) soon(1500,true);
 setInterval(()=>{ if(!famList().length||!active||busy) return; if(changed()) soon(2500); else if(Date.now()-lastRun>180000) soon(100,true); },15000); }
document.addEventListener('visibilitychange',()=>{ active=!document.hidden; if(active) soon(800); });
window.addEventListener('ritm-pause',()=>{ active=false; });
window.addEventListener('ritm-resume',()=>{ if(selfEvent) return; active=true; soon(800); });
window.addEventListener('ritm-family',()=>{ const err=!!anyErr(); document.querySelectorAll('.fam-btn').forEach(x=>{ const d=x.querySelector('.fam-dot'); if(err&&!d){ const i=document.createElement('i'); i.className='fam-dot'; x.appendChild(i); } else if(!err&&d) d.remove(); }); });
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else setTimeout(boot,0);

window.Fam={
 on:()=>famList().length>0, list:()=>famList().map(f=>({id:f.id,name:famName(f.id),repo:f.repo,admin:isAdmin(f.id),pit:cfgAll().pit===f.id})),
 cur:()=>cfgAll().cur, setCur:id=>{ const c=cfgAll(); if(c.list.some(f=>f.id===id)){ c.cur=id; setAll(c); emit(); } }, fam, me:fid=>{ const f=fam(fid); return f?f.me:null; }, myIds,
 members, allMembers, member, name:nameOf, color:colorOf, tag, famName, groups:fid=>groupsOf(fid).list, groupOf:(id,fid)=>(groupsOf(fid).of||{})[id]||null, isAdmin,
 mine, whoLabel, scopeOf, removed, label:fid=>famName(fid), status, anyErr, data:fid=>{ const f=fam(fid); return f?load(f.id).F:{}; }, budget:fid=>{ const b=setting((fam(fid)||{}).id,'budget'); return b&&b.sum||0; },
 sync:o=>sync(o), soon, create, join, leave, invite, parseInvite, edit, editApp, admin, COLORS, FamErr, cleanRepo, okToken, openFam,
 pitFam:()=>cfgAll().pit, setPit:fid=>{ const c=cfgAll(); const old=c.pit; c.pit=fid||null; setAll(c); if(old&&old!==fid){ const D=load(old); D.snap.shop={}; D.snap.home={}; save(old,D); } soon(300,true); emit(); },
 shareBody:fid=>{ const f=fam(fid); return !!f&&(!f.share||f.share.body!==false); },
 sharePreg:fid=>{ const f=fam(fid); return !!f&&(!f.share||f.share.preg!==false); },
 setSharePreg:(fid,v)=>{ const c=cfgAll(); const f=c.list.find(x=>x.id===(fid||c.cur)); if(!f) return; f.share=Object.assign({},f.share,{preg:!!v}); setAll(c); soon(300,true); emit(); },
 myPreg:()=>{ const p=jget('ritm-preg-state-v1'); return p&&p.on&&p.due?p:null; },
 setShareBody:(fid,v)=>{ const c=cfgAll(); const f=c.list.find(x=>x.id===(fid||c.cur)); if(!f) return; f.share=Object.assign({},f.share,{body:!!v}); setAll(c); soon(300,true); emit(); },
 setMe:(o,fid)=>{ const c=cfgAll(); for(const f of c.list) if(!fid||f.id===fid){ if(o.name) f.mname=String(o.name).slice(0,24); if(o.color) f.color=o.color; } setAll(c); soon(300,true); emit(); },
 setToken:(fid,t)=>{ const c=cfgAll(); const f=c.list.find(x=>x.id===(fid||c.cur)); t=String(t||'').trim(); if(!f||!okToken(t)) return false; f.token=t; setAll(c); const D=load(f.id); D.err=null; save(f.id,D); soon(100,true); return true; },
 notice:()=>cfgAll().notice||null, clearNotice:()=>{ const c=cfgAll(); delete c.notice; setAll(c); },
 rid, _test:{collectTwo,applyTwo,mergeIn,load,save,seal,unseal,cfgAll}
};
})();
