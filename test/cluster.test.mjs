import test from 'node:test';
import assert from 'node:assert/strict';
import {createCluster,execute,applyYaml,list,resourceBy,relationList,validateGoals,yamlOf,exportYaml} from '../dist/cluster.mjs';
import {lessons} from '../dist/catalog.mjs';
import {recordSuccess,readProgress,saveProgress,stats} from '../dist/progress.mjs';

function cmd(state,text,editor) {
  const result=execute(state,text,editor);
  assert.equal(result.ok,true,result.text);
  return result.text;
}

test('first pod checks inspection, creation and running image',()=>{
  const state=createCluster();
  cmd(state,'kubectl get nodes');
  cmd(state,'kubectl run hola --image=nginx:1.27');
  assert.deepEqual(validateGoals(state,lessons['primer-pod']),[true,true,true]);
  assert.ok(relationList(state).some(edge=>edge.to.endsWith('/hola')));
  assert.equal(execute(state,'sh -c whoami').ok,false);
});

test('scaling reconciles deployment and endpoints atomically',()=>{
  const state=createCluster('service');
  cmd(state,'kubectl scale deployment/atlas --replicas=3');
  assert.equal(list(state,'Pod').length,3);
  assert.deepEqual(validateGoals(state,lessons.replicas),[true,true]);
  assert.equal(resourceBy(state,'Service','atlas').status.endpoints.length,3);
  assert.equal(relationList(state).filter(edge=>edge.type==='tráfico').length,3);
  assert.equal(execute(state,'kubectl scale deployment/atlas --replicas=999').ok,false);
  assert.equal(list(state,'Pod').length,3);
});

test('YAML validation has no side effects and invalid batches leave no resources',()=>{
  const state=createCluster();
  const y=lessons.yaml.template.replace('MODO: dev','MODO: aula');
  assert.equal(applyYaml(state,y,{validate:true}).ok,true);
  assert.equal(list(state,'ConfigMap').length,0);
  assert.equal(applyYaml(state,y+'---\nkind: Invalid\n').ok,false);
  assert.equal(list(state,'ConfigMap').length,0);
  cmd(state,'kubectl apply -f editor.yaml',y);
  assert.deepEqual(validateGoals(state,lessons.yaml),[true,true]);
});

test('namespace isolation and context switching',()=>{
  const state=createCluster();
  cmd(state,'kubectl create ns equipo');
  cmd(state,'kubectl config set-context --current --namespace=equipo');
  cmd(state,'kubectl run demo --image=nginx');
  assert.deepEqual(validateGoals(state,lessons.namespaces),[true,true]);
  assert.equal(list(state,'Pod')[0].metadata.namespace,'equipo');
  assert.equal(cmd(state,'kubectl get pods -n default'),'No se encontraron recursos.');
  cmd(state,'kubectl delete ns equipo -n default');
  assert.equal(list(state,'Pod').length,0);
  assert.equal(state.activeNs,'default');
});

test('double incident needs successful image and selector changes',()=>{
  const state=createCluster('double');
  assert.deepEqual(validateGoals(state,lessons['incidencia-doble']),[false,false]);
  assert.match(cmd(state,'kubectl get events'),/ImagePullBackOff/);
  cmd(state,'kubectl rollout undo deployment/atlas');
  assert.deepEqual(validateGoals(state,lessons['incidencia-doble']),[true,false]);
  cmd(state,`kubectl patch svc atlas -p '{"spec":{"selector":{"app":"atlas"}}}'`);
  assert.deepEqual(validateGoals(state,lessons['incidencia-doble']),[true,true]);
});

test('workload updates, network policy and storage generate meaningful state',()=>{
  const rollout=createCluster('service');
  cmd(rollout,'kubectl set image deployment/atlas atlas=nginx:1.28');
  assert.deepEqual(validateGoals(rollout,lessons.rollout),[true,true,true]);
  assert.equal(applyYaml(rollout,lessons.politicas.template).ok,true);
  assert.deepEqual(validateGoals(rollout,lessons.politicas),[true,true]);
  assert.equal(resourceBy(rollout,'Service','atlas').status.phase,'Bloqueado');
  const volume=createCluster('volume');
  assert.equal(applyYaml(volume,lessons.almacenamiento.template).ok,true);
  assert.deepEqual(validateGoals(volume,lessons.almacenamiento),[true,true]);
});

test('secret values are redacted, and exports omit secrets',()=>{
  const state=createCluster('app');
  assert.equal(applyYaml(state,lessons.configuracion.template).ok,true);
  assert.deepEqual(validateGoals(state,lessons.configuracion),[true,true]);
  assert.doesNotMatch(yamlOf(resourceBy(state,'Secret','atlas-demo')),/ejemplo-simulado/);
  assert.doesNotMatch(exportYaml(state),/kind: Secret/);
});

test('successful lessons grant experience once and survive reload',()=>{
  const storage=new Map();
  const adapter={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
  const p=readProgress(adapter), lesson=lessons['primer-pod'], now=new Date('2026-11-25T12:00:00Z');
  assert.equal(recordSuccess(p,lesson,'academia',now),80);
  assert.equal(recordSuccess(p,lesson,'academia',now),0);
  assert.equal(saveProgress(adapter,p),true);
  assert.equal(stats(readProgress(adapter),now).xp,80);
  assert.equal(stats(readProgress(adapter),now).streak,1);
});

test('the command reports exactly the pods returned by its namespace and selector',()=>{
  const state=createCluster('service');
  cmd(state,'kubectl create namespace equipo');
  cmd(state,'kubectl run otro --image=nginx -n equipo --labels=app=otro');
  cmd(state,'kubectl run copia --image=nginx -n equipo --labels=app=atlas');

  assert.deepEqual(execute(state,'kubectl get pods').effect,{type:'read',keys:['Pod/default/atlas-r1-1','Pod/default/atlas-r1-2']});
  assert.deepEqual(execute(state,'kubectl get po -n equipo -l app=otro -o name').effect.keys,['Pod/equipo/otro']);
  assert.deepEqual(execute(state,'kubectl get pods -A -l app=atlas -o json').effect.keys,
    ['Pod/equipo/copia','Pod/default/atlas-r1-1','Pod/default/atlas-r1-2']);
  assert.deepEqual(execute(state,'kubectl get pods -n equipo -l app=inexistente').effect.keys,[]);
});

test('diagnostics identify the resources used to produce their output',()=>{
  const state=createCluster('service');
  assert.deepEqual(execute(state,'kubectl logs atlas-r1-2').effect.keys,['Pod/default/atlas-r1-2']);
  assert.deepEqual(execute(state,'kubectl describe deploy atlas').effect.keys,['Deployment/default/atlas']);
  assert.deepEqual(execute(state,'kubectl top pod atlas-r1-1').effect.keys,['Pod/default/atlas-r1-1']);
  assert.deepEqual(execute(state,'kubectl get endpoints atlas').effect.keys,
    ['Service/default/atlas','Pod/default/atlas-r1-1','Pod/default/atlas-r1-2']);

  const incident=createCluster('bad-image');
  assert.ok(execute(incident,'kubectl get events').effect.keys.includes('Pod/default/atlas-r2-1'));
  assert.equal(execute(incident,'kubectl logs no-existe').effect,undefined);
});

test('mutations report actual changes and controller side effects',()=>{
  const state=createCluster('service');
  const scaled=execute(state,'kubectl scale deployment/atlas --replicas=3');
  assert.equal(scaled.effect.type,'write');
  assert.ok(scaled.effect.created.includes('Pod/default/atlas-r1-3'));
  assert.ok(scaled.effect.updated.includes('Deployment/default/atlas'));
  assert.ok(scaled.effect.updated.includes('Service/default/atlas'));
  assert.ok(!scaled.effect.updated.includes('Pod/default/atlas-r1-1'));
  assert.deepEqual(scaled.effect.removed,[]);

  const removed=execute(state,'kubectl delete pod atlas-r1-3');
  assert.ok(removed.effect.removed.includes('Pod/default/atlas-r1-3'));
  assert.ok(removed.effect.created.includes('Pod/default/atlas-r1-3-1'));
  assert.equal(execute(state,'kubectl scale deployment/atlas --replicas=99').effect,undefined);
});

test('YAML apply reports created resources only after successful validation and commit',()=>{
  const state=createCluster();
  assert.equal(applyYaml(state,lessons.yaml.template,{validate:true}).effect,undefined);
  assert.equal(applyYaml(state,lessons.yaml.template+'---\nkind: Invalid\n').effect,undefined);
  assert.deepEqual(applyYaml(state,lessons.yaml.template).effect,
    {type:'write',created:['ConfigMap/default/preferencias'],updated:[],removed:[]});
});

test('bonus de XP sin pistas, conceptos y logros',async()=>{
  const {achievementStatus,unlockAchievements}=await import('../dist/achievements.mjs');
  const p=readProgress({getItem:()=>null}), now=new Date('2026-11-25T12:00:00Z');
  assert.equal(recordSuccess(p,lessons['primer-pod'],'academia',now,{hints:0}),100);
  assert.equal(recordSuccess(p,lessons.redes,'academia',now,{hints:2}),90);
  const s=stats(p,now);
  assert.equal(s.xp,190);
  assert.equal(s.clean,1);
  assert.ok(s.learned.has('primer-pod:Pod'));
  assert.deepEqual(unlockAchievements(p,now).map(a=>a.id),['primer-contacto']);
  assert.equal(unlockAchievements(p,now).length,0);
  assert.equal(achievementStatus(p,now).find(a=>a.id==='sin-ayuda').value,1);
});

test('todas las prácticas tienen pistas progresivas y conceptos como lista',()=>{
  for (const lesson of Object.values(lessons)) {
    assert.ok(Array.isArray(lesson.skills),lesson.id);
    if (lesson.xp) assert.ok(lesson.hints.length>=3,lesson.id+' necesita al menos 3 pistas');
  }
});

test('las órdenes kubectl de las pistas se ejecutan en orden en el escenario de su práctica',()=>{
  for (const lesson of Object.values(lessons).filter(item=>item.xp)) {
    const state=createCluster(lesson.seed);
    for (const hint of lesson.hints) {
      for (const [,command] of hint.matchAll(/`(kubectl [^`<]+)`/g)) {
        const result=execute(state,command);
        assert.equal(result.ok,true,lesson.id+': '+command+' → '+result.text);
      }
    }
  }
});

test('los errores de comando son comprensibles',()=>{
  const state=createCluster();
  const unknown=execute(state,'kubectl foo');
  assert.equal(unknown.ok,false);
  assert.match(unknown.text,/Comando desconocido/);
  assert.match(execute(state,'kubectl sc').text,/kubectl scale/);
  assert.match(execute(state,'kubectl rollout his').text,/status, history o undo/);
});
