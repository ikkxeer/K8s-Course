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
