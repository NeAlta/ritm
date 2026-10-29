/* Ритм для iPhone: мост вместо нативной части Android.
   Одно веб-приложение «Ритм» на экране «Домой», внутри — четыре приложения с общими данными.
   Переключатель — нажатие на название «Ритм·…» в шапке. */
(function(){
'use strict';
var APPS=[
 {id:'telo',page:'telo.html',n:'Тело',d:'Тренировки, активность, восстановление',c:'#F0643C',g:'M2.4 12H6.67L8.8 6.67L13.07 17.33L15.2 12H21.6'},
 {id:'dengi',page:'dengi.html',n:'Деньги',d:'Бюджет месяца, платежи, копилки',c:'#2FA36B',g:'M4 7a2 2 0 0 1 2-2h12v4M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14.5h.01'},
 {id:'pit',page:'pitanie.html',n:'Питание',d:'Калории, нутриенты, продукты дома',c:'#F2B33D',g:'M12 7c-1.5-1.3-4-1.5-5.5 0C4.4 9 5 14 7 17.5c1.2 2 2.8 3 5 2 2.2 1 3.8 0 5-2 2-3.5 2.6-8.5.5-10.5-1.5-1.5-4-1.3-5.5 0zM12 7c0-2 1-3.5 3-4'},
 {id:'tseli',page:'tseli.html',n:'Цели',d:'Цели, задачи на день, привычки',c:'#6E63F2',g:'M12 3a9 9 0 1 0 0.01 0zM12 7a5 5 0 1 0 0.01 0zM12 12l7-7M16 5h3v3'}];
var ALIAS={pitanie:'pit',pit:'pit',telo:'telo',dengi:'dengi',tseli:'tseli'};
var cur=window.RITM_PAGE||'';
function byId(id){ id=ALIAS[id]||id; for(var i=0;i<APPS.length;i++) if(APPS[i].id===id) return APPS[i]; return null; }
function remember(id){ try{ localStorage.setItem('ritm-ios-last',id); }catch(e){} }
function glyph(a,size){ return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="#17161A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+a.g+'"/></svg>'; }
var standalone=window.navigator.standalone===true||!!(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
window.RITM_APPS=APPS; window.RITM_GLYPH=glyph; window.RITM_STANDALONE=standalone; window.RITM_ISIOS=ios;
if(byId(cur)) remember(byId(cur).id);

/* Переход в соседнее приложение: сначала сохранить данные текущего */
function go(id){ var a=byId(id); if(!a) return false; closeMenu(); if(a.id===cur) return true; remember(a.id);
 try{ window.dispatchEvent(new Event('ritm-pause')); }catch(e){}
 setTimeout(function(){ location.replace(a.page); },40); return true; }

var bridge={ version:function(){ return 'ios-pwa'; }, open:function(id){ return go(id); } };
if(navigator.share) bridge.share=function(text,title){ try{ var p=navigator.share({title:title||'Ритм',text:text}); if(p&&p.catch) p.catch(function(){}); return true; }catch(e){ return false; } };
window.RitmNative=bridge;

/* Переключатель приложений */
var menu=null, lastFocus=null;
function openMenu(){ if(menu) return; lastFocus=document.activeElement; menu=document.createElement('div'); menu.className='rsw-back';
 menu.innerHTML='<div class="rsw" role="dialog" aria-modal="true" aria-label="Приложения Ритма"><p class="rsw-h">Приложения Ритма</p>'+APPS.map(function(a){ var on=a.id===(ALIAS[cur]||cur);
  return '<button type="button" class="rsw-i'+(on?' on':'')+'" data-rsw="'+a.id+'"'+(on?' aria-current="page"':'')+'><span class="rsw-t" style="background:'+a.c+'">'+glyph(a,22)+'</span><span class="rsw-m"><b>'+a.n+'</b><small>'+a.d+'</small></span>'+(on?'<span class="rsw-ok">открыто</span>':'')+'</button>'; }).join('')+'</div>';
 menu.addEventListener('click',function(e){ var b=e.target.closest('[data-rsw]'); if(b){ go(b.getAttribute('data-rsw')); return; } if(e.target===menu) closeMenu(); });
 document.body.appendChild(menu); requestAnimationFrame(function(){ if(menu) menu.classList.add('in'); });
 var f=menu.querySelector('.rsw-i:not(.on)'); if(f) try{ f.focus({preventScroll:true}); }catch(e){} }
function closeMenu(){ if(!menu) return; var m=menu; menu=null; m.remove(); if(lastFocus&&lastFocus.focus) try{ lastFocus.focus({preventScroll:true}); }catch(e){} }
window.RITM_SWITCHER=openMenu;
function isBrand(t){ return t&&t.closest&&t.closest('.top .brand'); }
document.addEventListener('click',function(e){ if(isBrand(e.target)){ e.preventDefault(); e.stopPropagation(); openMenu(); } },true);
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&menu){ closeMenu(); return; } if((e.key==='Enter'||e.key===' ')&&isBrand(e.target)){ e.preventDefault(); openMenu(); } });

/* Название в шапке — кнопка переключателя (для VoiceOver и клавиатуры) */
function markBrands(){ var L=document.querySelectorAll('.top .brand:not([role])'); for(var i=0;i<L.length;i++){ L[i].setAttribute('role','button'); L[i].setAttribute('tabindex','0'); L[i].setAttribute('aria-label',(L[i].textContent||'Ритм')+' — другие приложения Ритма'); } }

/* Цвет строки состояния — как фон страницы (светлая и тёмная тема) */
function syncTheme(){ var m=document.querySelector('meta[name="theme-color"]'); if(!m||!document.body) return; var c=getComputedStyle(document.body).backgroundColor; if(c&&c!=='rgba(0, 0, 0, 0)'&&m.getAttribute('content')!==c) m.setAttribute('content',c); }

/* Подсказка в Safari: установить на экран «Домой», чтобы данные жили в приложении */
function hint(){ if(!ios||standalone||cur==='start') return; try{ if(localStorage.getItem('ritm-ios-hint')) return; }catch(e){}
 var h=document.createElement('div'); h.className='rhint'; h.setAttribute('role','note');
 h.innerHTML='<p><b>Установите Ритм на iPhone.</b> Нажмите «Поделиться» <span class="rhint-i" aria-hidden="true">'+shareIcon()+'</span> внизу Safari и выберите «На экран Домой». Данные из Safari в приложение не переносятся — начинайте в приложении.</p><button type="button" class="rhint-x" aria-label="Скрыть подсказку">✕</button>';
 h.querySelector('.rhint-x').addEventListener('click',function(){ try{ localStorage.setItem('ritm-ios-hint','1'); }catch(e){} h.remove(); });
 document.body.appendChild(h); }
function shareIcon(){ return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>'; }
window.RITM_SHARE_ICON=shareIcon;

function boot(){ markBrands(); syncTheme(); hint();
 try{ new MutationObserver(function(){ markBrands(); }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
 try{ new MutationObserver(syncTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class','style']}); }catch(e){}
 try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){ setTimeout(syncTheme,30); }); }catch(e){}
 if(standalone&&navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(function(){});
 if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function(){}); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
