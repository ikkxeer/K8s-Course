import {dump, load, loadAll, JSON_SCHEMA} from './assets/yaml.mjs';

const definitions = {
  Cluster:['cluster','clusters',''], Node:['node','nodes','no'], Namespace:['namespace','namespaces','ns'],
  Component:['component','components',''], Deployment:['deployment','deployments','deploy'], ReplicaSet:['replicaset','replicasets','rs'],
  Pod:['pod','pods','po'], Container:['container','containers',''], Service:['service','services','svc'],
  Ingress:['ingress','ingresses','ing'], ConfigMap:['configmap','configmaps','cm'], Secret:['secret','secrets',''],
  PersistentVolume:['persistentvolume','persistentvolumes','pv'], PersistentVolumeClaim:['persistentvolumeclaim','persistentvolumeclaims','pvc'],
  Role:['role','roles',''], RoleBinding:['rolebinding','rolebindings',''], NetworkPolicy:['networkpolicy','networkpolicies','netpol'],
  Endpoints:['endpoint','endpoints','ep'], Event:['event','events','ev']
};
const aliases = new Map(Object.entries(definitions).flatMap(([kind,names])=>[kind.toLowerCase(),...names.filter(Boolean)].map(name=>[name,kind])));
const scoped = new Set(['Cluster','Node','Namespace','PersistentVolume']);
const synthetic = new Set(['Cluster','Node','Container','Component','ReplicaSet','Endpoints','Event']);
const dnsName = /^(?=.{1,63}$)[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const imageName = /^(?=.{1,180}$)[a-zA-Z0-9][a-zA-Z0-9./_:@-]*$/;
const apis = {Deployment:'apps/v1', ReplicaSet:'apps/v1', Ingress:'networking.k8s.io/v1', NetworkPolicy:'networking.k8s.io/v1',Role:'rbac.authorization.k8s.io/v1',RoleBinding:'rbac.authorization.k8s.io/v1'};
const own = (value,key) => Object.hasOwn(value??{},key);
const object = value => !!value && typeof value==='object' && !Array.isArray(value);
const clone = value => structuredClone(value);
const idFor = (kind,name,namespace='default') => [kind,scoped.has(kind)?'':namespace,name].join('/');
const nsOf = resource => resource.metadata.namespace ?? '';
const nameOf = resource => resource.metadata.name;
const fail = message => {throw new Error(message);};
const at = (value,path) => path.split('.').reduce((item,key)=>own(item,key)?item[key]:undefined,value);
const memory = value => {
  const match = /^(\d+)(Ki|Mi|Gi)?$/.exec(String(value??''));
  return match ? Number(match[1])*({'Ki':1/1024,'Mi':1,'Gi':1024}[match[2]]??1/1048576) : NaN;
};
const matches = (selector, labels={}) => Object.entries(selector??{}).every(([key,value])=>own(labels,key) && labels[key]===value);
const create = (kind, name, namespace='default', extra={}) => ({
  apiVersion:apis[kind]??'v1', kind, metadata:{name,...(!scoped.has(kind)?{namespace}:{}),...extra.metadata},
  ...Object.fromEntries(Object.entries(extra).filter(([key])=>key!=='metadata'))
});
const withStatus = (item, phase='Ready', extra={}) => ({...item,status:{phase,...extra}});

export const kinds = Object.keys(definitions).filter(kind=>!['Event','Endpoints'].includes(kind));
export const kindOf = string => aliases.get(String(string??'').toLowerCase());
export const resourceBy = (state,kind,name,ns='default') => state.resources[idFor(kind,name,ns)];
export const resourceKey = resource => idFor(resource.kind,nameOf(resource),nsOf(resource));
export const list = (state,kind) => Object.values(state.resources).filter(resource=>!kind || resource.kind===kind);
export const statusOf = resource => resource.status?.phase??'Activo';
export const ready = resource => resource?.status?.phase==='Running';
export const errorStatus = phase => ['CrashLoopBackOff','OOMKilled','ImagePullBackOff','NotReady','Pending','Degradado','Sin endpoints','Sin ruta','Bloqueado'].includes(phase);
const assign = (state,resource) => {state.resources[resourceKey(resource)]=resource;return resource;};
const pick = (state,type,name,ns) => resourceBy(state,type,name,ns)??fail(`No existe ${type}/${name}${scoped.has(type)?'':' en '+ns}.`);
const getPodSpec = resource => resource.kind==='Deployment'?resource.spec.template.spec:resource.spec;
const specLabels = resource => resource.kind==='Deployment'?resource.spec.template.metadata.labels:resource.metadata.labels;
const deployment = (name,image,count=1,ns='default') => create('Deployment',name,ns,{spec:{
  replicas:count, selector:{matchLabels:{app:name}},
  template:{metadata:{labels:{app:name}},spec:{containers:[{name,image,ports:[{containerPort:80}]}]}}
}});
const standalone = (name,image,ns='default') => create('Pod',name,ns,{metadata:{labels:{app:name}},spec:{containers:[{name,image}]}});
const service = (name,selector,port=80,targetPort=80,ns='default') => create('Service',name,ns,{spec:{selector,ports:[{port,targetPort}]}});
const servicePods = (state,svc) => {
  const selector = svc.spec?.selector;
  if (!selector || !Object.keys(selector).length) return [];
  return list(state,'Pod').filter(pod=>nsOf(pod)===nsOf(svc) && ready(pod) && matches(selector,pod.metadata.labels));
};
const ingressRoutes = resource => (resource.spec?.rules??[]).flatMap(rule=>(rule.http?.paths??[]).map(path=>({host:rule.host,name:path.backend?.service?.name,port:path.backend?.service?.port?.number})));
const serviceRoute = (state,route,ns) => {
  const svc = resourceBy(state,'Service',route.name,ns);
  return svc?.spec?.ports?.some(port=>port.port===route.port) && svc.status?.phase==='Activo' ? svc : null;
};

function advanceRevision(state,item,old) {
  if (item.kind!=='Deployment') return;
  const key = resourceKey(item);
  if (!state.revisions[key]) state.revisions[key]=[];
  if (!old || JSON.stringify(old.spec.template)!==JSON.stringify(item.spec.template)) {
    state.revisions[key].push({id:(state.revisions[key].at(-1)?.id??0)+1,template:clone(item.spec.template)});
    state.revisions[key]=state.revisions[key].slice(-12);
  }
}

function canIngress(state,pod) {
  const policies = list(state,'NetworkPolicy').filter(policy=>nsOf(policy)===nsOf(pod) && policy.spec?.policyTypes?.includes('Ingress') && matches(policy.spec.podSelector.matchLabels,pod.metadata.labels));
  return !policies.length || policies.some(policy=>policy.spec.ingress?.some(rule=>!rule.from?.length && !rule.ports?.length));
}

export function reconcile(state) {
  const previousPodKeys = new Set(list(state,'Pod').filter(item=>item.sim?.generated).map(resourceKey));
  for (const item of list(state)) {
    if (item.sim?.generated) delete state.resources[resourceKey(item)];
  }
  for (const owner of list(state,'Deployment')) {
    const revisions = state.revisions[resourceKey(owner)]??[];
    for (const revision of revisions) {
      const latest = revision===revisions.at(-1);
      const name = nameOf(owner)+'-r'+revision.id;
      const count = latest ? owner.spec.replicas : 0;
      const rs = assign(state,withStatus(create('ReplicaSet',name,nsOf(owner),{metadata:{labels:owner.spec.template.metadata.labels},spec:{replicas:count},sim:{generated:true,owner:resourceKey(owner)}}),'Activo'));
      for (let i=1;i<=count;i++) {
        const indexedKey = idFor('Pod',name+'-'+i,nsOf(owner));
        const attempt = state.replacements[indexedKey]??0;
        const podName = name+'-'+i+(attempt?'-'+attempt:'');
        if (state.resources[idFor('Pod',podName,nsOf(owner))] && !previousPodKeys.has(idFor('Pod',podName,nsOf(owner)))) continue;
        assign(state,create('Pod',podName,nsOf(owner),{
          metadata:{labels:clone(revision.template.metadata.labels)},spec:clone(revision.template.spec),
          sim:{generated:true,owner:resourceKey(rs),deployment:resourceKey(owner),indexedKey}
        }));
      }
    }
  }
  for (const pv of list(state,'PersistentVolume')) pv.status={phase:'Available'};
  for (const claim of list(state,'PersistentVolumeClaim')) {
    const volume = list(state,'PersistentVolume').find(pv=>pv.status.phase==='Available' &&
      pv.spec.storageClassName===claim.spec?.storageClassName && memory(pv.spec.capacity.storage)>=memory(claim.spec?.resources?.requests?.storage) &&
      claim.spec.accessModes.every(mode=>pv.spec.accessModes.includes(mode)) && (!claim.spec.volumeName || nameOf(pv)===claim.spec.volumeName));
    claim.status={phase:volume?'Bound':'Pending',volume:volume?resourceKey(volume):null};
    if (volume) volume.status={phase:'Bound',claim:resourceKey(claim)};
  }

  const workers = list(state,'Node').filter(node=>node.sim.role==='worker' && node.status.phase==='Ready');
  for (const [index,pod] of list(state,'Pod').entries()) {
    const requested = pod.spec.nodeName;
    const node = requested ? workers.find(worker=>nameOf(worker)===requested) : workers[index % workers.length];
    const claims = (pod.spec.volumes??[]).map(volume=>volume.persistentVolumeClaim?.claimName).filter(Boolean);
    const containers = pod.spec.containers.map(container=>{
      const limit = memory(container.resources?.limits?.memory);
      const demand = pod.metadata.labels?.app==='atlas'?48:24;
      let phase = 'Running';
      if (!node || claims.some(name=>resourceBy(state,'PersistentVolumeClaim',name,nsOf(pod))?.status?.phase!=='Bound')) phase='Pending';
      else if (/(:missing|:inexistente|:bad-tag|:broken)$/.test(container.image)) phase='ImagePullBackOff';
      else if (container.command?.some(entry=>/^(exit 1|false)$/.test(entry))) phase='CrashLoopBackOff';
      else if (Number.isFinite(limit) && limit<demand) phase='OOMKilled';
      return {container,phase,demand};
    });
    const phase = containers.find(container=>container.phase!=='Running')?.phase??'Running';
    pod.status={phase,node:node?resourceKey(node):null,nodeName:node?nameOf(node):null,ready:containers.filter(container=>container.phase==='Running').length,total:containers.length,ingressAllowed:canIngress(state,pod)};
    for (const {container,phase:containerPhase,demand} of containers) {
      assign(state,withStatus(create('Container',nameOf(pod)+'·'+container.name,nsOf(pod),{spec:clone(container),sim:{generated:true,owner:resourceKey(pod),demand}}),containerPhase));
    }
  }
  for (const owner of [...list(state,'Deployment'),...list(state,'ReplicaSet')]) {
    const key = resourceKey(owner);
    const count = list(state,'Pod').filter(pod=>ready(pod) && (pod.sim?.owner===key || pod.sim?.deployment===key)).length;
    owner.status={phase:count===owner.spec.replicas?'Disponible':'Degradado',availableReplicas:count,replicas:owner.spec.replicas};
  }
  for (const svc of list(state,'Service')) {
    const selected = servicePods(state,svc);
    const reachable = selected.filter(pod=>pod.status.ingressAllowed);
    svc.status={phase:!selected.length?'Sin endpoints':reachable.length?'Activo':'Bloqueado',endpoints:selected.map(resourceKey),reachable:reachable.map(resourceKey)};
  }
  for (const route of list(state,'Ingress')) {
    const routes = ingressRoutes(route);
    route.status={phase:routes.length && routes.every(entry=>serviceRoute(state,entry,nsOf(route)))?'Activo':'Sin ruta',routes};
  }
  return state;
}

export function createCluster(seed='empty') {
  const state = {resources:{},activeNs:'default',inspected:new Set(),revisions:{},replacements:{},events:[],sequence:0};
  assign(state,withStatus(create('Cluster','laboratorio'),'Operativo'));
  for (const [name,role] of [['control-plane','control-plane'],['worker-01','worker'],['worker-02','worker']]) {
    assign(state,withStatus(create('Node',name,'',{sim:{role}})));
  }
  for (const name of ['default','kube-system']) assign(state,withStatus(create('Namespace',name,''),'Active'));
  for (const [name,description] of Object.entries({
    'kube-apiserver':'Expone el API de Kubernetes y valida las solicitudes.',
    'etcd':'Almacena el estado del clúster.',
    'kube-scheduler':'Selecciona un nodo para los Pods que necesitan planificación.',
    'kube-controller-manager':'Ejecuta controladores que reconcilian el estado.',
    'coredns':'Traduce nombres DNS internos a direcciones de servicios.'
  })) assign(state,withStatus(create('Component',name,'kube-system',{sim:{description}})));
  if (['app','service','bad-selector','bad-image','bad-memory','double'].includes(seed)) {
    const app = deployment('atlas','nginx:1.27',2);
    assign(state,app);
    advanceRevision(state,app);
    if (['bad-image','bad-memory','double'].includes(seed)) {
      const broken = clone(app);
      const container = broken.spec.template.spec.containers[0];
      if (seed==='bad-memory') container.resources={limits:{memory:'16Mi'}};
      else container.image='nginx:missing';
      assign(state,broken);
      advanceRevision(state,broken,app);
    }
    if (seed!=='app') assign(state,service('atlas',{app:['bad-selector','double'].includes(seed)?'portal':'atlas'}));
  }
  if (seed==='volume') assign(state,create('PersistentVolume','pv-aula','',{spec:{capacity:{storage:'4Gi'},accessModes:['ReadWriteOnce'],storageClassName:'aula',persistentVolumeReclaimPolicy:'Retain',hostPath:{path:'/datos/aula'}}}));
  reconcile(state);
  record(state,'Normal','SessionStarted','Se inició el clúster simulado.');
  return state;
}

function record(state,type,reason,message,resource) {
  state.events.push({type,reason,message,resource:resource?resourceKey(resource):null,sequence:++state.sequence});
  state.events=state.events.slice(-60);
}

export function eventsFor(state,resource) {
  const key = resource?resourceKey(resource):null;
  const podEvents = list(state,'Pod').filter(pod=>!ready(pod) && (!key || resourceKey(pod)===key || pod.sim?.deployment===key || pod.sim?.owner===key)).map(pod=>{
    const phase = statusOf(pod);
    const messages = {ImagePullBackOff:'El registro simulado no encontró la etiqueta de la imagen.',OOMKilled:'El contenedor superó el límite de memoria.',Pending:'No hay un nodo o volumen compatible.',CrashLoopBackOff:'El proceso del contenedor terminó con un error.'};
    return {type:'Warning',reason:phase,message:nameOf(pod)+': '+(messages[phase]??phase),resource:resourceKey(pod)};
  });
  const serviceEvents = list(state,'Service').filter(svc=>statusOf(svc)==='Sin endpoints' && (!key || resourceKey(svc)===key)).map(svc=>({type:'Warning',reason:'NoReadyEndpoints',message:nameOf(svc)+': no hay Pods listos que coincidan con el selector.',resource:resourceKey(svc)}));
  return [...state.events.filter(event=>!key || event.resource===key),...podEvents,...serviceEvents];
}

function onlyMap(value, label) {
  if (!object(value)) fail(label+' debe ser un mapa.');
  return value;
}
function strings(value,label) {
  for (const field of Object.values(onlyMap(value,label))) if (typeof field!=='string') fail(label+' requiere valores de texto.');
}
function array(value,label) {
  if (!Array.isArray(value)) fail(label+' debe ser una lista.');
  return value;
}
function validatePort(port,label) {
  if (!Number.isInteger(port) || port<1 || port>65535) fail(label+' debe ser un entero entre 1 y 65535.');
}
function validatePod(spec) {
  const containers = array(onlyMap(spec,'spec').containers,'containers');
  if (!containers.length || containers.length>4) fail('Declara de uno a cuatro contenedores.');
  const names = new Set();
  for (const container of containers) {
    if (!dnsName.test(container?.name??'') || !imageName.test(container?.image??'')) fail('Cada contenedor necesita name e image válidos.');
    if (names.has(container.name)) fail('Los nombres de contenedor deben ser únicos.');
    names.add(container.name);
    if (container.command!==undefined && !array(container.command,'command').every(entry=>typeof entry==='string')) fail('command debe contener cadenas.');
    for (const bounds of ['requests','limits']) {
      const value = container.resources?.[bounds]?.memory;
      if (value!==undefined && (!(memory(value)>0) || memory(value)>8192)) fail('Usa una cantidad de memoria positiva y hasta 8Gi.');
    }
    if (memory(container.resources?.requests?.memory)>memory(container.resources?.limits?.memory)) fail('El request de memoria debe ser menor o igual al límite.');
  }
  if (spec.volumes!==undefined) array(spec.volumes,'volumes').forEach(volume=>onlyMap(volume,'volumes[]'));
}

function inspectInput(item,depth=0,context={count:0,seen:new Set()}) {
  context.count++;
  if (depth>20 || context.count>30000) fail('El manifiesto supera los límites de complejidad.');
  if (!item || typeof item!=='object') return;
  if (context.seen.has(item)) fail('El simulador no admite referencias YAML compartidas o circulares.');
  context.seen.add(item);
  for (const key of Object.keys(item)) {
    if (['__proto__','constructor','prototype'].includes(key)) fail('Clave no admitida en el manifiesto: '+key);
    inspectInput(item[key],depth+1,context);
  }
}

const immutableSelector = (before, after) => JSON.stringify(Object.entries(before??{}).sort())!==JSON.stringify(Object.entries(after??{}).sort());
function normalize(state,raw,ns) {
  inspectInput(raw);
  const manifest = onlyMap(raw,'Documento');
  const kind = manifest.kind;
  if (!definitions[kind] || !own(definitions,kind) || synthetic.has(kind)) fail('Tipo no disponible: '+String(kind??'sin kind'));
  if (manifest.apiVersion!==(apis[kind]??'v1')) fail('apiVersion inválida para '+kind+'. Usa '+(apis[kind]??'v1')+'.');
  const name = manifest.metadata?.name??'';
  if (typeof name!=='string' || !dnsName.test(name)) fail('metadata.name debe ser un nombre DNS de hasta 63 caracteres.');
  const namespace = scoped.has(kind)?'':manifest.metadata?.namespace??ns;
  if (!scoped.has(kind) && !resourceBy(state,'Namespace',namespace,'')) fail('No existe el namespace '+String(namespace)+'.');
  const old = resourceBy(state,kind,name,namespace);
  if (old?.sim?.generated) fail('Modifica el recurso propietario de este objeto.');
  if (manifest.metadata?.labels!==undefined) strings(manifest.metadata.labels,'metadata.labels');
  const resource = clone(manifest);
  delete resource.status;
  delete resource.sim;
  if (scoped.has(kind)) delete resource.metadata.namespace;
  else resource.metadata.namespace=namespace;
  const spec = resource.spec;
  switch(kind) {
    case 'Deployment':
      onlyMap(spec,'spec');
      spec.replicas ??= 1;
      if (!Number.isInteger(spec.replicas) || spec.replicas<0 || spec.replicas>12) fail('spec.replicas debe ser un entero entre 0 y 12.');
      if (name.length>44) fail('En este simulador, un Deployment admite hasta 44 caracteres en el nombre.');
      strings(spec.selector?.matchLabels,'selector.matchLabels');
      if (!Object.keys(spec.selector.matchLabels).length || !matches(spec.selector.matchLabels,spec.template?.metadata?.labels)) fail('El selector debe coincidir con las etiquetas de la plantilla.');
      if (old && immutableSelector(old.spec.selector.matchLabels,spec.selector.matchLabels)) fail('El selector de un Deployment es inmutable.');
      strings(spec.template.metadata.labels,'template.metadata.labels');
      validatePod(spec.template.spec);
      break;
    case 'Pod':
      validatePod(spec);
      if (old && immutableSelector(old.spec.containers.map(c=>c.name),spec.containers.map(c=>c.name))) fail('El conjunto de contenedores de un Pod es inmutable.');
      break;
    case 'Service':
      onlyMap(spec,'spec');
      if (spec.selector!==undefined) strings(spec.selector,'spec.selector');
      if (!array(spec.ports,'spec.ports').length) fail('Declara al menos un puerto.');
      for (const port of spec.ports) {
        validatePort(port?.port,'port');
        const target = port?.targetPort??port.port;
        if (typeof target==='string' && dnsName.test(target)) continue;
        validatePort(target,'targetPort');
      }
      break;
    case 'Ingress':
      if (!array(spec?.rules,'spec.rules').length) fail('Agrega al menos una regla HTTP.');
      for (const rule of spec.rules) {
        if (typeof rule?.host!=='string' || !rule.host.includes('.')) fail('Cada regla necesita host.');
        if (!array(rule.http?.paths,'http.paths').length) fail('Cada regla necesita una ruta HTTP.');
        for (const path of rule.http.paths) {
          if (!dnsName.test(path?.backend?.service?.name??'') || !String(path?.path??'').startsWith('/') || !['Prefix','Exact','ImplementationSpecific'].includes(path?.pathType)) fail('Cada ruta necesita path, pathType y un Service válido.');
          validatePort(path.backend.service.port?.number,'backend.service.port.number');
        }
      }
      break;
    case 'ConfigMap':
      if (resource.data!==undefined) strings(resource.data,'data');
      break;
    case 'Secret': {
      if (resource.data!==undefined) strings(resource.data,'data');
      if (resource.stringData!==undefined) strings(resource.stringData,'stringData');
      if (resource.data===undefined && resource.stringData===undefined) fail('El Secret necesita data o stringData.');
      const keys = new Set([...Object.keys(resource.data??{}),...Object.keys(resource.stringData??{})]);
      resource.data=Object.fromEntries([...keys].map(key=>[key,'[redactado]']));
      delete resource.stringData;
      break;
    }
    case 'PersistentVolume':
      if (!(memory(spec?.capacity?.storage)>0) || !array(spec.accessModes,'accessModes').length) fail('El PV necesita capacidad y modos de acceso.');
      break;
    case 'PersistentVolumeClaim':
      if (!(memory(spec?.resources?.requests?.storage)>0) || !array(spec.accessModes,'accessModes').length) fail('El PVC necesita un tamaño y modos de acceso.');
      break;
    case 'Role':
      for (const rule of array(resource.rules,'rules')) {
        for (const key of ['apiGroups','resources','verbs']) if (!array(rule?.[key],key).every(value=>typeof value==='string')) fail(key+' debe contener cadenas.');
      }
      break;
    case 'RoleBinding':
      if (resource.roleRef?.kind!=='Role' || resource.roleRef.apiGroup!=='rbac.authorization.k8s.io' || !dnsName.test(resource.roleRef.name??'')) fail('Referencia un Role en roleRef.');
      if (!array(resource.subjects,'subjects').length || resource.subjects.some(subject=>!subject?.name || !['User','Group','ServiceAccount'].includes(subject.kind))) fail('Incluye sujetos válidos.');
      break;
    case 'NetworkPolicy':
      onlyMap(spec?.podSelector,'podSelector');
      if (spec.podSelector.matchLabels!==undefined) strings(spec.podSelector.matchLabels,'podSelector.matchLabels');
      if (spec.podSelector.matchExpressions?.length) fail('La política simulada utiliza matchLabels.');
      if (spec.policyTypes===undefined) spec.policyTypes=spec.egress?['Ingress','Egress']:['Ingress'];
      if (array(spec.policyTypes,'policyTypes').some(value=>!['Ingress','Egress'].includes(value))) fail('Usa Ingress o Egress en policyTypes.');
      if (spec.ingress!==undefined) for(const rule of array(spec.ingress,'ingress')) {
        if (Object.keys(onlyMap(rule,'ingress[]')).length) fail('El simulador permite reglas de ingreso vacías para permitir todo, o una lista ingress vacía para denegar.');
      }
      break;
  }
  return resource;
}

function update(state, item, ns) {
  const resource = normalize(state,item,ns);
  const old = state.resources[resourceKey(resource)];
  if (!old && list(state).filter(value=>!value.sim?.generated).length>=48) fail('El límite del laboratorio es de 48 recursos definidos.');
  assign(state,resource);
  advanceRevision(state,resource,old);
  record(state,'Normal',old?'Configured':'Created',resource.kind+'/'+nameOf(resource)+(old?' configurado.':' creado.'),resource);
  return resource;
}

function copyState(state) {return clone(state);}
function commit(target, source) {Object.assign(target,source);}

function mutationEffect(before, after) {
  const targets=new Set(after.events.filter(event=>event.sequence>before.sequence && event.resource).map(event=>event.resource));
  const entries=Object.entries(after.resources);
  return {
    type:'write',
    created:entries.filter(([key])=>!own(before.resources,key)).map(([key])=>key),
    updated:entries.filter(([key,resource])=>own(before.resources,key) &&
      (targets.has(key) || JSON.stringify(before.resources[key])!==JSON.stringify(resource))).map(([key])=>key),
    removed:Object.keys(before.resources).filter(key=>!own(after.resources,key))
  };
}

function parseDocuments(source) {
  if (typeof source!=='string' || !source.trim()) fail('El manifiesto está vacío.');
  if (source.length>24000) fail('El manifiesto no puede superar 24 000 caracteres.');
  const docs = loadAll(source,{schema:JSON_SCHEMA}).filter(value=>value!=null);
  if (!docs.length || docs.length>20) fail('Incluye entre 1 y 20 documentos por aplicación.');
  return docs;
}

export function applyYaml(state,source,{validate=false,ns=state.activeNs}={}) {
  try {
    const draft = copyState(state);
    const resources = parseDocuments(source).map(doc=>update(draft,doc,ns));
    reconcile(draft);
    const text=validate?`${resources.length} manifiesto(s) válido(s) para este simulador.`:resources.map(resource=>resource.kind.toLowerCase()+'/'+nameOf(resource)+' aplicado').join('\n');
    if (validate) return {ok:true,text};
    const effect=mutationEffect(state,draft);
    commit(state,draft);
    return {ok:true,text,effect};
  } catch (error) {return {ok:false,text:'Error: '+error.message};}
}

export function manifestOf(resource, {status=false}={}) {
  const item = clone(resource);
  delete item.sim;
  if (!status) delete item.status;
  return item;
}
export const yamlOf = resource => dump(manifestOf(resource),{noRefs:true,lineWidth:100});
export const exportYaml = state => list(state).filter(resource=>!synthetic.has(resource.kind) && !(resource.kind==='Namespace' && ['default','kube-system'].includes(nameOf(resource))) && resource.kind!=='Secret').map(yamlOf).join('---\n');

function merge(before, patch) {
  if (!object(patch)) return clone(patch);
  const result = object(before)?clone(before):{};
  for (const [key,value] of Object.entries(patch)) {
    if (value===null) delete result[key];
    else result[key]=merge(result[key],value);
  }
  return result;
}

function words(input) {
  const tokens=[];
  let token='', quote='', started=false;
  for (let i=0;i<input.length;i++) {
    const char=input[i];
    if (char==='\\' && quote!=="'" && i+1<input.length) {token+=input[++i];started=true;continue;}
    if (quote) {if (char===quote) quote='';else token+=char;continue;}
    if (char==='"' || char==="'") {quote=char;started=true;continue;}
    if (/\s/.test(char)) {if(started){tokens.push(token);token='';started=false;}continue;}
    token+=char;
    started=true;
  }
  if (quote) fail('Cierra las comillas del comando.');
  if (started) tokens.push(token);
  return tokens;
}

const booleanFlags = new Set(['--all-namespaces','-A','--show-labels','--previous','-p-prev','--current','--dry-run','--help']);
const valueFlags = new Set(['-n','--namespace','-o','--output','-l','--selector','--image','--replicas','--name','--port','--target-port','--patch','-p','--type','-f','--filename','--requests','--limits','-c','--container','--to-revision','--labels','--restart']);
function readFlags(tokens) {
  const args=[], flags=new Map();
  for (let i=0;i<tokens.length;i++) {
    const token=tokens[i];
    if (!token.startsWith('-') || token==='-') {args.push(token);continue;}
    const equal=token.indexOf('=');
    const key=equal<0?token:token.slice(0,equal);
    if (booleanFlags.has(key)) {flags.set(key,equal<0?true:token.slice(equal+1));continue;}
    if (!valueFlags.has(key)) fail('Opción no disponible: '+key);
    const value=equal<0?tokens[++i]:token.slice(equal+1);
    if (value===undefined || (value.startsWith('-') && value!=='-')) fail('Falta el valor de '+key+'.');
    flags.set(key,value);
  }
  return {args,flag:(...names)=>names.map(name=>flags.get(name)).find(value=>value!==undefined)};
}

const resourceArg = (raw,name) => {
  const [type,id,extra]=String(raw??'').split('/');
  const kind=kindOf(type);
  if (!kind || extra!==undefined) fail('Tipo de recurso no disponible: '+(type||'(vacío)'));
  return [kind,id??name];
};
const labels = raw => Object.fromEntries(String(raw??'').split(',').filter(Boolean).map(pair=>{
  const parts=pair.split('=');
  if(parts.length!==2 || !parts[0]) fail('Usa etiquetas clave=valor.');
  return parts;
}));
export function markInspected(state,resource) {
  state.inspected.add(resource.kind);
  state.inspected.add(resource.kind+'/'+nameOf(resource));
}
function summarize(resource) {
  return [nameOf(resource), statusOf(resource), resource.status?.nodeName??(resource.kind==='Node'?resource.sim.role:undefined)??'—'];
}
export const table = (header,rows) => {
  if (!rows.length) return 'No se encontraron recursos.';
  const widths = header.map((title,index)=>Math.max(title.length,...rows.map(row=>String(row[index]??'').length)));
  return [header,...rows].map(row=>row.map((column,index)=>index===row.length-1?String(column??''):String(column??'').padEnd(widths[index]+2,' ')).join('')).join('\n');
};

export function logsFor(resource,containerName) {
  if (resource.kind!=='Pod' && resource.kind!=='Container') return 'Los logs están disponibles en Pods y contenedores.';
  const phase = statusOf(resource);
  if (phase==='ImagePullBackOff' || phase==='Pending') return 'El contenedor todavía no ha iniciado.';
  if (phase==='OOMKilled') return '[sim] Iniciando proceso\n[sim] Terminación por límite de memoria (137)';
  if (phase==='CrashLoopBackOff') return '[sim] El proceso terminó con código de salida 1.';
  const containers = resource.kind==='Pod'?resource.spec.containers:[resource.spec];
  const selected = containerName?containers.find(container=>container.name===containerName):containers[0];
  if (!selected) return 'El contenedor indicado no existe.';
  return '[sim] Iniciando '+selected.name+' ('+selected.image+')\n[sim] Contenedor listo para recibir solicitudes';
}

export function metricsFor(state,resource) {
  const containers = resource.kind==='Pod'?list(state,'Container').filter(item=>item.sim.owner===resourceKey(resource)) : resource.kind==='Container'?[resource]:[];
  return containers.map(item=>({name:item.spec.name,cpu:ready(item)?'5m':'0m',memory:item.sim.demand+'Mi',limit:item.spec.resources?.limits?.memory??'—'}));
}

const help = `Comandos disponibles en esta simulación:
  kubectl get <tipo> [nombre] [-n ns] [-A] [-o yaml|json|wide]
  kubectl describe <tipo> <nombre>       kubectl get events
  kubectl logs <pod> [-c contenedor]     kubectl top pod
  kubectl run <pod> --image=<imagen>     kubectl create namespace <ns>
  kubectl create deployment <nombre> --image=<imagen>
  kubectl expose deployment <nombre> --port=80 [--name=<svc>]
  kubectl scale deployment/<nombre> --replicas=3
  kubectl set image deployment/<nombre> <contenedor>=<imagen>
  kubectl set resources deployment/<nombre> --limits=memory=128Mi
  kubectl rollout status|history|undo deployment/<nombre>
  kubectl label <tipo> <nombre> <clave>=<valor>
  kubectl patch <tipo> <nombre> --type=merge -p '<JSON>'
  kubectl apply -f editor.yaml           kubectl delete <tipo> <nombre>
  kubectl config set-context --current --namespace=<ns>
  pwd     ls     cat editor.yaml     clear
Tipos didácticos: Cluster, Component y Container.`;

function getResources(state,args,flag,ns,focus,describe=false) {
  const [kind,name] = resourceArg(args[0],args[1]);
  const output = flag('-o','--output');
  if (output && !['yaml','json','wide','name'].includes(output)) fail('Formato de salida disponible: yaml, json, wide o name.');
  if (kind==='Event') {
    const events = eventsFor(state).filter(event=>flag('-A','--all-namespaces') || !event.resource || event.resource.split('/')[1]==='' || event.resource.split('/')[1]===ns);
    focus.push(...events.flatMap(event=>state.resources[event.resource]?[event.resource]:[]));
    return table(['TIPO','MOTIVO','MENSAJE'],events.map(event=>[event.type,event.reason,event.message]));
  }
  let items = list(state,kind).filter(resource=>scoped.has(kind) || flag('-A','--all-namespaces') || nsOf(resource)===ns);
  if (kind==='Endpoints') items=list(state,'Service').filter(resource=>flag('-A','--all-namespaces') || nsOf(resource)===ns);
  if (name) items=items.filter(resource=>nameOf(resource)===name);
  if (name && !items.length) fail(`No existe ${kind}/${name}${scoped.has(kind)?'':' en '+ns}.`);
  if (flag('-l','--selector')) items=items.filter(resource=>matches(labels(flag('-l','--selector')),resource.metadata.labels));
  if (!name) state.inspected.add(kind);
  for (const item of items) markInspected(state,item);
  focus.push(...items.map(resourceKey));
  if (kind==='Endpoints') focus.push(...items.flatMap(item=>item.status.endpoints));
  if (kind==='Endpoints') return table(['NOMBRE','ENDPOINTS'],items.map(item=>[nameOf(item),item.status.endpoints.map(key=>key.split('/').at(-1)).join(', ')||'<ninguno>']));
  if (describe) return items.map(item=>{
    const events = eventsFor(state,item);
    const details = dump(manifestOf(item,{status:true}),{noRefs:true,lineWidth:110});
    return (item.sim?.description?item.sim.description+'\n\n':'')+details+(events.length?'\nEventos:\n'+events.map(event=>event.reason+'  '+event.message).join('\n'):'');
  }).join('\n---\n')||'No se encontraron recursos.';
  if (output==='yaml' || output==='json') {
    const docs = items.map(item=>manifestOf(item,{status:true}));
    if (output==='json') return JSON.stringify(name?docs[0]:{apiVersion:'v1',kind:'List',items:docs},null,2);
    return docs.map(item=>dump(item,{noRefs:true,lineWidth:110})).join('---\n')||'No se encontraron recursos.';
  }
  if (output==='name') return items.map(item=>item.kind.toLowerCase()+'/'+nameOf(item)).join('\n');
  const showNs=flag('-A','--all-namespaces')&&!scoped.has(kind);
  const showLabels=flag('--show-labels');
  const showReady = ['Deployment','ReplicaSet','Pod'].includes(kind);
  const showNode = kind==='Node' || output==='wide';
  return table([...(showNs?['NAMESPACE']:[]),'NOMBRE','ESTADO',...(showReady?['LISTOS']:[]),...(showNode?['NODO / ROL']:[]),...(showLabels?['ETIQUETAS']:[])],
    items.map(item=>{
      const [name,status,node]=summarize(item);
      return [...(showNs?[nsOf(item)]:[]),name,status,...(showReady?[kind==='Pod'?`${item.status.ready}/${item.status.total}`:`${item.status.availableReplicas}/${item.spec.replicas}`]:[]),...(showNode?[node]:[]),...(showLabels?[Object.entries(item.metadata.labels??{}).map(([k,v])=>k+'='+v).join(',')||'—']:[])];
    }));
}

function readOnly(state,verb,args,flag,ns,focus) {
  if (verb==='get' || verb==='describe') return getResources(state,args,flag,ns,focus,verb==='describe');
  if (verb==='logs') {
    const [kind,name]=args[0]?.includes('/')?resourceArg(args[0]):['Pod',args[0]];
    if (kind!=='Pod' && kind!=='Deployment') fail('Usa logs con un Pod o un Deployment.');
    const item = pick(state,kind,name,ns);
    const target = kind==='Pod'?item:list(state,'Pod').find(pod=>pod.sim?.deployment===resourceKey(item));
    if (!target) fail('El Deployment no tiene Pods.');
    markInspected(state,target);
    focus.push(resourceKey(target));
    return logsFor(target,flag('-c','--container'));
  }
  if (verb==='top') {
    const [kind,name]=resourceArg(args[0],args[1]);
    if (kind!=='Pod') fail('El laboratorio simula métricas de Pods.');
    if (name) pick(state,'Pod',name,ns);
    const pods=list(state,'Pod').filter(pod=>(flag('-A','--all-namespaces') || nsOf(pod)===ns) && (!name || nameOf(pod)===name));
    focus.push(...pods.map(resourceKey));
    return table(['POD','CONTENEDOR','CPU','MEMORIA','LÍMITE'],pods.flatMap(pod=>metricsFor(state,pod).map(metric=>[nameOf(pod),metric.name,metric.cpu,metric.memory,metric.limit])));
  }
  if (verb==='rollout' && ['status','history'].includes(args[0])) {
    const [kind,name]=resourceArg(args[1],args[2]);
    if (kind!=='Deployment') fail('rollout requiere un Deployment.');
    const item=pick(state,kind,name,ns);
    focus.push(resourceKey(item));
    if (args[0]==='status') return name+': '+item.status.availableReplicas+'/'+item.spec.replicas+' réplicas disponibles.';
    return table(['REVISIÓN','IMAGEN'],state.revisions[resourceKey(item)].map(revision=>[revision.id,revision.template.spec.containers.map(container=>container.image).join(', ')]));
  }
  return null;
}

function edit(state,verb,args,flag,ns,editor) {
  if (verb==='create' || verb==='run') {
    const [kind,name] = verb==='run'?['Pod',args[0]]:resourceArg(args[0],args[1]);
    if (!name) fail('Indica el nombre.');
    if (resourceBy(state,kind,name,ns)) fail(kind+'/'+name+' ya existe.');
    const item = kind==='Namespace'?create(kind,name,''):kind==='Deployment'?deployment(name,flag('--image'),1,ns):kind==='Pod'?standalone(name,flag('--image'),ns):null;
    if (!item) fail('Usa el editor YAML para crear '+kind+'.');
    if (flag('--labels') && kind==='Pod') item.metadata.labels=labels(flag('--labels'));
    if (flag('--dry-run')) return yamlOf(normalize(state,item,ns));
    update(state,item,ns);
    return kind.toLowerCase()+'/'+name+' creado';
  }
  if (verb==='apply') {
    const file=flag('-f','--filename');
    if (file!=='editor.yaml' && file!=='-') fail('Aplica el contenido con kubectl apply -f editor.yaml.');
    const res=applyYaml(state,editor,{ns});
    if (!res.ok) fail(res.text.replace(/^Error: /,''));
    return res.text;
  }
  if (verb==='config') {
    const target=flag('-n','--namespace');
    if (args[0]!=='set-context' || !flag('--current') || !target) fail('Usa kubectl config set-context --current --namespace=<ns>.');
    pick(state,'Namespace',target,'');
    state.activeNs=target;
    return 'El namespace activo es '+target+'.';
  }
  const sub = ['set','rollout'].includes(verb)?args[0]:null;
  const target = sub?args.slice(1):args;
  const [kind,name]=resourceArg(target[0],target[1]);
  if (!name) fail('Indica el nombre del recurso.');
  const item=pick(state,kind,name,ns);
  const values = target.slice(target[0].includes('/')?1:2);
  const manifest=manifestOf(item);
  if (verb==='expose') {
    if (!['Pod','Deployment'].includes(kind)) fail('expose admite Pods y Deployments.');
    const serviceName=flag('--name')??name;
    if (resourceBy(state,'Service',serviceName,ns)) fail('El Service '+serviceName+' ya existe.');
    const port=Number(flag('--port')??getPodSpec(item).containers[0].ports?.[0]?.containerPort??80);
    const rawTarget=flag('--target-port')??port;
    const targetPort=/^\d+$/.test(rawTarget)?Number(rawTarget):rawTarget;
    const selector=kind==='Deployment'?item.spec.selector.matchLabels:specLabels(item);
    update(state,service(serviceName,selector,port,targetPort,ns),ns);
    return 'service/'+serviceName+' creado';
  }
  if (verb==='delete') {
    if (['Node','Cluster','ReplicaSet','Component','Container'].includes(kind) || kind==='Namespace' && ['default','kube-system'].includes(name)) fail('El recurso está protegido por el simulador.');
    if (kind==='Namespace') {
      for (const child of list(state).filter(value=>nsOf(value)===name)) {
        delete state.revisions[resourceKey(child)];
        delete state.resources[resourceKey(child)];
      }
      if (state.activeNs===name) state.activeNs='default';
    }
    if (item.sim?.indexedKey) state.replacements[item.sim.indexedKey]=(state.replacements[item.sim.indexedKey]??0)+1;
    delete state.revisions[resourceKey(item)];
    delete state.resources[resourceKey(item)];
    record(state,'Normal','Deleted',kind+'/'+name+' eliminado.',item);
    return kind.toLowerCase()+'/'+name+' eliminado';
  }
  if (verb==='scale' && kind==='Deployment') {
    const count=flag('--replicas');
    if(!/^\d+$/.test(count??'')) fail('Incluye --replicas con una cantidad.');
    manifest.spec.replicas=Number(count);
  } else if (verb==='set' && ['image','resources'].includes(sub) && ['Deployment','Pod'].includes(kind)) {
    if (sub==='image') {
      const updates=labels(values.join(','));
      if (!Object.keys(updates).length) fail('Indica contenedor=imagen.');
      for (const [name,image] of Object.entries(updates)) {
        const container=getPodSpec(manifest).containers.find(item=>item.name===name);
        if (!container) fail('No existe el contenedor '+name+'.');
        container.image=image;
      }
    } else {
      if (kind!=='Deployment') fail('El laboratorio cambia recursos en la plantilla de un Deployment.');
      const requests=flag('--requests'), limits=flag('--limits');
      if (!requests && !limits) fail('Indica --requests o --limits.');
      for (const container of getPodSpec(manifest).containers) {
        if (flag('-c','--container') && flag('-c','--container')!==container.name) continue;
        container.resources ??={};
        if (requests) container.resources.requests={...container.resources.requests,...labels(requests)};
        if (limits) container.resources.limits={...container.resources.limits,...labels(limits)};
      }
    }
  } else if (verb==='rollout' && sub==='undo' && kind==='Deployment') {
    const revisions=state.revisions[resourceKey(item)];
    const revision=flag('--to-revision')?revisions.find(entry=>entry.id===Number(flag('--to-revision'))):revisions.at(-2);
    if (!revision) fail('No hay una revisión anterior disponible.');
    manifest.spec.template=clone(revision.template);
  } else if (verb==='label') {
    if (!values.length) fail('Indica clave=valor.');
    manifest.metadata.labels={...manifest.metadata.labels,...labels(values.join(','))};
  } else if (verb==='patch') {
    const source=flag('-p','--patch');
    if (!source) fail('Incluye -p con un parche JSON o YAML.');
    if ((flag('--type')??'merge')!=='merge') fail('Este laboratorio admite --type=merge.');
    const patch=load(source,{schema:JSON_SCHEMA});
    onlyMap(patch,'Parche');
    inspectInput(patch);
    const merged=merge(manifest,patch);
    if (merged.kind!==kind || merged.apiVersion!==item.apiVersion || merged.metadata?.name!==name || merged.metadata?.namespace!==item.metadata.namespace) fail('El parche no puede cambiar la identidad del recurso.');
    update(state,merged,ns);
    return kind.toLowerCase()+'/'+name+' modificado';
  } else fail('Operación no disponible. Consulta kubectl help.');
  update(state,manifest,ns);
  return kind.toLowerCase()+'/'+name+' modificado';
}

export function execute(state,input,editor='') {
  try {
    if (typeof input!=='string' || input.length>6000) fail('El comando supera el límite permitido.');
    const tokens=words(input.trim());
    const command=tokens.shift();
    if (!command) return {ok:true,text:''};
    if (command==='clear' && !tokens.length) return {ok:true,text:'',clear:true};
    if (command==='pwd' && !tokens.length) return {ok:true,text:'/laboratorio'};
    if (command==='ls' && !tokens.length) return {ok:true,text:'editor.yaml'};
    if (command==='cat' && tokens.length===1 && tokens[0]==='editor.yaml') return {ok:true,text:editor||'(vacío)'};
    if (command==='help' && !tokens.length) return {ok:true,text:help};
    if (command!=='kubectl') fail('Comando no disponible. Escribe help.');
    const {args,flag}=readFlags(tokens);
    const verb=args.shift();
    if (!verb || verb==='help' || flag('--help')) return {ok:true,text:help};
    const ns=flag('-n','--namespace')??state.activeNs;
    pick(state,'Namespace',ns,'');
    const focus=[];
    const text=readOnly(state,verb,args,flag,ns,focus);
    if (text!==null) return {ok:true,text,effect:{type:'read',keys:[...new Set(focus)]}};
    const draft=copyState(state);
    const result=edit(draft,verb,args,flag,ns,editor);
    reconcile(draft);
    const effect=verb==='config'
      ?{type:'context',keys:[idFor('Namespace',draft.activeNs,'')]}
      :mutationEffect(state,draft);
    commit(state,draft);
    return {ok:true,text:result,effect};
  } catch (error) {return {ok:false,text:'Error: '+error.message};}
}

export function validateGoals(state,lesson) {
  return lesson.objectives.map(goal=>{
    const resource=goal.type && goal.name ? resourceBy(state,goal.type,goal.name,goal.ns??'default'):null;
    const deployment = resourceBy(state,'Deployment',goal.name);
    const pod = resourceBy(state,'Pod',goal.name);
    const svc = resourceBy(state,'Service',goal.name);
    const binding = resourceBy(state,'RoleBinding',goal.name);
    const role = binding && resourceBy(state,'Role',binding.roleRef.name);
    const policy = resourceBy(state,'NetworkPolicy',goal.name);
    const route = resourceBy(state,'Ingress',goal.name);
    switch (goal.rule) {
      case 'inspect':return state.inspected.has(goal.type+(goal.name?'/'+goal.name:''));
      case 'exists':return !!resource;
      case 'field':return !!resource && at(resource,goal.key)===goal.value;
      case 'available':return deployment?.status?.availableReplicas===goal.count;
      case 'ready':return ready(pod);
      case 'podImage':return ready(pod) && pod.spec.containers.some(container=>new RegExp('(^|/)'+goal.image+'(?=[:@]|$)').test(container.image));
      case 'endpoints':return !!svc?.status?.reachable?.length && svc.status.reachable.every(key=>state.resources[key]?.metadata?.labels?.app==='atlas') && svc.spec.ports.some(port=>(port.targetPort??port.port)===80 || (port.targetPort??port.port)==='http');
      case 'secretKey':return own(resourceBy(state,'Secret',goal.name)?.data,goal.key);
      case 'route':return statusOf(route??{})==='Activo' && route.status.routes.some(entry=>entry.name===goal.backend && entry.host===goal.host && !!serviceRoute(state,entry,nsOf(route)));
      case 'status':return resource?.status?.phase===goal.value;
      case 'leastPrivilege':return !!role && binding.subjects.some(subject=>subject.kind==='User' && subject.name==='observador') && !!role.rules.length && role.rules.every(rule=>rule.apiGroups.length===1 && rule.apiGroups[0]==='' && rule.resources.length===1 && rule.resources[0]==='pods' && rule.verbs.every(verb=>['get','list','watch'].includes(verb))) && ['get','list','watch'].every(verb=>role.rules.some(rule=>rule.verbs.includes(verb)));
      case 'denyIngress':return !!policy?.spec?.policyTypes?.includes('Ingress') && policy.spec.podSelector.matchLabels?.app==='atlas' && list(state,'Pod').some(item=>item.metadata.labels?.app==='atlas') && list(state,'Pod').filter(item=>item.metadata.labels?.app==='atlas').every(item=>!item.status.ingressAllowed);
      default:return false;
    }
  });
}

export function relationList(state) {
  const lines=[];
  const add=(from,to,type)=>{if (state.resources[from] && state.resources[to] && !lines.some(line=>line.from===from && line.to===to && line.type===type)) lines.push({from,to,type});};
  for (const item of list(state)) {
    const key=resourceKey(item);
    if (item.kind==='Node' || item.kind==='Namespace') add(idFor('Cluster','laboratorio',''),key,'estructura');
    if (item.kind==='Component') add(idFor('Node','control-plane',''),key,'estructura');
    if (item.sim?.owner) add(item.sim.owner,key,'propiedad');
    if (item.kind==='Pod' && item.status.node) add(item.status.node,key,'estructura');
    if (item.kind==='Pod' && item.sim?.deployment) add(item.sim.deployment,key,'gestión');
    if (item.kind==='Service') for (const endpoint of item.status.endpoints) add(key,endpoint,item.status.reachable.includes(endpoint)?'tráfico':'bloqueado');
    if (item.kind==='Ingress') for (const route of item.status.routes) add(key,idFor('Service',route.name,nsOf(item)),item.status.phase==='Activo'?'tráfico':'bloqueado');
    if (item.kind==='PersistentVolumeClaim' && item.status.volume) add(key,item.status.volume,'volumen');
    if (item.kind==='RoleBinding') add(key,idFor('Role',item.roleRef.name,nsOf(item)),'referencia');
    if (item.kind==='NetworkPolicy') for (const pod of list(state,'Pod')) {
      if (nsOf(pod)===nsOf(item) && matches(item.spec.podSelector.matchLabels,pod.metadata.labels)) add(key,resourceKey(pod),'referencia');
    }
  }
  return lines;
}

export function builderManifest(type,name,namespace,target='') {
  if (type==='Deployment') return yamlOf(deployment(name,'nginx:1.27',2,namespace));
  if (type==='Pod') return yamlOf(standalone(name,'nginx:1.27',namespace));
  if (type==='Service') return yamlOf(service(name,{app:target||name},80,80,namespace));
  if (type==='ConfigMap') return yamlOf(create(type,name,namespace,{data:{MODO:'aula'}}));
  if (type==='Namespace') return yamlOf(create(type,name,''));
  fail('Tipo no disponible en el constructor.');
}
