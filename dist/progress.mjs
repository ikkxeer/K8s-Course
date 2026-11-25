import {lessons, modules, ranks, rankThresholds, totalLessons, allSkills, bonusRate} from './catalog.mjs';

const storageKey = 'kubepath.progreso.v1';
const dateFormatter = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const empty = () => ({completed:{},attempts:{},modes:{},days:{},bonus:{},achievements:{},profile:{name:'',theme:'dark'},survival:0});
export function readProgress(storage) {
  try {
    const raw = JSON.parse(storage.getItem(storageKey)??'null');
    if (!raw || typeof raw!=='object') return empty();
    const result = {...empty(),profile:{name:typeof raw.profile?.name==='string'?raw.profile.name.slice(0,40):'',theme:raw.profile?.theme==='light'?'light':'dark'}};
    for (const id of Object.keys(lessons)) {
      const record = raw.completed?.[id];
      if (lessons[id].xp && typeof record==='string' && Number.isFinite(Date.parse(record))) result.completed[id]=record;
      const attempts = raw.attempts?.[id];
      if (Number.isSafeInteger(attempts) && attempts>0) result.attempts[id]=attempts;
      const bonus = raw.bonus?.[id];
      if (result.completed[id] && Number.isSafeInteger(bonus) && bonus>0 && bonus<=lessons[id].xp) result.bonus[id]=bonus;
    }
    for (const [key,value] of Object.entries(raw.modes??{})) {
      if (/^(supervivencia|certificacion|desafios|incidencias|academia)\/[a-z-]+$/.test(key) && value===true) result.modes[key]=true;
    }
    for (const [key,value] of Object.entries(raw.days??{}).slice(-730)) {
      if (/^\d{4}-\d\d-\d\d$/.test(key) && Array.isArray(value)) result.days[key]=[...new Set(value.filter(id=>Object.hasOwn(lessons,id) && lessons[id].xp))];
    }
    for (const [key,value] of Object.entries(raw.achievements??{}).slice(0,60)) {
      if (/^[a-z-]{2,30}$/.test(key) && typeof value==='string' && Number.isFinite(Date.parse(value))) result.achievements[key]=value;
    }
    if (Number.isSafeInteger(raw.survival) && raw.survival>0) result.survival=raw.survival;
    return result;
  } catch {return empty();}
}
export function saveProgress(storage,state) {
  try {storage.setItem(storageKey,JSON.stringify(state));return true;} catch {return false;}
}
export function browserStorage() {
  try {return window.localStorage;} catch {return null;}
}
export const localDay = (now=new Date()) => dateFormatter.format(now);
function fromDay(day) {return new Date(day+'T12:00:00Z');}
function offsetDay(day,offset) {
  const date=fromDay(day);
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}
export function recordSuccess(state,lesson,mode,now=new Date(),{hints}={}) {
  if (!lesson.xp) return 0;
  const day=localDay(now);
  const history=state.days[day]??=[];
  if (!history.includes(lesson.id)) history.push(lesson.id);
  state.modes[mode+'/'+lesson.id]=true;
  if (state.completed[lesson.id]) return 0;
  state.completed[lesson.id]=now.toISOString();
  if (hints===0) {
    const bonus=Math.round(lesson.xp*bonusRate);
    state.bonus[lesson.id]=bonus;
    return lesson.xp+bonus;
  }
  return lesson.xp;
}
export function stats(state,now=new Date()) {
  const finished=Object.keys(state.completed);
  const xp=finished.reduce((sum,id)=>sum+(lessons[id]?.xp??0)+(state.bonus?.[id]??0),0);
  const level=rankThresholds.findLastIndex(threshold=>xp>=threshold);
  const day=localDay(now);
  let cursor=state.days[day]?.length?day:offsetDay(day,-1);
  let streak=0;
  while (state.days[cursor]?.length && streak<730) {streak++;cursor=offsetDay(cursor,-1);}
  const monday=offsetDay(day,-((fromDay(day).getUTCDay()+6)%7));
  const weekly=new Set(Object.entries(state.days).filter(([date])=>date>=monday&&date<=day).flatMap(([,ids])=>ids)).size;
  const calendar=Array.from({length:7},(_,i)=>{
    const date=offsetDay(monday,i);
    return {date,done:!!state.days[date]?.length,today:date===day};
  });
  const activeDays=Object.keys(state.days).filter(date=>state.days[date].length).sort();
  let best=0,run=0,previous='';
  for (const date of activeDays) {run=previous&&offsetDay(previous,1)===date?run+1:1;best=Math.max(best,run);previous=date;}
  const heat=Array.from({length:84},(_,i)=>{
    const date=offsetDay(day,i-83);
    return {date,count:state.days[date]?.length??0};
  });
  const gained=Object.fromEntries(finished.map(id=>[id,(lessons[id]?.xp??0)+(state.bonus?.[id]??0)]));
  const perDay={};
  for (const id of finished) {const key=localDay(new Date(state.completed[id]));perDay[key]=(perDay[key]??0)+gained[id];}
  const series=[];
  let running=0;
  const firstDay=Object.keys(perDay).sort()[0];
  if (firstDay) {
    const span=Math.min(13,Math.max(6,Math.round((fromDay(day)-fromDay(firstDay))/86400000)));
    const before=Object.entries(perDay).filter(([date])=>date<offsetDay(day,-span)).reduce((sum,[,value])=>sum+value,0);
    running=before;
    for (let i=-span;i<=0;i++) {const date=offsetDay(day,i);running+=perDay[date]??0;series.push({date,xp:running,gain:perDay[date]??0});}
  }
  const learned=new Set(finished.flatMap(id=>(lessons[id]?.skills??[]).map(name=>id+':'+name)));
  const modulesDone=modules.filter(module=>module.lessons.every(id=>state.completed[id])).length;
  return {best,heat,series,learned,skillTotal:allSkills.length,modulesDone,clean:Object.keys(state.bonus??{}).length,minutes:finished.reduce((sum,id)=>sum+(lessons[id]?.minutes??0),0),finished,xp,rank:ranks[level],level:level+1,streak,weekly,daily:!!state.days[day]?.length,calendar,nextRank:ranks[level+1],step:rankThresholds[level],goal:rankThresholds[level+1],pct:Math.round(finished.length/totalLessons*100)};
}
