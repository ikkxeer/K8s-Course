import {lessons, modules, modes, ranks, rankThresholds, totalLessons, lessonOrder, bonusRate} from './catalog.mjs';
import {stats} from './progress.mjs';
import {achievementStatus} from './achievements.mjs';
import {e,icon,lessonUrl,dateLabel,formatNumber} from './ui.mjs';

const chip = (name,color) => '<span class="icon-tile '+color+'">'+icon(name,21)+'</span>';
const bar = (amount,label) => '<div class="progress-track" role="progressbar" aria-label="'+e(label)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+amount+'"><i style="width:'+amount+'%"></i></div>';
const skillChips = (lesson,learned) => '<ul class="chip-list">'+lesson.skills.map(name=>'<li class="chip '+(learned.has(lesson.id+':'+name)?'learned':'')+'">'+(learned.has(lesson.id+':'+name)?icon('check',12)+' ':'')+e(name)+'</li>').join('')+'</ul>';
const pageHead = (symbol,title,description,extra='') => '<header class="page-head">'+chip(symbol,'mint')+'<div><h1>'+e(title)+'</h1><p>'+e(description)+'</p></div>'+extra+'</header>';

export function nextLessonId(progress) {
  return lessonOrder.find(id=>!progress.completed[id])??null;
}
const moduleOf = id => modules.find(module=>module.lessons.includes(id));

function ring(pct,{size=132,stroke=11,label='de la ruta'}={}) {
  const r=(size-stroke)/2, c=2*Math.PI*r, mid=size/2;
  return '<svg class="ring" viewBox="0 0 '+size+' '+size+'" role="img" aria-label="'+pct+' % '+label+'" style="--len:'+c.toFixed(1)+';--off:'+(c*(1-pct/100)).toFixed(1)+'">'+
    '<circle class="ring-track" cx="'+mid+'" cy="'+mid+'" r="'+r+'" stroke-width="'+stroke+'"/>'+
    '<circle class="ring-fill" cx="'+mid+'" cy="'+mid+'" r="'+r+'" stroke-width="'+stroke+'" transform="rotate(-90 '+mid+' '+mid+')"/>'+
    '<text x="'+mid+'" y="'+(mid+2)+'" text-anchor="middle" class="ring-num">'+pct+'<tspan class="ring-unit">%</tspan></text>'+
    '<text x="'+mid+'" y="'+(mid+21)+'" text-anchor="middle" class="ring-cap">'+label+'</text></svg>';
}

/* ───────── Ruta de aprendizaje ───────── */
function questStep(id,index,progress,s,currentId) {
  const lesson=lessons[id], done=!!progress.completed[id], current=id===currentId;
  const state=done?'done':current?'current':'todo';
  const bonus=Math.round(lesson.xp*bonusRate);
  if (done) return `<li class="quest-step done"><span class="quest-node" aria-hidden="true">${icon('check',17)}</span>
    <article class="quest-card compact"><h3>${e(lesson.title)}</h3><span class="xp">+${lesson.xp+(progress.bonus[id]??0)} XP</span><a class="text-link" href="${lessonUrl(id)}">Repetir</a></article></li>`;
  if (!current) return `<li class="quest-step todo"><span class="quest-node" aria-hidden="true">${index+1}</span>
    <article class="quest-card compact"><div><h3>${e(lesson.title)}</h3><p class="quest-sub">${icon('clock',13)} ${lesson.minutes} min · ${e(lesson.difficulty)}</p></div><span class="xp">+${lesson.xp} XP</span><a class="btn secondary small" href="${lessonUrl(id)}">Abrir</a></article></li>`;
  return `<li class="quest-step current">
    <span class="quest-node" aria-hidden="true">${index+1}</span>
    <article class="quest-card">
      <div class="quest-top"><div><p class="quest-eyebrow"><strong class="here">Tú estás aquí</strong></p><h3>${e(lesson.title)}</h3></div><span class="xp">+${lesson.xp} XP</span></div>
      <p class="quest-intro">${e(lesson.intro)}</p>
      <p class="quest-label">Aprenderás</p>${skillChips(lesson,s.learned)}
      <div class="quest-foot"><span class="quest-meta"><span>${icon('clock',14)} ${lesson.minutes} min</span><span>${icon('target',14)} ${lesson.objectives.length} objetivos</span><span class="bonus-hint">${icon('bulb',13)} +${bonus} XP extra sin pistas</span></span>
        <a class="btn primary small" href="${lessonUrl(id)}">${icon('play',14)} Empezar misión</a></div>
    </article></li>`;
}
export function missionHero(progress) {
  const s=stats(progress), currentId=nextLessonId(progress), current=currentId&&lessons[currentId];
  const index=currentId?lessonOrder.indexOf(currentId):totalLessons;
  const owner=currentId&&moduleOf(currentId);
  return current?`<section class="mission-hero" aria-labelledby="mission-title">
      <div class="mission-ring">${ring(s.pct)}</div>
      <div class="mission-main">
        <p class="hero-kicker">${icon('target',15)} <span>${s.finished.length?'TU SIGUIENTE MISIÓN':'EMPIEZA AQUÍ'} · NIVEL ${modules.indexOf(owner)+1} · PRÁCTICA ${index+1} DE ${totalLessons}</span></p>
        <h2 id="mission-title">${e(current.title)}</h2>
        <p class="mission-copy">${e(current.intro)}</p>
        <p class="mission-goal">${icon('spark',15)} <span>${e(owner.goal)}</span></p>
        ${skillChips(current,s.learned)}
        <div class="mission-actions"><a class="btn primary" href="${lessonUrl(currentId)}">${icon('play',16)} ${s.finished.length?'Empezar misión':'Empezar mi primera misión'}</a><span class="mission-reward">${icon('clock',15)} ${current.minutes} min · <strong>+${current.xp} XP</strong> · +${Math.round(current.xp*bonusRate)} extra sin pistas</span></div>
      </div>
    </section>`:`<section class="mission-hero done"><div class="mission-ring">${ring(100)}</div><div class="mission-main"><p class="hero-kicker">${icon('award',15)} <span>RUTA COMPLETADA</span></p><h2>Has recorrido toda la ruta</h2><p class="mission-copy">Sigue entrenando para consolidar lo aprendido.</p><div class="mission-actions"><a class="btn primary" href="#supervivencia">${icon('bolt',16)} Probar Supervivencia</a><a class="btn secondary" href="#desafios">${icon('target',16)} Desafíos</a></div></div></section>`;
}
export function academyView(progress) {
  const s=stats(progress), currentId=nextLessonId(progress), owner=currentId&&moduleOf(currentId);
  const header=pageHead('route','Ruta de aprendizaje','Sigue el camino: cada práctica construye sobre la anterior.',`<span class="tag mint">${s.finished.length} de ${totalLessons} prácticas</span>`);
  const mission=missionHero(progress);
  const worlds=modules.map((module,mi)=>{
    const done=module.lessons.filter(id=>progress.completed[id]).length, all=done===module.lessons.length;
    const active=owner===module;
    const boss=modes.find(mode=>mode.id===module.boss.mode);
    return `<details class="world ${all?'complete':''} ${active?'active':''}" ${active||(!owner&&mi===0)?'open':''}>
      <summary class="world-head">${chip(module.icon,all?'mint':module.color)}
        <div class="world-title"><p class="module-level">NIVEL ${mi+1}</p><h2>${e(module.title)}</h2><p>${e(module.goal)}</p></div>
        <div class="world-side"><span class="world-count">${all?'Completado':done+' / '+module.lessons.length}</span>${bar(Math.round(done/module.lessons.length*100),module.title)}</div>${icon('down',18)}
      </summary>
      <ol class="quest">${module.lessons.map(id=>questStep(id,lessonOrder.indexOf(id),progress,s,currentId)).join('')}</ol>
      <footer class="world-reward ${all?'earned':''}">
        <span class="reward-badge">${icon(all?'award':'shield',20)}</span>
        <div><strong>Insignia: ${e(module.badge)}</strong><small>${all?'Conseguida. ¡Ya dominas este nivel!':'Termina las '+module.lessons.length+' prácticas para conseguirla.'}</small></div>
        ${boss?`<a class="btn secondary small" href="#${boss.id}">${icon(boss.icon,14)} ${e(module.boss.label)}</a>`:''}
      </footer>
    </details>`;
  }).join('');
  return header+mission+'<div class="worlds">'+worlds+'</div>';
}

/* ───────── Mi progreso ───────── */
function heatmap(s) {
  const first=new Date(s.heat[0].date+'T12:00:00Z');
  const pad=(first.getUTCDay()+6)%7;
  const cells=[...Array(pad).fill(null),...s.heat];
  const level=count=>count===0?0:count===1?1:count===2?2:3;
  const active=s.heat.filter(day=>day.count).length;
  return `<div class="heat" role="img" aria-label="${active} días con práctica en las últimas 12 semanas">${cells.map(cell=>cell?`<i class="l${level(cell.count)}" title="${e(dateLabel(cell.date+'T12:00:00Z'))}: ${cell.count} ${cell.count===1?'práctica':'prácticas'}"></i>`:'<i class="pad"></i>').join('')}</div>
    <div class="heat-foot"><span>${active} ${active===1?'día activo':'días activos'} en 12 semanas</span><span class="heat-key">Menos <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i> Más</span></div>`;
}
function xpChart(s) {
  if (!s.series.length) return '<p class="empty-note">Completa tu primera práctica para empezar a ver tu curva de XP.</p>';
  const w=320,h=130,px=34,py=14,max=Math.max(1,...s.series.map(p=>p.xp)),top=Math.ceil(max/100)*100||100;
  const x=i=>px+(w-px-12)*i/Math.max(1,s.series.length-1), y=value=>h-py-(h-py*2-10)*value/top;
  const points=s.series.map((p,i)=>[x(i),y(p.xp)]);
  const line=points.map(([a,b],i)=>(i?'L':'M')+a.toFixed(1)+' '+b.toFixed(1)).join('');
  const area=line+'L'+points.at(-1)[0].toFixed(1)+' '+(h-py)+'L'+points[0][0].toFixed(1)+' '+(h-py)+'Z';
  const last=s.series.at(-1), end=points.at(-1);
  return `<svg class="xp-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="XP acumulado: ${formatNumber(last.xp)} XP el último día">
    ${[0,.5,1].map(f=>`<line class="grid" x1="${px}" x2="${w-6}" y1="${y(top*f).toFixed(1)}" y2="${y(top*f).toFixed(1)}"/><text class="axis" x="${px-6}" y="${(y(top*f)+3).toFixed(1)}" text-anchor="end">${Math.round(top*f)}</text>`).join('')}
    <path class="area" d="${area}"/><path class="line" d="${line}"/>
    ${points.map(([a,b],i)=>s.series[i].gain?`<circle class="pt" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="3.5"><title>${e(dateLabel(s.series[i].date+'T12:00:00Z'))}: +${s.series[i].gain} XP (total ${formatNumber(s.series[i].xp)})</title></circle>`:'').join('')}
    <circle class="end" cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="5"/>
    <text class="axis" x="${px}" y="${h-1}">${e(dateLabel(s.series[0].date+'T12:00:00Z'))}</text><text class="axis" x="${w-6}" y="${h-1}" text-anchor="end">Hoy</text>
  </svg>`;
}
function journeyStrip(progress,currentId) {
  return '<ol class="strip">'+modules.map((module,mi)=>{
    const done=module.lessons.filter(id=>progress.completed[id]).length;
    return `<li><div class="strip-head"><span class="module-level">NIVEL ${mi+1}</span><strong>${e(module.title)}</strong><span class="strip-count">${done}/${module.lessons.length}</span></div><div class="strip-dots">${module.lessons.map(id=>`<a class="dot ${progress.completed[id]?'done':''} ${id===currentId?'current':''}" href="${lessonUrl(id)}" title="${e(lessons[id].title)}${progress.completed[id]?' · completada':id===currentId?' · siguiente':''}" aria-label="${e(lessons[id].title)}${progress.completed[id]?', completada':id===currentId?', siguiente':', pendiente'}">${progress.completed[id]?icon('check',12):''}</a>`).join('<i class="dash"></i>')}</div></li>`;
  }).join('')+'</ol>';
}
function rankLadder(s) {
  return '<ol class="ladder">'+ranks.map((rank,i)=>`<li class="${i<s.level-1?'passed':i===s.level-1?'now':''}"><span class="ladder-dot">${i<s.level-1?icon('check',12):i+1}</span><strong>${e(rank)}</strong><small>${formatNumber(rankThresholds[i])} XP</small></li>`).join('')+'</ol>';
}
function skillsBoard(s) {
  return modules.map(module=>{
    const skills=module.lessons.flatMap(id=>lessons[id].skills.map(name=>({key:id+':'+name,name})));
    const got=skills.filter(skill=>s.learned.has(skill.key)).length;
    return `<div class="skill-group"><div class="mastery-label"><h3>${e(module.title)}</h3><span>${got} / ${skills.length}</span></div>${got?`<ul class="chip-list">${skills.filter(skill=>s.learned.has(skill.key)).map(skill=>`<li class="chip learned">${icon('check',12)} ${e(skill.name)}</li>`).join('')}</ul>`:'<p class="empty-note small">Aún nada por aquí.</p>'}</div>`;
  }).join('');
}
export function progressView(progress) {
  const s=stats(progress), currentId=nextLessonId(progress);
  const pct=s.goal?Math.round((s.xp-s.step)/(s.goal-s.step)*100):100;
  const status=achievementStatus(progress);
  const hours=s.minutes>=60?(Math.floor(s.minutes/60)+' h '+(s.minutes%60?s.minutes%60+' min':'')).trim():s.minutes+' min';
  const unlockedCount=status.filter(item=>item.unlocked).length;
  const ranked=[...status.filter(item=>item.unlocked),...status.filter(item=>!item.unlocked).sort((a,b)=>b.value/b.goal-a.value/a.goal)];
  const shownAch=ranked.slice(0,Math.max(4,Math.min(8,unlockedCount+3))), hiddenAch=ranked.slice(shownAch.length);
  const achCard=item=>`<article class="${item.unlocked?'earned':'unearned'}">${chip(item.icon,item.unlocked?item.color:'muted')}<h3>${e(item.title)}</h3><p>${e(item.text)}</p>${item.unlocked?`<span class="tag mint">${item.at?'Desbloqueado · '+dateLabel(item.at):'Desbloqueado'}</span>`:`${bar(Math.round(item.value/item.goal*100),item.title)}<small>${item.value} / ${item.goal}</small>`}</article>`;
  const stat=(symbol,color,label,value,suffix)=>`<section class="stat-card">${chip(symbol,color)}<div><h2>${label}</h2><p>${value} <small>${suffix}</small></p></div></section>`;
  return `${pageHead('chart','Mi progreso','Tu avance de un vistazo: lo que sabes, lo que te falta y cómo vas.')}
    <section class="progress-hero panel">
      <div class="ph-ring">${ring(s.pct)}</div>
      <div class="ph-main">
        <p class="hero-kicker">${icon('shield',15)} <span>RANGO ACTUAL · NIVEL ${s.level}</span></p>
        <h2>${e(s.rank)}</h2>
        <div class="xp-meter" role="progressbar" aria-label="Progreso hacia ${e(s.nextRank??s.rank)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <p class="xp-line"><strong>${formatNumber(s.xp)} XP</strong>${s.goal?` · te faltan <strong>${formatNumber(s.goal-s.xp)} XP</strong> para ${e(s.nextRank)}`:' · rango máximo alcanzado'}</p>
        ${currentId?`<a class="btn primary" href="${lessonUrl(currentId)}">${icon('play',16)} Seguir con «${e(lessons[currentId].title)}»</a>`:''}
      </div>
    </section>
    <div class="stats-grid stats-4">
      ${stat('terminal','mint','Prácticas',s.finished.length,'/ '+totalLessons)}
      ${stat('book','violet','Conceptos',s.learned.size,'/ '+s.skillTotal)}
      ${stat('flame','amber','Racha',s.streak,s.streak===1?'día':'días')}
      ${stat('clock','mint','Tiempo practicado',hours,'')}
    </div>
    <section class="panel progress-panel"><h2>Tu ruta de un vistazo</h2><p class="sub">Cada punto es una práctica. Haz clic para abrirla.</p>${journeyStrip(progress,currentId)}</section>
    <div class="progress-grid">
      <section class="panel progress-panel"><h2>Actividad</h2><p class="sub">Últimas 12 semanas</p>${heatmap(s)}</section>
      <section class="panel progress-panel"><h2>XP acumulado</h2><p class="sub">Últimos días</p>${xpChart(s)}</section>
    </div>
    <section class="panel progress-panel"><div class="section-line"><h2>Lo que ya has aprendido</h2><span class="tag ${s.learned.size?'mint':''}">${s.learned.size} de ${s.skillTotal} conceptos</span></div>${bar(Math.round(s.learned.size/s.skillTotal*100),'Conceptos aprendidos')}<div class="skills-board">${skillsBoard(s)}</div></section>
    <section class="panel progress-panel"><h2>Misiones</h2>
        <div class="goal-row"><span>${icon('target',16)} Diaria · valida una práctica hoy</span><strong>${s.daily?'Hecha':'0 / 1'}</strong></div>${bar(s.daily?100:0,'Misión diaria')}
        <div class="goal-row"><span>${icon('route',16)} Semanal · 3 prácticas distintas</span><strong>${Math.min(s.weekly,3)} / 3</strong></div>${bar(Math.min(100,Math.round(s.weekly/3*100)),'Misión semanal')}
        <div class="calendar-wrap">${s.calendar.map((day,i)=>`<div class="day ${day.today?'today':''} ${day.done?'done':''}"><span>${['L','M','X','J','V','S','D'][i]}</span><i>${day.done?icon('check',13):''}</i></div>`).join('')}</div>
      </section>
    <section class="panel progress-panel"><div class="section-line"><h2>Logros</h2><span class="tag ${unlockedCount?'mint':''}">${unlockedCount} de ${status.length}</span></div>
      <div class="achievements ach-grid">${shownAch.map(achCard).join('')}</div>
      ${hiddenAch.length?`<details class="more"><summary>Ver los ${hiddenAch.length} restantes</summary><div class="achievements ach-grid">${hiddenAch.map(achCard).join('')}</div></details>`:''}</section>`;
}
