import {lessons, modules} from './catalog.mjs';
import {stats} from './progress.mjs';

const incidents = modules.find(module=>module.id==='diagnostico').lessons;
const modeKinds = state => new Set(Object.keys(state.modes).map(key=>key.split('/')[0]));
const perDayMax = state => Math.max(0,...Object.values(state.days).map(ids=>ids.length));
const incidentsDone = state => incidents.filter(id=>state.completed[id]).length;

export const achievements = [
  {id:'primer-contacto',icon:'terminal',color:'mint',title:'Primer contacto',text:'Completa tu primera práctica.',measure:(s)=>[s.finished.length,1]},
  {id:'ritmo',icon:'flame',color:'amber',title:'Ritmo constante',text:'Practica tres días seguidos.',measure:(s)=>[s.best,3]},
  {id:'semana-de-hierro',icon:'flame',color:'amber',title:'Semana de hierro',text:'Practica siete días seguidos.',measure:(s)=>[s.best,7]},
  {id:'sin-ayuda',icon:'bulb',color:'violet',title:'Sin chuletas',text:'Completa 3 prácticas sin usar pistas.',measure:(s)=>[s.clean,3]},
  {id:'maraton',icon:'bolt',color:'blue',title:'Maratón',text:'Completa 3 prácticas en un mismo día.',measure:(s,state)=>[perDayMax(state),3]},
  {id:'primer-nivel',icon:'layers',color:'mint',title:'Nivel superado',text:'Termina todas las prácticas de un nivel.',measure:(s)=>[s.modulesDone,1]},
  {id:'bajo-presion',icon:'pulse',color:'violet',title:'Bajo presión',text:'Resuelve dos incidencias.',measure:(s,state)=>[incidentsDone(state),2]},
  {id:'guardia',icon:'bolt',color:'blue',title:'Guardia completa',text:'Termina una sesión de Supervivencia.',measure:(s,state)=>[state.survival,1]},
  {id:'polivalente',icon:'target',color:'mint',title:'Polivalente',text:'Practica en tres modos distintos.',measure:(s,state)=>[modeKinds(state).size,3]},
  {id:'coleccionista',icon:'book',color:'violet',title:'Coleccionista',text:'Aprende 30 conceptos.',measure:(s)=>[s.learned.size,30]},
  {id:'mitad',icon:'route',color:'amber',title:'Mitad del camino',text:'Completa la mitad de la ruta.',measure:(s)=>[s.finished.length,Math.ceil(Object.values(lessons).filter(l=>l.xp).length/2)]},
  {id:'maestro',icon:'award',color:'amber',title:'Maestro del clúster',text:'Completa toda la ruta.',measure:(s)=>[s.finished.length,Object.values(lessons).filter(l=>l.xp).length]}
];

export function achievementStatus(state,now=new Date()) {
  const s=stats(state,now);
  return achievements.map(item=>{
    const [value,goal]=item.measure(s,state);
    return {...item,value:Math.min(value,goal),goal,unlocked:value>=goal,at:state.achievements[item.id]};
  });
}
export function unlockAchievements(state,now=new Date()) {
  const fresh=[];
  for (const item of achievementStatus(state,now)) {
    if (item.unlocked && !state.achievements[item.id]) {state.achievements[item.id]=now.toISOString();fresh.push(item);}
  }
  return fresh;
}
