import {lessons,modules,modes,totalLessons} from './catalog.mjs';
import {applyYaml,builderManifest,createCluster,errorStatus,eventsFor,execute,exportYaml,kinds,list,logsFor,markInspected,metricsFor,resourceKey,statusOf,validateGoals,goalHint,yamlOf} from './cluster.mjs';
import {mountScene,resourceColor,resourceGlyph,visibleResources} from './scene.mjs';
import {recordSuccess,stats} from './progress.mjs';
import {unlockAchievements} from './achievements.mjs';
import {celebrate} from './celebrate.mjs';
import {e,icon,lessonUrl} from './ui.mjs';

const phases=modes.find(mode=>mode.id==='supervivencia').lessons;
const stageKey='kubepath.guard.stage';
const defaultYaml='# Pega un manifiesto o carga uno desde el explorador.\n';
const modeNames={academia:'Academia',...Object.fromEntries(modes.map(mode=>[mode.id,mode.title]))};
const attributes={apiVersion:'apiVersion: v1',kind:'kind: Pod',metadata:'metadata:',name:'  name: demo',namespace:'  namespace: default',spec:'spec:',data:'data:',selector:'  selector:',replicas:'  replicas: 2',containers:'  containers:',image:'    image: nginx:1.27',ports:'  ports:'};
const inspectorTabs=[['status','Estado'],['yaml','YAML'],['logs','Logs'],['events','Eventos'],['metrics','Métricas']];
const toolButtons=[['zoom-in','Acercar','plus'],['zoom-out','Alejar','minus'],['pan','Desplazar cámara','move'],['camera','Restablecer cámara','rotate']];
const storedView=()=>{try{return localStorage.getItem('kubepath.vista')==='2d'?'2d':'3d';}catch{return '3d';}};
const saveView=value=>{try{localStorage.setItem('kubepath.vista',value);}catch{}};
const kindInfo={Cluster:'El conjunto completo de máquinas',Node:'Una máquina del clúster',Namespace:'Carpeta para separar recursos',Component:'Pieza interna del Control Plane',Deployment:'Gestiona las réplicas de una app',ReplicaSet:'Mantiene el número de Pods',Pod:'Tu contenedor en ejecución',Container:'Proceso dentro de un Pod',Service:'Dirección estable hacia los Pods',Ingress:'Entrada HTTP desde fuera',ConfigMap:'Configuración',Secret:'Datos sensibles',PersistentVolume:'Disco disponible',PersistentVolumeClaim:'Petición de disco',Role:'Conjunto de permisos',RoleBinding:'Asigna permisos a un usuario',NetworkPolicy:'Regla de red'};
const richHint=text=>e(text).replace(/`([^`]+)`/g,(match,code)=>/^kubectl /.test(code)?'<button type="button" class="cmd" data-lab="use-cmd" data-cmd="'+code+'" title="Pegar en la terminal">'+code+'</button>':'<code>'+code+'</code>');
const hello='Clúster simulado iniciado. Escribe kubectl help para consultar los comandos disponibles.';
const stageRead=()=>{try{return Number(sessionStorage.getItem(stageKey)??0);}catch{return 0;}};
const stageSave=n=>{try{sessionStorage.setItem(stageKey,String(n));}catch{}};
const button=(id,label,symbol,style='secondary small')=>'<button type="button" class="btn '+style+'" data-lab="'+id+'">'+(symbol?icon(symbol,16):'')+e(label)+'</button>';
const tab=(id,label,active,symbol)=>'<button type="button" class="tab" data-tab="'+id+'" aria-pressed="'+active+'">'+(symbol?icon(symbol,16):'')+e(label)+'</button>';
const option=value=>'<option>'+e(value)+'</option>';
const title=(label,symbol)=>'<div class="lab-title">'+icon(symbol,18)+'<h2>'+e(label)+'</h2></div>';

function highlight(source) {
  return source.split('\n').map(line=>{
    if (/^\s*#/.test(line)) return '<span class="syn-comment">'+e(line)+'</span>';
    const m=/^(\s*-?\s*)([A-Za-z][\w./-]*):(.*)$/.exec(line);
    return m?e(m[1])+'<span class="syn-key">'+e(m[2])+'</span>:<span class="syn-value">'+e(m[3])+'</span>':e(line);
  }).join('\n')+'\n';
}
function coach(state,lesson,done,attempts) {
  if (done.length && done.every(Boolean)) return 'El estado cumple los objetivos. Valídalo para registrar el progreso.';
  const pendingEndpoints=lesson.objectives.find((goal,i)=>!done[i]&&goal.rule==='endpoints');
  const why=pendingEndpoints?goalHint(state,pendingEndpoints):'';
  if (why) return why;
  if (lesson.category==='Incidencia') {
    if (!state.inspected.has('Pod') && !state.inspected.has('Service')) return '¿Hay Pods listos? ¿Qué destinos conoce el Service? Comprueba ambas partes de la ruta.';
    return list(state,'Pod').some(pod=>statusOf(pod)==='Running')
      ?'Hay Pods listos. Revisa cómo el Service los identifica y qué parte de la ruta sigue sin funcionar.'
      :'No hay Pods listos. Compara su estado con el evento más reciente. ¿Llegó el contenedor a iniciar?';
  }
  if (attempts>2) return 'Compara un objetivo pendiente con el estado actual. Puedes repasar los campos en la práctica de YAML.';
  const goal=lesson.objectives[done.indexOf(false)];
  if (goal?.rule==='inspect') return 'Selecciona un recurso en el explorador. En la vista Experto aparecen los componentes internos del clúster.';
  if (goal?.rule==='endpoints') return 'Compara el selector del Service con las etiquetas y la disponibilidad de los Pods.';
  if (goal?.rule==='available') return 'Compara las réplicas deseadas con las disponibles. Si difieren, revisa los eventos.';
  return 'Verifica el tipo, el namespace, el nombre y los campos del recurso que pide el primer objetivo pendiente.';
}
function terminalTemplate() {
  return '<div id="terminal-panel"><div class="terminal-body" role="log" aria-live="polite" aria-label="Salida de la terminal" tabindex="0"></div>'+
    '<form id="command-form" class="prompt"><span class="prompt-name" aria-hidden="true"></span><input id="command" aria-label="Comando de terminal" autocapitalize="off" autocomplete="off" spellcheck="false" maxlength="6000" placeholder="kubectl get nodes"><button class="icon-btn" type="submit" aria-label="Ejecutar comando">'+icon('play',15)+'</button></form>'+
    '<div class="terminal-actions"><button class="terminal-help" data-lab="help" type="button">'+icon('info',15)+' Comandos disponibles</button><button class="text-link" id="terminal-focus" data-lab="view-focus" type="button" hidden>Ver en 3D</button></div></div>';
}
function yamlTemplate() {
  return '<div id="yaml-panel" hidden><div class="yaml-toolbar"><span>editor.yaml</span>'+button('example','Ejemplo','code')+button('yaml-check','Validar','check')+button('yaml-apply','Aplicar','play','primary small')+'</div>'+
    '<div class="editor-wrap"><pre aria-hidden="true" class="yaml-highlight"></pre><textarea id="yaml-editor" aria-label="Editor YAML" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="24000"></textarea></div>'+
    '<div class="yaml-toolbar"><label><span class="visually-hidden">Insertar campo YAML</span><select id="yaml-complete"><option value="">Insertar campo YAML</option>'+Object.keys(attributes).map(option).join('')+'</select></label><small id="completion-hint">Tab completa una clave</small></div>'+
    '<pre class="inline-result" id="yaml-result" role="status"></pre></div>';
}
function builderTemplate() {
  return '<div id="builder-panel"><form id="builder-form"><label>Tipo<select name="kind" id="builder-kind">'+['Deployment','Pod','Service','ConfigMap','Namespace'].map(option).join('')+'</select></label>'+
    '<label>Nombre<input required name="name" maxlength="44" placeholder="mi-aplicacion"></label><label id="builder-namespace-label">Namespace<select name="namespace" id="builder-namespace"></select></label>'+
    '<label id="builder-target" hidden>Etiqueta del destino<input name="target" maxlength="63" placeholder="mi-aplicacion"></label><button type="submit" class="btn primary small">'+icon('plus',16)+' Crear recurso</button></form>'+
    '<div class="builder-actions">'+button('export','Descargar YAML','download')+'<p class="inline-result" id="builder-result" role="status"></p></div></div>';
}
function summary(resource) {
  const info=[['Nombre',resource.metadata.name],['Tipo',resource.kind],['Namespace',resource.metadata.namespace??'Ámbito de clúster'],['Estado',statusOf(resource)]];
  if (resource.kind==='Node') info.push(['Rol',resource.sim.role==='worker'?'Worker Node':'Control Plane']);
  if (resource.kind==='Pod') info.push(['Nodo',resource.status.nodeName??'Pendiente'],['Contenedores',resource.status.ready+' / '+resource.status.total+' listos']);
  if (['ReplicaSet','Deployment'].includes(resource.kind)) info.push(['Réplicas',resource.status.availableReplicas+' / '+resource.spec.replicas+' listas']);
  if (resource.kind==='Service') info.push(['Endpoints listos',resource.status.endpoints.length],['Destinos alcanzables',resource.status.reachable.length]);
  if (resource.status?.volume) info.push(['Volumen',resource.status.volume.split('/').at(-1)]);
  return '<dl>'+info.map(([key,value])=>'<div><dt>'+e(key)+'</dt><dd>'+e(value)+'</dd></div>').join('')+'</dl>'+
    (resource.sim?.description?'<p class="lab-note">'+e(resource.sim.description)+'</p>':'');
}
function inspectorBody(state,item,kind) {
  if (kind==='yaml') return '<pre>'+e(yamlOf(item))+'</pre>'+(!item.sim?.generated&&!['Cluster','Component','Node','Secret'].includes(item.kind)?button('edit-resource','Abrir en editor','code'):'');
  if (kind==='logs') return '<pre>'+e(logsFor(item))+'</pre>';
  if (kind==='events') {
    const events=eventsFor(state,item);
    return events.length?'<ul class="event-items">'+events.map(event=>'<li><strong class="'+(event.type==='Warning'?'warn':'')+'">'+e(event.reason)+'</strong><small>'+e(event.message)+'</small></li>').join('')+'</ul>':'<p class="lab-note">No hay eventos asociados.</p>';
  }
  if (kind==='metrics') {
    const metrics=metricsFor(state,item);
    return metrics.length?'<table class="metric-table"><thead><tr><th>Contenedor</th><th>CPU</th><th>Memoria</th><th>Límite</th></tr></thead><tbody>'+metrics.map(metric=>'<tr>'+[metric.name,metric.cpu,metric.memory,metric.limit].map(value=>'<td>'+e(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p class="lab-note">Selecciona un Pod o contenedor para ver métricas simuladas.</p>';
  }
  return summary(item);
}

export function mountLab(root,{lesson,mode,progress,persist,toast}) {
  const stage=phases.indexOf(lesson.id), survival=mode==='supervivencia', cert=mode==='certificacion', challenge=mode==='desafios', builder=mode==='constructor';
  if (survival&&stage===0) stageSave(0);
  if (survival&&stage>stageRead()) {
    root.innerHTML='<section class="panel progress-panel"><h1>Inicia tu guardia</h1><p>Valida cada incidencia para abrir la siguiente etapa.</p><a class="btn primary" href="'+lessonUrl(phases[0],mode)+'">Iniciar guardia</a></section>';
    return ()=>{};
  }
  const abort=new AbortController(), signal=abort.signal;
  const firstYaml=(!cert&&!challenge&&lesson.template)||defaultYaml;
  let state=createCluster(lesson.seed), editor=firstYaml, selected=null, inspect='status', current=builder?'builder':'terminal';
  let history=[], historyIndex=0, checks=[], feedback='', success=false, helper=false, hintCount=0, credited=false, celebrateLater=null;
  let operation=null, revealAffected=false;
  const options={expert:lesson.id==='arquitectura',view:storedView(),namespace:'*',kind:'*',links:true,pan:false,hideErrors:lesson.category==='Incidencia'&&lesson.difficulty==='Avanzado'};
  const route=modules.flatMap(module=>module.lessons);
  const next=route[route.indexOf(lesson.id)+1];
  const back=['sandbox','constructor'].includes(mode)?'resumen':mode;
  const incident=lesson.category==='Incidencia';
  function nextTarget() {
    if (survival) return stage===phases.length-1?{url:'#progreso',label:'Ver mi progreso'}:{url:lessonUrl(phases[stage+1],mode),label:'Siguiente incidencia'};
    if (mode==='academia') return next?{url:lessonUrl(next),label:'Siguiente: '+lessons[next].title}:{url:'#progreso',label:'Ver mi progreso'};
    return {url:'#'+back,label:'Volver a '+modeNames[mode]};
  }

  const guide='<aside class="lab-guide" aria-label="Guía de la práctica">'+
    (lesson.objectives.length?'<section id="lab-goals" tabindex="-1" class="panel lab-guide-card goals" aria-label="Objetivos de la práctica">'+title('Objetivos','target')+'<p class="goal-count"><strong id="goal-total"></strong> cumplidos</p><ul id="goal-list"></ul>'+button('validate','Validar objetivos','check','primary')+'<div id="goal-feedback" aria-live="polite"></div></section>':'')+
    (cert?'<p class="lab-note">Simulacro con pistas desactivadas.</p>':'<section class="panel lab-guide-card"><button class="helper-toggle" data-lab="coach" type="button" aria-expanded="false">'+icon('spark',19)+' <span>¿Atascado? Pide una pista</span>'+icon('down',15)+'</button><div id="helper-content" hidden></div></section>')+
    (cert||challenge||!lesson.concept?'':'<details class="panel lab-guide-card fold"><summary>'+icon(incident?'pulse':'book',17)+' <span>Concepto</span>'+icon('down',15)+'</summary><p>'+e(lesson.concept)+'</p>'+(lesson.skills?.length?'<p class="fold-label">Lo que dominarás</p><ul class="chip-list">'+lesson.skills.map(name=>'<li class="chip '+(progress.completed[lesson.id]?'learned':'')+'">'+e(name)+'</li>').join('')+'</ul>':'')+'</details>')+'</aside>';

  root.innerHTML='<div class="lab-header"><div><a class="text-link" href="#'+back+'">'+modeNames[mode]+'</a><h1>'+e(lesson.title)+'</h1><p class="lab-intro">'+e(lesson.intro)+'</p><div class="lab-meta"><span class="simulation-pill"><i></i> Simulación</span>'+
    (mode==='academia'&&route.includes(lesson.id)?'<span class="tag mint">Práctica '+(route.indexOf(lesson.id)+1)+' de '+route.length+'</span>':'')+(lesson.minutes?'<span class="tag">'+e(lesson.difficulty)+'</span><span>'+icon('clock',15)+' '+lesson.minutes+' min</span><span class="xp">+'+lesson.xp+' XP</span>':'')+
    (survival?'<span class="tag amber">Etapa '+(stage+1)+' / '+phases.length+'</span>':'')+
        '</div></div>'+button('reset','Reiniciar','rotate')+'</div>'+
    '<div class="lab-workspace">'+guide+'<div class="lab-interaction"><section class="panel topology" aria-label="Topología 3D">'+
    '<div class="topology-head">'+title('Vista del clúster','cluster')+'<div class="head-controls"><div class="segmented" aria-label="Tipo de vista"><button data-lab="view-3d" type="button">3D</button><button data-lab="view-2d" type="button">2D</button></div><div class="segmented" aria-label="Nivel de detalle"><button data-lab="basic" type="button" title="Solo lo esencial">Simple</button><button data-lab="expert" type="button" title="Incluye componentes internos">Detallado</button></div></div></div>'+
    '<details class="scene-options"><summary>'+icon('filter',15)+' <span>Filtros y opciones</span></summary><div class="scene-filters"><select id="ns-filter" aria-label="Filtrar por namespace"></select><select id="kind-filter" aria-label="Filtrar por tipo"><option value="*">Todos los tipos</option>'+kinds.map(option).join('')+'</select></div><div class="scene-checks"><label><input type="checkbox" id="links-switch" checked> Mostrar relaciones</label><label><input type="checkbox" id="traffic-switch" checked> Animar tráfico</label></div></details>'+
    '<div class="scene-stage"><canvas tabindex="0" aria-label="Escena 3D del clúster. Flechas para rotar, más y menos para acercar y alejar, 0 para restablecer. Explora los recursos en la lista."></canvas>'+
    '<div class="scene-tools">'+toolButtons.map(([action,label,symbol])=>'<button type="button" class="icon-btn" data-lab="'+action+'" title="'+label+'" aria-label="'+label+'">'+icon(symbol,17)+'</button>').join('')+'</div>'+
    '<div id="scene-hover" class="scene-hover" hidden></div></div>'+
    '<div class="scene-status"><div id="scene-operation" role="status" aria-live="polite"></div><button type="button" id="reveal-affected" class="text-link" data-lab="show-affected" hidden>Mostrar afectados</button><button type="button" id="clear-affected" class="icon-btn" data-lab="clear-affected" aria-label="Quitar resaltado" title="Quitar resaltado" hidden>'+icon('close',15)+'</button></div>'+
    '<div class="scene-legend"><span id="kind-key" class="kind-key"></span><span id="scene-count"></span></div>'+
    terminalTemplate()+yamlTemplate()+(builder?builderTemplate():'')+'</section>'+
    '<section class="panel explorer" aria-label="Explorador de recursos"><div class="explorer-head">'+title('Explorador','layers')+'<button id="resource-back" class="text-link" type="button" data-lab="resources" hidden>Ver recursos</button></div><div id="explorer-content"></div></section></div></div></div>'+
    '<dialog id="reset-dialog" class="dialog" aria-labelledby="reset-title"><h2 id="reset-title">Reiniciar laboratorio</h2><p>Se restaurarán los recursos iniciales y los cambios de esta sesión se perderán.</p><div class="reset-actions">'+button('cancel-reset','Cancelar')+button('confirm-reset','Reiniciar','rotate','primary small')+'</div></dialog>';

  const q=selector=>root.querySelector(selector);
  const command=q('#command'), area=q('#yaml-editor'), log=q('.terminal-body'), code=q('.yaml-highlight');
  const scene=mountScene(q('canvas'),{onSelect:selectResource,onHover:showHover});

  function visiblePhase(item) {
    const phase=statusOf(item), key=resourceKey(item);
    return options.hideErrors&&errorStatus(phase)&&key!==selected&&!operation?.keys.has(key)&&!state.inspected.has(item.kind+'/'+item.metadata.name)
      ?'Sin inspeccionar':phase;
  }
  function showHover(key) {
    const node=q('#scene-hover'), item=state.resources[key];
    node.hidden=!item;
    if (item) node.innerHTML='<strong>'+e(item.kind)+' · '+e(item.metadata.name)+'</strong><span>'+e(visiblePhase(item))+'</span>';
  }
  function setOperation(effect,label) {
    revealAffected=false;
    if (!effect) {operation=null;return;}
    const keys=new Set(effect.type==='write'?[...effect.created,...effect.updated]:effect.keys);
    const verb=label.startsWith('kubectl ')?label.trim().split(/\s+/).slice(0,4).join(' '):label;
    operation={effect,keys,label:verb};
    if(keys.size&&selected&&!keys.has(selected)) selected=null;
  }
  function drawOperation(visible) {
    const bar=q('#scene-operation'), wrapper=bar.parentElement, reveal=q('#reveal-affected'), clear=q('#clear-affected');
    q('#terminal-focus').hidden=!operation?.keys.size;
    clear.hidden=!operation;
    wrapper.dataset.effect=operation?.effect.type??'';
    if(!operation) {
      bar.innerHTML=icon('info',16)+'<span>'+(options.view==='2d'?'Arrastra para mover la vista.':'Arrastra para girar.')+' Haz clic en un recurso para inspeccionarlo.</span>';
      bar.removeAttribute('title');
      reveal.hidden=true;
      return;
    }
    const {keys,effect,label}=operation;
    const shown=visible.filter(item=>keys.has(resourceKey(item))).length;
    const hidden=keys.size-shown;
    const counts=effect.type==='write'
      ?[[effect.created.length,'creado','creados'],[effect.updated.length,'actualizado','actualizados'],[effect.removed.length,'eliminado','eliminados']]
      :[[keys.size,effect.type==='context'?'namespace activo':'consultado',effect.type==='context'?'namespaces activos':'consultados']];
    const detail=counts.filter(([count])=>count).map(([count,one,many])=>count+' '+(count===1?one:many)).join(' · ')||
      (effect.type==='write'?'Sin cambios en los recursos':'Sin recursos coincidentes');
    bar.innerHTML=icon(effect.type==='write'?'bolt':'target',17)+'<span><strong>'+e(detail)+'</strong><code>'+e(label)+'</code>'+
      (hidden?'<small>'+hidden+(hidden===1?' oculto por la vista':' ocultos por la vista')+'</small>':'')+'</span>';
    if(effect.removed?.length) bar.title='Eliminados: '+effect.removed.map(key=>key.split('/').at(-1)).join(', ');
    else bar.removeAttribute('title');
    reveal.hidden=!hidden;
  }

  function drawEditor() {
    if(area.value!==editor) area.value=editor;
    code.innerHTML=highlight(editor);
    code.scrollLeft=area.scrollLeft;
    code.scrollTop=area.scrollTop;
    const key=area.value.slice(0,area.selectionStart).split('\n').at(-1).trim();
    const candidate=Object.keys(attributes).find(name=>key&&name!==key&&name.startsWith(key));
    q('#completion-hint').textContent=candidate?'Tab: '+candidate:'Tab completa una clave';
    return candidate;
  }
  function drawTools() {
    for(const panel of ['terminal','yaml','builder']) {
      const node=q('#'+panel+'-panel');
      if (node) node.hidden=current!==panel;
      q('[data-tab="'+panel+'"]')?.setAttribute('aria-pressed',String(current===panel));
    }
    if(current==='yaml') drawEditor();
  }
  function drawLog(entries,replace=false) {
    if(replace) log.replaceChildren();
    const lines=entries.map(([type,text])=>{
      const line=document.createElement('pre');
      line.className=type;
      line.textContent=text;
      return line;
    });
    log.append(...lines);
    while(log.childElementCount>70) log.firstElementChild.remove();
    log.scrollTop=log.scrollHeight;
    q('.prompt-name').textContent=state.activeNs+' $';
  }
  function selectResource(key) {
    if(!state.resources[key]) return;
    selected=key;
    inspect='status';
    markInspected(state,state.resources[key]);
    refresh();
    q('#resource-back').focus({preventScroll:true});
  }
  function drawExplorer(resources) {
    const node=q('#explorer-content'),item=state.resources[selected];
    q('#resource-back').hidden=!item;
    const glyph=resource=>'<span class="resource-glyph" style="--resource:'+resourceColor(resource)+'">'+resourceGlyph(resource)+'</span>';
    if (item) {
      node.innerHTML='<div class="resource-heading">'+glyph(item)+'<strong>'+e(item.metadata.name)+'</strong><small>'+e(item.kind)+'</small></div>'+
        '<div class="tabs inspect-tabs">'+inspectorTabs.map(([key,name])=>tab('inspect/'+key,name,inspect===key)).join('')+'</div><div class="resource-detail">'+inspectorBody(state,item,inspect)+'</div>';
    } else {
      const affected=item=>operation?.keys.has(resourceKey(item))??false;
      const ordered=[...resources].sort((a,b)=>Number(affected(b))-Number(affected(a)));
      node.innerHTML=ordered.length?'<div class="resource-list">'+ordered.map(resource=>{
        const status=visiblePhase(resource);
        const effect=affected(resource)?operation.effect.type:'';
        return '<button type="button" data-resource="'+e(resourceKey(resource))+'"'+(effect?' data-effect="'+effect+'"':'')+'>'+glyph(resource)+'<span><strong>'+e(resource.metadata.name)+'</strong><small>'+e(resource.kind)+(resource.metadata.namespace?' · '+e(resource.metadata.namespace):'')+'</small></span><small class="'+(errorStatus(status)?'warn':'')+'">'+e(status)+'</small>'+(effect?'<span class="visually-hidden"> · Resaltado por la última operación</span>':'')+'</button>';
      }).join('')+'</div>':'<p class="lab-note">No hay recursos con estos filtros.</p>';
    }
  }
  function drawGoals() {
    checks=validateGoals(state,lesson);
    if(!checks.length) return;
    q('#goal-total').textContent=checks.filter(Boolean).length+' / '+checks.length;
    q('#goal-list').innerHTML=lesson.objectives.map((goal,i)=>'<li class="'+(checks[i]?'met':'')+'">'+icon(checks[i]?'check':'circle',16)+'<span class="visually-hidden">'+(checks[i]?'Cumplido: ':'Pendiente: ')+'</span>'+e(goal.text)+(!checks[i]&&goalHint(state,goal)?'<small class="goal-hint">'+icon('bulb',12)+' '+e(goalHint(state,goal))+'</small>':'')+'</li>').join('');
    let link='';
    if (success&&mode==='academia'&&next) link='<a class="btn secondary small" href="'+lessonUrl(next)+'">Siguiente práctica</a>';
    if (success&&survival) link=stage===phases.length-1?'<a class="btn secondary small" href="#progreso">Ver progreso</a>':'<a class="btn primary small" href="'+lessonUrl(phases[stage+1],mode)+'">Siguiente incidencia</a>';
    q('#goal-feedback').innerHTML=feedback?'<div class="feedback '+(success?'ok':'warn')+'"><strong>'+e(feedback)+'</strong>'+(success?'<p>'+e(lesson.explanation)+'</p>'+link:'')+'</div>':'';
  }
  function drawCoach() {
    if(cert) return;
    const node=q('#helper-content'), attempts=progress.attempts[lesson.id]??0;
    node.hidden=!helper;
    q('[data-lab="coach"]').setAttribute('aria-expanded',String(helper));
    if (!helper) return;
    node.innerHTML='<p>'+e(coach(state,lesson,checks,attempts))+'</p>'+
      (hintCount?'<ol class="hints">'+lesson.hints.slice(0,hintCount).map(hint=>'<li>'+richHint(hint)+'</li>').join('')+'</ol>':'')+
      (hintCount<lesson.hints.length?button('hint',hintCount?'Otra pista ('+hintCount+'/'+lesson.hints.length+')':'Mostrar pista','bulb'):'<p class="hint-note">Ya tienes todas las pistas. Prueba a ejecutar el último comando.</p>')+
      (lesson.xp?'<p class="hint-note">'+icon('info',13)+' Usar pistas no resta XP: solo pierdes el bonus de +25 %.</p>':'')+
      (attempts>2&&lesson.id!=='yaml'?'<a class="text-link" href="'+lessonUrl('yaml')+'">Repasar YAML</a>':'');
  }
  function refresh() {
    const namespaces=list(state,'Namespace').map(node=>node.metadata.name);
    if(options.namespace!=='*'&&!namespaces.includes(options.namespace)) options.namespace='*';
    const ns=q('#ns-filter'), nsHtml='<option value="*">Todos los namespaces</option>'+namespaces.map(option).join('');
    if(ns.innerHTML!==nsHtml) ns.innerHTML=nsHtml;
    ns.value=options.namespace;
    q('#kind-filter').value=options.kind;
    for(const [selector,pressed] of [['basic',!options.expert],['expert',options.expert],['pan',options.pan],['view-3d',options.view!=='2d'],['view-2d',options.view==='2d']]) q('[data-lab="'+selector+'"]').setAttribute('aria-pressed',String(pressed));
    if(builder) {
      const node=q('#builder-namespace'), previous=node.value||state.activeNs;
      node.innerHTML=namespaces.map(option).join('');
      node.value=namespaces.includes(previous)?previous:state.activeNs;
    }
    if(selected&&!state.resources[selected]) selected=null;
    const scope=item=>(options.kind==='*'||options.kind===item.kind) &&
      (options.namespace==='*' || (item.kind==='Namespace'?item.metadata.name===options.namespace:!item.metadata.namespace||item.metadata.namespace===options.namespace));
    options.reveal=new Set([...operation?.keys??[]].filter(key=>{
      const item=state.resources[key];
      return item && (revealAffected || operation.effect.type!=='write'&&scope(item));
    }));
    const visible=visibleResources(state,options);
    q('#kind-key').innerHTML=[...new Set(visible.map(item=>item.kind))].map(kind=>'<span title="'+e(kindInfo[kind]??'')+'"><i style="background:'+resourceColor({kind})+'"></i>'+e(kind)+'</span>').join('');
    q('#scene-count').textContent=visible.length+' '+(visible.length===1?'recurso':'recursos');
    q('.scene-stage').dataset.view=options.view;
    scene.update(state,options,selected,operation);
    drawOperation(visible);
    drawExplorer(visible);
    drawGoals();
    drawCoach();
  }

  function run(line) {
    const prompt=state.activeNs+' $ '+line;
    const response=execute(state,line,editor);
    if(response.effect||!response.ok||response.clear) setOperation(response.effect,line);
    if(!success) feedback='';
    drawLog(response.clear?[]:[['entered',prompt],[response.ok?'response':'warn',response.text]],response.clear);
    refresh();
  }
  function validate() {
    if(success||!checks.length) return;
    progress.attempts[lesson.id]=(progress.attempts[lesson.id]??0)+1;
    const pending=checks.filter(value=>!value).length;
    if (pending) feedback=pending===1?'Queda un objetivo pendiente.':'Quedan '+pending+' objetivos pendientes.';
    else {
      success=true;
      const before=stats(progress);
      const xp=recordSuccess(progress,lesson,mode,new Date(),{hints:cert?0:hintCount});
      const after=stats(progress);
      const unlocked=unlockAchievements(progress);
      const owner=modules.find(module=>module.lessons.includes(lesson.id));
      if(xp) celebrateLater={title:lesson.title,xp,bonus:progress.bonus[lesson.id]??0,level:after.level>before.level?after.rank:'',unlocked,skills:lesson.skills,done:after.finished.length,total:totalLessons,moduleDone:mode==='academia'&&!!owner&&owner.lessons.every(id=>progress.completed[id])&&!owner.lessons.every(id=>before.finished.includes(id))};
      if(survival) {
        stageSave(stage+1);
        if(stage===phases.length-1&&!credited) {progress.survival++;credited=true;}
      }
      feedback=(survival&&stage===phases.length-1?'Guardia completada':'Práctica completada')+(xp?' · +'+xp+' XP':'');
      q('[data-lab="validate"]').disabled=true;
      if(!celebrateLater) toast(feedback);
    }
    persist();
    if(celebrateLater) {
      const target=nextTarget();
      celebrate({...celebrateLater,next:target?.url,nextLabel:target?.label});
      celebrateLater=null;
    }
    refresh();
  }
  function applyEditor(validateOnly) {
    const response=applyYaml(state,editor,{validate:validateOnly});
    const node=q('#yaml-result');
    node.textContent=response.text;
    node.classList.toggle('warn',!response.ok);
    if(!validateOnly) {
      setOperation(response.effect,'Aplicar YAML');
      if(!success && response.ok) feedback='';
      refresh();
    }
  }
  function reset() {
    state=createCluster(lesson.seed);
    selected=null;
    editor=firstYaml;
    history=[]; historyIndex=0; feedback='';success=false;helper=false;hintCount=0;
    setOperation(null,'');
    Object.assign(options,{namespace:'*',kind:'*',links:true,pan:false});
    q('#links-switch').checked=true;
    q('#traffic-switch').checked=true;
    scene.setAnimation(true);
    scene.reset();
    const validateButton=q('[data-lab="validate"]');
    if(validateButton) validateButton.disabled=false;
    command.value='';
    q('#yaml-result').textContent='';
    if(builder) {
      q('#builder-form').reset();
      q('#builder-result').textContent='';
      q('#builder-target').hidden=true;
      q('#builder-namespace-label').hidden=false;
    }
    drawEditor();
    drawLog([['notice',hello]],true);
    refresh();
    toast('Laboratorio reiniciado.');
  }
  function download() {
    const text=exportYaml(state);
    if(!text) {toast('Agrega un recurso antes de descargar los manifiestos.');return;}
    const url=URL.createObjectURL(new Blob([text],{type:'application/yaml;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='kubepath-manifiestos.yaml';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  root.addEventListener('click',event=>{
    const target=event.target;
    const key=target.closest('[data-resource]')?.dataset.resource;
    const tabId=target.closest('[data-tab]')?.dataset.tab;
    const action=target.closest('[data-lab]')?.dataset.lab;
    if(key) selectResource(key);
    if(tabId?.startsWith('inspect/')) {
      inspect=tabId.split('/')[1];
      refresh();
      q('[data-tab="'+tabId+'"]').focus({preventScroll:true});
    } else if(tabId) {current=tabId;drawTools();}
    if(action==='resources') {selected=null;refresh();q('[data-resource]')?.focus({preventScroll:true});}
    if(action==='basic'||action==='expert') {options.expert=action==='expert';revealAffected=false;refresh();}
    if(action==='pan') {options.pan=!options.pan;refresh();}
    if(action==='view-3d'||action==='view-2d') {options.view=action==='view-2d'?'2d':'3d';saveView(options.view);scene.reset();refresh();}
    if(action==='use-cmd') {current='terminal';drawTools();command.value=target.closest('[data-cmd]').dataset.cmd;command.focus();}
    if(action==='show-affected') {revealAffected=true;refresh();q('canvas').focus({preventScroll:true});}
    if(action==='clear-affected') {setOperation(null,'');refresh();q('canvas').focus({preventScroll:true});}
    if(action==='view-focus') {
      q('.topology').scrollIntoView({block:'start'});
      q('canvas').focus({preventScroll:true});
    }
    if(action==='view-objectives') {
      q('#lab-goals').scrollIntoView({block:'nearest'});
      q('#lab-goals').focus({preventScroll:true});
    }
    if(action==='zoom-in'||action==='zoom-out') scene.zoomBy(action==='zoom-in'?1.15:1/1.15);
    if(action==='camera') scene.reset();
    if(action==='help') {run('kubectl help');command.focus();}
    if(action==='validate') validate();
    if(action==='coach') {helper=!helper;drawCoach();}
    if(action==='hint') {
      hintCount++;
      drawCoach();
      (q('[data-lab="hint"]')??q('[data-lab="coach"]')).focus({preventScroll:true});
    }
    if(action==='edit-resource'&&selected) {editor=yamlOf(state.resources[selected]);current='yaml';drawTools();area.focus();}
    if(action==='yaml-check'||action==='yaml-apply') applyEditor(action==='yaml-check');
    if(action==='example') {
      const snippet=builderManifest('ConfigMap','demo-config',state.activeNs);
      const next=editor===defaultYaml||!editor.trim()?snippet:editor.trimEnd()+'\n---\n'+snippet;
      if(next.length>24000) {toast('El editor ha alcanzado el límite de tamaño.');return;}
      editor=next;drawEditor();area.focus();
    }
    if(action==='reset') q('#reset-dialog').showModal();
    if(action==='cancel-reset'||action==='confirm-reset') {
      q('#reset-dialog').close();
      if(action==='confirm-reset') reset();
    }
    if(action==='export') download();
  },{signal});
  root.addEventListener('change',event=>{
    const {id,value,checked}=event.target;
    if(id==='ns-filter'||id==='kind-filter') {options[id==='ns-filter'?'namespace':'kind']=value;selected=null;revealAffected=false;refresh();}
    if(id==='links-switch') {options.links=checked;refresh();}
    if(id==='traffic-switch') scene.setAnimation(checked);
    if(id==='yaml-complete'&&value) {
      const text=attributes[value]+'\n';
      if(area.value.length+text.length<=24000) area.setRangeText(text,area.selectionStart,area.selectionEnd,'end');
      editor=area.value;drawEditor();area.focus();event.target.value='';
    }
    if(id==='builder-kind') {
      q('#builder-target').hidden=value!=='Service';
      q('#builder-namespace-label').hidden=value==='Namespace';
    }
  },{signal});
  root.addEventListener('submit',event=>{
    const form=event.target;
    if(form.id==='command-form') {
      event.preventDefault();
      const line=command.value.trim();
      if(!line) return;
      history=[...history,line].slice(-50);
      historyIndex=history.length;
      command.value='';
      run(line);command.focus();
    }
    if(form.id==='builder-form') {
      event.preventDefault();
      const fields=new FormData(form);
      const text=builderManifest(fields.get('kind'),fields.get('name').trim(),fields.get('namespace'),fields.get('target').trim());
      const response=applyYaml(state,text);
      const node=q('#builder-result');
      node.textContent=response.text;
      node.classList.toggle('warn',!response.ok);
      setOperation(response.effect,'Crear recurso');
      refresh();
    }
  },{signal});
  command.addEventListener('keydown',event=>{
    if(!history.length||!['ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    historyIndex=Math.max(0,Math.min(history.length,historyIndex+(event.key==='ArrowUp'?-1:1)));
    command.value=history[historyIndex]??'';
  },{signal});
  for(const event of ['input','scroll','click','keyup']) area.addEventListener(event,()=>{editor=area.value;drawEditor();},{signal});
  area.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||event.shiftKey) return;
    const key=drawEditor();
    if(!key) return;
    event.preventDefault();
    const start=editor.lastIndexOf('\n',area.selectionStart-1)+1;
    if(editor.length+attributes[key].length<=24000) area.setRangeText(attributes[key],start,area.selectionEnd,'end');
    editor=area.value;drawEditor();
  },{signal});
  drawTools();
  drawLog([['notice',hello]]);
  refresh();
  return ()=>{abort.abort();scene.destroy();};
}
