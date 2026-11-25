import {lessons, modules, modes, totalLessons} from './catalog.mjs';
import {browserStorage, readProgress, saveProgress, stats} from './progress.mjs';
import {e,icon,iconButton,lessonUrl,formatNumber} from './ui.mjs';
import {academyView,progressView} from './journey.mjs';

const app=document.querySelector('#app');
const storage=browserStorage();
const progress=readProgress(storage);
let cleanLab=()=>{};
let labGeneration=0;
let toastTimer;
let collapsed=false;
const labels={resumen:'Resumen',academia:'Mapa de aprendizaje',progreso:'Mi progreso',ajustes:'Ajustes',...Object.fromEntries(modes.map(mode=>[mode.id,mode.title]))};
const navigation=[
  {label:'Aprendizaje',items:[['resumen','Vista general','grid'],['academia','Ruta de aprendizaje','route'],['sandbox','Sandbox','terminal'],['incidencias','Troubleshooting','pulse']]},
  {label:'Práctica avanzada',items:[['desafios','Desafíos','target'],['supervivencia','Supervivencia','bolt'],['certificacion','Certificación','award'],['constructor','Arquitectura','layers']]},
  {label:'Tu espacio',items:[['progreso','Mi progreso','chart'],['ajustes','Ajustes','settings']]}
];

function applyTheme() {
  document.documentElement.dataset.theme=progress.profile.theme;
  document.querySelector('meta[name="theme-color"]').content=progress.profile.theme==='light'?'#f3f6fb':'#0b1019';
  window.dispatchEvent(new Event('kubepath:theme'));
}
function toast(message) {
  const box=document.querySelector('#toast');
  box.innerHTML=icon('info',18)+'<span>'+e(message)+'</span>';
  box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>box.classList.remove('on'),3000);
}
function persist() {
  if (!saveProgress(storage,progress)) toast('El navegador no permite guardar el progreso. Se conservará durante esta sesión.');
  const sidebarRank=document.querySelector('.sidebar-rank');
  if (sidebarRank) {
    const current=stats(progress);
    sidebarRank.querySelector('strong').textContent=current.rank;
    sidebarRank.querySelector('small').textContent='Nivel '+current.level+' · '+formatNumber(current.xp)+' XP';
    sidebarRank.querySelector('.mini-meter i').style.width=rankPct(current)+'%';
  }
}
function firstLesson() {
  return modules.flatMap(module=>module.lessons).find(id=>!progress.completed[id])??'primer-pod';
}
const rankPct = s => s.goal?Math.round((s.xp-s.step)/(s.goal-s.step)*100):100;
const progressOf = module => module.lessons.filter(id=>progress.completed[id]).length;
const initials = () => (progress.profile.name.trim().split(/\s+/).map(word=>word[0]).slice(0,2).join('')||'KP').toUpperCase();
const chip = (name,color) => '<span class="icon-tile '+color+'">'+icon(name,21)+'</span>';
const smallProgress = (amount, label='Progreso') => '<div class="progress-track" role="progressbar" aria-label="'+e(label)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+amount+'"><i style="width:'+amount+'%"></i></div>';
const simulation = '<span class="simulation-pill"><i></i> Simulación</span>';

function shell(view,crumb) {
  const s=stats(progress);
  app.innerHTML=`
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#resumen" aria-label="KubePath, vista general"><img src="./assets/mark.svg" alt="" width="37" height="37"><span>Kube<span>Path</span><small>ACADEMIA DE KUBERNETES</small></span></a>
        <nav aria-label="Navegación principal">
          ${navigation.map(group=>`<div class="nav-group"><p>${group.label}</p>${group.items.map(([id,label,symbol])=>`<a class="nav-item ${id===view?'active':''}" href="#${id}" ${id===view?'aria-current="page"':''}>${icon(symbol,18)}<span>${label}</span>${id===view?'<i></i>':''}</a>`).join('')}</div>`).join('')}
        </nav>
        <a href="#progreso" class="sidebar-rank"><span class="rank-shield">${icon('shield',20)}</span><span><strong>${e(s.rank)}</strong><small>Nivel ${s.level} · ${formatNumber(s.xp)} XP</small><span class="mini-meter"><i style="width:${rankPct(s)}%"></i></span></span>${icon('chevron',15)}</a>
      </aside>
      <button type="button" class="mobile-overlay" data-action="menu" aria-label="Cerrar navegación"></button>
      <div class="main">
        <header class="topbar">
          <div class="breadcrumbs">${iconButton('menu','Abrir navegación','menu')}<span class="crumb-root">Aprendizaje</span>${icon('chevron',14)}<strong>${e(crumb)}</strong></div>
          <div class="top-actions">
            <button class="search-btn" type="button" data-action="search">${icon('search',17)} <span>Buscar</span><kbd>Ctrl K</kbd></button>
            ${iconButton('theme','Cambiar tema',progress.profile.theme==='dark'?'sun':'moon')}
            <span class="top-divider"></span>
            <a class="avatar" href="#ajustes" aria-label="Ajustes de perfil">${e(initials())}</a>
          </div>
        </header>
        <main id="contenido" class="content" tabindex="-1"></main>
      </div>
    </div>
    <dialog id="dialog" class="dialog" aria-labelledby="dialog-title"></dialog>`;
  updateMenu();
  return document.querySelector('#contenido');
}

function stat(symbol,color,text,value,suffix) {
  return `<section class="stat-card">${chip(symbol,color)}<div><h2>${text}</h2><p>${value} <small>${suffix}</small></p></div></section>`;
}

function overview() {
  const s=stats(progress);
  const next=lessons[firstLesson()];
  const upcoming=modules.find(module=>progressOf(module)<module.lessons.length)??modules[0];
  const start=progressOf(upcoming)===upcoming.lessons.length?0:modules.indexOf(upcoming);
  const shown=modules.slice(Math.min(start,modules.length-2),Math.min(start,modules.length-2)+2);
  return `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-art" aria-hidden="true"><img src="./assets/cluster-hero.webp" alt="" fetchpriority="high"></div>
      <div class="hero-content">
        <p class="hero-kicker">${icon('box',15)} <span>APRENDIZAJE PRÁCTICO</span></p>
        <h1 id="hero-title">Domina Kubernetes,<br><em>un clúster a la vez.</em></h1>
        <p class="hero-copy">Aprende a desplegar, operar y diagnosticar Kubernetes con laboratorios interactivos y topologías 3D.</p>
        <div class="hero-actions"><a class="btn primary" href="${lessonUrl(next.id)}">${icon('play',16)} ${s.finished.length?'Continuar aprendiendo':'Empezar a aprender'}</a><a class="btn hero-secondary" href="#academia">${icon('route',17)} Ver la ruta</a></div>
      </div>
    </section>
    <div class="stats-grid" aria-label="Tus estadísticas">
      ${stat('bolt','violet','Experiencia',formatNumber(s.xp),'XP')}
      ${stat('flame','amber','Racha actual',s.streak,s.streak===1?'día':'días')}
      ${stat('terminal','mint','Prácticas completadas',s.finished.length,'/ '+totalLessons)}
      ${stat('target','blue','Dominio de la ruta',s.pct,'%')}
    </div>
    <div class="dashboard-grid">
      <section class="path-preview">
        <div class="section-head"><div><h2>Ruta de aprendizaje</h2><p>De tus primeros comandos a operar un clúster.</p></div><a href="#academia" class="text-link">Ver mapa</a></div>
        <div class="timeline timeline-compact">${shown.map(module=>moduleCard(module, {compact:true})).join('')}</div>
      </section>
      <aside class="dashboard-aside" aria-label="Resumen de actividad">
        <section class="panel rank-card">
          <div class="daily-top"><span class="icon-tile mint">${icon('shield',20)}</span><div><h2>${e(s.rank)}</h2><p>${s.goal?formatNumber(s.goal-s.xp)+' XP para '+e(s.nextRank):'Rango máximo'}</p></div></div>
          <div class="xp-meter" role="progressbar" aria-label="Progreso de rango" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rankPct(s)}"><i style="width:${rankPct(s)}%"></i></div>
          <a class="text-link" href="#progreso">Ver todo mi progreso</a>
        </section>
        <section class="daily panel">
          <div class="daily-top"><span class="icon-tile amber">${icon('flame',20)}</span><div><h2>Racha semanal</h2><p>${s.streak?s.streak+' '+(s.streak===1?'día seguido':'días seguidos'):'Crea el hábito de practicar'}</p></div><strong>${s.streak}</strong></div>
          ${calendar(s)}
        </section>
        <section class="mission panel">
          <div class="mission-head">${icon('target',19)}<h2>Misión diaria</h2>${s.daily?'<span class="tag mint">Cumplida</span>':''}</div>
          <p>${s.daily?'Ya validaste una práctica hoy.':'Valida una práctica para iniciar tu racha.'}</p>
          ${smallProgress(s.daily?100:0,'Misión diaria')}
          <div class="mission-foot"><span>${s.daily?1:0} / 1 práctica</span><a href="${lessonUrl(next.id)}" class="text-link">${s.daily?'Seguir practicando':'Ir a la práctica'}</a></div>
        </section>
      </aside>
    </div>`;
}
function calendar(s) {
  return `<div class="calendar">${s.calendar.map((day,index)=>`<div class="day ${day.today?'today':''} ${day.done?'done':''}" aria-label="${e(day.date)}${day.done?', práctica completada':''}${day.today?', hoy':''}"><span>${['L','M','X','J','V','S','D'][index]}</span><i>${day.done?icon('check',13):''}</i></div>`).join('')}</div>`;
}
function moduleCard(module,{compact=false}={}) {
  const count=progressOf(module);
  const next=module.lessons.find(id=>!progress.completed[id])??module.lessons[0];
  const active=module.lessons.includes(firstLesson());
  const level=modules.indexOf(module);
  const meta=`<span class="module-level">NIVEL ${level}</span>${count===module.lessons.length?'<span class="tag mint">Completado</span>':active?'<span class="tag mint">Siguiente</span>':''}`;
  return `<article class="module-card ${active?'is-current':''} ${compact?'compact':''}">
    <span class="timeline-dot" aria-hidden="true">${count===module.lessons.length?icon('check',12):''}</span>
    <div class="module-summary">${chip(module.icon,module.color)}
      <div class="module-copy"><div class="module-meta">${meta}</div><h3>${e(module.title)}</h3><p>${e(module.description)}</p></div>
      <div class="module-progress"><span>${count} / ${module.lessons.length}</span>${smallProgress(Math.round(count/module.lessons.length*100),module.title)}</div>
      ${compact?`<a class="square-link" href="${lessonUrl(next)}" aria-label="Abrir ${e(lessons[next].title)}">${icon('play',16)}</a>`:''}
    </div>
    ${compact?'':`<div class="module-lessons">${module.lessons.map(id=>lessonLine(id,'academia')).join('')}</div>`}
  </article>`;
}
function lessonLine(id,mode) {
  const lesson=lessons[id];
  const complete=mode==='academia'?progress.completed[id]:progress.modes[mode+'/'+id];
  return `<a href="${lessonUrl(id,mode)}" class="lesson-line"><span class="lesson-symbol ${complete?'done':''}">${icon(complete?'check':lesson.category==='Incidencia'?'pulse':'terminal',16)}</span><span><strong>${e(lesson.title)}</strong><small>${e(lesson.intro)}</small></span><span class="lesson-time">${icon('clock',14)} ${lesson.minutes} min</span><span class="xp">+${lesson.xp} XP</span></a>`;
}
function pageHead(symbol, title, description, extra='') {
  return `<header class="page-head">${chip(symbol,'mint')}<div><h1>${e(title)}</h1><p>${e(description)}</p></div>${extra}</header>`;
}
const academy = () => academyView(progress);
function modePage(view) {
  const mode=modes.find(item=>item.id===view);
  if (!mode) return '';
  const intro=pageHead(mode.icon,mode.title,mode.description,simulation);
  if (view==='supervivencia') {
    return `${intro}<section class="panel campaign"><div class="campaign-info">${chip('bolt','amber')}<h2>Guardia de producción</h2><p>Tu turno dura tres etapas. Verifica las réplicas y los endpoints en cada incidente para desbloquear el siguiente.</p><a class="btn primary" href="${lessonUrl(mode.lessons[0],view)}">${icon('play',16)} Iniciar guardia</a></div><ol class="campaign-list">${mode.lessons.map((id,index)=>`<li><span>${index+1}</span><div><strong>${e(lessons[id].title)}</strong><p>${e(lessons[id].difficulty)}</p></div></li>`).join('')}</ol></section>`;
  }
  if (view==='certificacion') return intro+`<div class="mode-grid">${mode.tracks.map(track=>`<section class="panel mode-panel"><h2>${track.title}</h2>${track.lessons.map(id=>lessonLine(id,view)).join('')}</section>`).join('')}</div>`;
  return intro+`<div class="mode-grid">${mode.lessons.map(id=>{
    const lesson=lessons[id];
    return `<article class="panel mode-card"><div class="mode-card-top">${chip(mode.icon,mode.color)}<span class="tag">${e(lesson.difficulty)}</span></div><h2>${e(lesson.title)}</h2><p>${e(lesson.intro)}</p><div class="mode-card-bottom"><span class="xp">+${lesson.xp} XP</span><a href="${lessonUrl(id,view)}" class="btn secondary">${icon('play',15)} Abrir práctica</a></div></article>`;
  }).join('')}</div>`;
}
const progressPage = () => progressView(progress);
function settings() {
  return `${pageHead('settings','Ajustes','Personaliza tu experiencia de aprendizaje.')}
    <div class="settings-grid">
      <section class="panel progress-panel"><h2>Perfil local</h2><p>Tu nombre y progreso se guardan en este navegador.</p>
        <form id="profile-form"><label for="profile-name">Nombre visible</label><input id="profile-name" name="name" value="${e(progress.profile.name)}" maxlength="40" placeholder="Estudiante"><button class="btn primary" type="submit">Guardar nombre</button></form>
      </section>
      <section class="panel progress-panel"><h2>Apariencia</h2><p>Elige el contraste de la interfaz.</p><div class="theme-options"><button class="btn secondary" data-theme-choice="dark" aria-pressed="${progress.profile.theme==='dark'}">${icon('moon',18)} Oscuro</button><button class="btn secondary" data-theme-choice="light" aria-pressed="${progress.profile.theme==='light'}">${icon('sun',18)} Claro</button></div></section>
    </div>`;
}

function openSearch() {
  const dialog=document.querySelector('#dialog');
  if (dialog.open) return;
  dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">Buscar en KubePath</h2>${iconButton('close','Cerrar búsqueda','close')}</div>
    <label class="search-input">${icon('search',19)}<input id="query" placeholder="Práctica, concepto o modalidad" aria-label="Buscar prácticas y modalidades" autocomplete="off"></label><div id="search-results" class="search-results"></div>`;
  const input=dialog.querySelector('#query');
  const pool=[...modes.map(mode=>({label:mode.title,description:mode.description,url:'#'+mode.id,icon:mode.icon})),...Object.values(lessons).filter(lesson=>lesson.xp).map(lesson=>({label:lesson.title, description:lesson.intro+' '+lesson.concept,url:lessonUrl(lesson.id),icon:'terminal'}))];
  const normal=value=>value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  const update=()=>{
    const words=normal(input.value.trim()).split(/\s+/).filter(Boolean);
    const hits=(words.length?pool.filter(item=>words.every(word=>normal(item.label+' '+item.description).includes(word))):pool.slice(0,8)).slice(0,20);
    dialog.querySelector('#search-results').innerHTML=hits.length?hits.map(item=>`<a href="${item.url}">${icon(item.icon,17)}<span>${e(item.label)}</span>${icon('chevron',15)}</a>`).join(''):'<p>No hay coincidencias.</p>';
  };
  input.addEventListener('input',update);
  dialog.onclick=event=>{if (event.target===dialog || event.target.closest('a')) dialog.close();};
  update();
  dialog.showModal();
  input.focus();
}

function matchesMode(mode,id) {
  if(mode==='academia') return modules.some(module=>module.lessons.includes(id));
  if (mode==='sandbox' || mode==='constructor') return mode===id;
  const definition=modes.find(item=>item.id===mode);
  return !!(definition?.lessons?.includes(id) || definition?.tracks?.some(track=>track.lessons.includes(id)));
}
async function render({focus=false}={}) {
  const generation=++labGeneration;
  cleanLab();
  cleanLab=()=>{};
  collapsed=false;
  const parts=location.hash.slice(1).split('/');
  let [view,mode,id]=parts;
  if (view==='sandbox' || view==='constructor') {mode=view;id=view;view='lab';}
  if (view==='lab' && (!Object.hasOwn(lessons,id) || !matchesMode(mode,id))) view='academia';
  if (view!=='lab' && !Object.hasOwn(labels,view)) view='resumen';
  const lesson=view==='lab'?lessons[id]:null;
  const nav=view==='lab'?mode:view;
  const content=shell(nav,lesson?lesson.title:labels[view]);
  content.classList.toggle('lab-content',view==='lab');
  document.title=(lesson?.title??labels[view])+' · KubePath';
  if (!lesson) {
    content.innerHTML=view==='resumen'?overview():view==='academia'?academy():view==='progreso'?progressPage():view==='ajustes'?settings():modePage(view);
  } else {
    content.innerHTML='<p class="loading" role="status">Preparando laboratorio…</p>';
    try {
      const {mountLab}=await import('./lab.mjs');
      if (generation!==labGeneration) return;
      cleanLab=mountLab(content,{lesson,mode,progress,persist,toast});
    } catch (error) {
      if (generation!==labGeneration) return;
      content.innerHTML='<div class="panel progress-panel"><h1>No se pudo preparar el laboratorio</h1><p>Vuelve a cargar la página para intentarlo de nuevo.</p><a href="#academia" class="btn secondary">Volver a la ruta</a></div>';
      console.error(error);
    }
  }
  if (focus) {content.focus({preventScroll:true});window.scrollTo(0,0);}
}

function updateMenu() {
  app.classList.toggle('menu-open',collapsed);
  const toggle=document.querySelector('.breadcrumbs [data-action="menu"]');
  toggle?.setAttribute('aria-expanded',String(collapsed));
  toggle?.setAttribute('aria-controls','sidebar');
}
function setTheme(theme) {
  progress.profile.theme=theme;
  applyTheme();
  persist();
  const button=document.querySelector('[data-action="theme"]');
  if (button) button.innerHTML=icon(theme==='dark'?'sun':'moon',19);
  for(const option of document.querySelectorAll('[data-theme-choice]')) option.setAttribute('aria-pressed',String(option.dataset.themeChoice===theme));
}
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if (action==='theme') setTheme(progress.profile.theme==='dark'?'light':'dark');
  if (action==='search') openSearch();
  if (action==='close') document.querySelector('#dialog')?.close();
  if (action==='menu') {collapsed=!collapsed;updateMenu();}
  const theme=event.target.closest('[data-theme-choice]')?.dataset.themeChoice;
  if (theme) setTheme(theme);
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    document.querySelector('#contenido')?.focus();
  }
});
document.addEventListener('submit',event=>{
  if (event.target.id!=='profile-form') return;
  event.preventDefault();
  progress.profile.name=new FormData(event.target).get('name').trim();
  persist();
  document.querySelector('.avatar').textContent=initials();
  toast('Perfil guardado.');
});
document.addEventListener('keydown',event=>{
  if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='k') {event.preventDefault();openSearch();}
  if (event.key==='Escape' && collapsed) {collapsed=false;updateMenu();document.querySelector('.breadcrumbs [data-action=menu]')?.focus();}
});
window.addEventListener('hashchange',()=>render({focus:true}));
applyTheme();
render();
