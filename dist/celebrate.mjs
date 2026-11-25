import {e,icon,formatNumber} from './ui.mjs';

const praise = ['¡Bien hecho!','¡Así se hace!','¡Otro paso más!','¡Clúster domado!','¡Esto ya es tuyo!'];
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function confetti(canvas) {
  const ctx=canvas.getContext('2d');
  const styles=getComputedStyle(document.documentElement);
  const colors=['--mint','--violet','--amber','--blue'].map(name=>styles.getPropertyValue(name).trim()||'#78f2c2');
  const ratio=window.devicePixelRatio||1;
  const width=canvas.clientWidth, height=canvas.clientHeight;
  canvas.width=width*ratio; canvas.height=height*ratio;
  ctx.scale(ratio,ratio);
  const pieces=Array.from({length:90},(_,i)=>({x:width/2+(Math.random()-.5)*60,y:height*.32,vx:(Math.random()-.5)*9,vy:-Math.random()*9-3,size:5+Math.random()*5,spin:Math.random()*6,vs:(Math.random()-.5)*.35,color:colors[i%colors.length]}));
  const start=performance.now();
  let frame;
  const tick=now=>{
    const elapsed=now-start;
    ctx.clearRect(0,0,width,height);
    for (const p of pieces) {
      p.vy+=.28; p.vx*=.99; p.x+=p.vx; p.y+=p.vy; p.spin+=p.vs;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.spin);
      ctx.globalAlpha=Math.max(0,1-elapsed/2600);
      ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);
      ctx.restore();
    }
    if (elapsed<2600) frame=requestAnimationFrame(tick); else ctx.clearRect(0,0,width,height);
  };
  frame=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(frame);
}

function countUp(node,target) {
  if (reduced()) {node.textContent='+'+formatNumber(target);return;}
  const start=performance.now(), duration=900;
  const tick=now=>{
    const t=Math.min(1,(now-start)/duration);
    node.textContent='+'+formatNumber(Math.round(target*(1-Math.pow(1-t,3))));
    if (t<1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Muestra la pantalla de recompensa tras completar una práctica. */
export function celebrate({title,xp,bonus,level,unlocked=[],skills=[],done,total,moduleDone,next,nextLabel}) {
  document.querySelector('#celebrate')?.remove();
  const dialog=document.createElement('dialog');
  dialog.id='celebrate'; dialog.className='dialog celebrate'; dialog.setAttribute('aria-labelledby','celebrate-title');
  const pct=Math.round(done/total*100);
  dialog.innerHTML=`<canvas aria-hidden="true"></canvas>
    <div class="celebrate-body">
      <span class="celebrate-badge">${icon(moduleDone?'award':'check',34)}</span>
      <p class="celebrate-kicker">${moduleDone?'Nivel superado':'Práctica completada'}</p>
      <h2 id="celebrate-title">${e(praise[Math.floor(Math.random()*praise.length)])}</h2>
      <p class="celebrate-sub">${e(title)}</p>
      <div class="celebrate-xp"><strong data-count>+0</strong><span>XP</span></div>
      ${bonus?`<p class="celebrate-bonus">${icon('bulb',15)} Incluye +${bonus} XP por resolverla sin pistas</p>`:'<p class="celebrate-bonus muted">Resuélvela sin pistas la próxima vez para ganar +25 % XP</p>'}
      ${level?`<div class="celebrate-level">${icon('shield',20)}<div><small>Nuevo rango</small><strong>${e(level)}</strong></div></div>`:''}
      ${skills.length?`<div class="celebrate-block"><h3>Has aprendido</h3><ul class="chip-list">${skills.map(name=>`<li class="chip learned">${icon('check',12)} ${e(name)}</li>`).join('')}</ul></div>`:''}
      ${unlocked.length?`<div class="celebrate-block"><h3>${unlocked.length>1?'Logros desbloqueados':'Logro desbloqueado'}</h3><ul class="unlocked-list">${unlocked.map(item=>`<li>${icon(item.icon,18)}<span><strong>${e(item.title)}</strong><small>${e(item.text)}</small></span></li>`).join('')}</ul></div>`:''}
      <div class="celebrate-route"><div class="progress-track" role="progressbar" aria-label="Ruta completada" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><span>${done} de ${total} prácticas · ${pct} %</span></div>
      <div class="celebrate-actions">
        ${next?`<a class="btn primary" href="${e(next)}" data-close>${icon('play',16)} ${e(nextLabel)}</a>`:''}
        <button class="btn secondary" type="button" data-close>Quedarme aquí</button>
      </div>
    </div>`;
  document.body.append(dialog);
  let stop=()=>{};
  dialog.addEventListener('click',event=>{if (event.target.closest('[data-close]')||event.target===dialog) dialog.close();});
  dialog.addEventListener('close',()=>{stop();dialog.remove();});
  dialog.showModal();
  countUp(dialog.querySelector('[data-count]'),xp);
  if (!reduced()) stop=confetti(dialog.querySelector('canvas'));
  (dialog.querySelector('.btn.primary')??dialog.querySelector('.btn'))?.focus();
}
