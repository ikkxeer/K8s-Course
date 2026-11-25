import {list,resourceKey,relationList,statusOf,errorStatus} from './cluster.mjs';

const palette = {
  Cluster:'#929bff',Node:'#719cff',Namespace:'#c19aff',Component:'#a79fff',Deployment:'#ad98ff',ReplicaSet:'#c4a4ff',
  Pod:'#59ddb2',Container:'#9eefcc',Service:'#53c6ec',Ingress:'#78aaff',ConfigMap:'#f5b96e',Secret:'#f588a6',
  PersistentVolume:'#f4be7b',PersistentVolumeClaim:'#ffd493',Role:'#f492a5',RoleBinding:'#f784ae',NetworkPolicy:'#f7a784'
};
const glyphs={Cluster:'CL',Node:'N',Namespace:'NS',Component:'CP',Deployment:'D',ReplicaSet:'RS',Pod:'P',Container:'C',Service:'S',Ingress:'I',ConfigMap:'CM',Secret:'SE',PersistentVolume:'PV',PersistentVolumeClaim:'PVC',Role:'R',RoleBinding:'RB',NetworkPolicy:'NP'};
const expertTypes=new Set(['Component','Container','ReplicaSet','Role','RoleBinding','NetworkPolicy','Secret','PersistentVolume','PersistentVolumeClaim','ConfigMap']);
const keys = ['Cluster','Node','Namespace','Deployment','Service','Ingress','Pod','ReplicaSet','Container','Component','ConfigMap','Secret','PersistentVolumeClaim','PersistentVolume','Role','RoleBinding','NetworkPolicy'];
const sizes={Cluster:[.52,.62,.48],Node:[.65,.47,.48],Namespace:[.42,.2,.4],Pod:[.35,.38,.36],Container:[.24,.28,.24],Component:[.25,.34,.25],Service:[.4,.5,.38],Deployment:[.45,.52,.4],Ingress:[.41,.54,.38]};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(number,min,max)=>Math.min(max,Math.max(min,number));

export const resourceColor=resource=>palette[resource.kind]??'#a79fff';
export const resourceGlyph=resource=>glyphs[resource.kind]??'?';

export function visibleResources(state,{expert=false,namespace='*',kind='*'}={}) {
  return list(state).filter(resource=>{
    if (kind!=='*' && resource.kind!==kind) return false;
    if (!expert && kind==='*' && expertTypes.has(resource.kind)) return false;
    if (namespace!=='*' && resource.kind==='Namespace') return resource.metadata.name===namespace;
    return namespace==='*' || !resource.metadata.namespace || resource.metadata.namespace===namespace;
  }).sort((a,b)=>keys.indexOf(a.kind)-keys.indexOf(b.kind) || a.metadata.name.localeCompare(b.metadata.name));
}

function positions(resources) {
  const result=new Map(), groups=new Map();
  const home={Cluster:[0,1.8,-2.65],Node:[0,.35,-1.37],Namespace:[0,.07,2.3],Deployment:[0,1.2,.18],Service:[-2.9,.55,.72],Ingress:[-2.95,.88,-.88],Pod:[0,.4,.95],ReplicaSet:[2.72,.9,-.55],Container:[0,.15,3.04],Component:[0,.9,-3.75],ConfigMap:[2.83,.38,1.22],Secret:[2.83,.43,2.08],PersistentVolume:[-2.83,.34,2.21],PersistentVolumeClaim:[-2.85,.3,1.43],Role:[3.34,.34,-1.9],RoleBinding:[3.45,.34,-2.82],NetworkPolicy:[-2.96,.42,-1.88]};
  for (const resource of resources) {
    if (!groups.has(resource.kind)) groups.set(resource.kind,[]);
    groups.get(resource.kind).push(resource);
  }
  for (const [kind,items] of groups) {
    const [baseX,y,z]=home[kind];
    const cols=kind==='Node'?3:kind==='Pod'||kind==='Container'?7:5;
    const gap=kind==='Node'?2.25:kind==='Namespace'?1.25:kind==='Pod'?.98:.69;
    items.forEach((item,index)=>{
      const col=index%cols;
      const row=Math.floor(index/cols);
      const count=Math.min(cols,items.length-row*cols);
      result.set(resourceKey(item),[baseX+(col-(count-1)/2)*gap,y,z+row*.8]);
    });
  }
  return result;
}

export function mountScene(canvas,{onSelect}) {
  const ctx=canvas.getContext('2d');
  let state,options={},items=[],edges=[],locations=new Map(),hits=[],w=1,h=1,frame=0,drag=null;
  let yaw=-.52,pitch=.58,zoom=1,dx=0,dy=0, animation=true, selected=null;
  const controls=new AbortController();
  const signal=controls.signal;
  const resize=new ResizeObserver(()=>{
    const bounds=canvas.getBoundingClientRect();
    w=Math.max(1,bounds.width);h=Math.max(1,bounds.height);
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    schedule();
  });
  resize.observe(canvas);
  function schedule() {if (!frame) frame=requestAnimationFrame(draw);}
  function project([x,y,z]) {
    const scale=Math.min(w/9.6,h/6.8)*zoom;
    const side=x*Math.cos(yaw)-z*Math.sin(yaw);
    const deep=x*Math.sin(yaw)+z*Math.cos(yaw);
    const vertical=deep*Math.sin(pitch)-y*Math.cos(pitch);
    return [w*.50+dx+side*scale,h*.52+dy+vertical*scale,deep*Math.cos(pitch)+y*Math.sin(pitch)];
  }
  function line(a,b,color,width=1,dash=[]) {
    ctx.beginPath();
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);
    ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
    ctx.setLineDash([]);
  }
  function face(points,fill,stroke,width=1) {
    ctx.beginPath();
    ctx.moveTo(points[0][0],points[0][1]);
    for (const point of points.slice(1)) ctx.lineTo(point[0],point[1]);
    ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();
    if (stroke) {ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function cube(point,dims,color,highlight,light){
    const [x,y,z]=point,[a,b,c]=dims;
    const verts=[
      [x-a,y-b/2,z-c],[x+a,y-b/2,z-c],[x+a,y-b/2,z+c],[x-a,y-b/2,z+c],
      [x-a,y+b/2,z-c],[x+a,y+b/2,z-c],[x+a,y+b/2,z+c],[x-a,y+b/2,z+c]
    ].map(project);
    const faces=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].map((ids,i)=>{
      const points=ids.map(index=>verts[index]);
      return {points,i,depth:points.reduce((sum,point)=>sum+point[2],0)/4};
    }).sort((a,b)=>a.depth-b.depth);
    for (const {points,i} of faces) {
      const fill=i===4?color+(light?'bd':'74'):color+(light?'84':'48');
      face(points,fill,highlight?(light?'#12396e':'#ecf8ff'):color+(light?'d3':'b5'),highlight?1.7:1);
    }
    return {
      minX:Math.min(...verts.map(v=>v[0])),maxX:Math.max(...verts.map(v=>v[0])),
      minY:Math.min(...verts.map(v=>v[1])),maxY:Math.max(...verts.map(v=>v[1]))
    };
  }
  function draw(now) {
    frame=0;
    ctx.clearRect(0,0,w,h);
    if (!state) return;
    const light=document.documentElement.dataset.theme==='light';
    const grid=light?'#b3c5df8c':'#263a5c82';
    const area=[[-3.7,-.12,-3.8],[3.7,-.12,-3.8],[3.7,-.12,3.8],[-3.7,-.12,3.8]].map(project);
    face(area,light?'#dce9f6be':'#1421389a',light?'#b2c4df':'#40527b');
    for (let i=-3.5;i<=3.5;i+=.5) {
      line(project([i,-.11,-3.75]),project([i,-.11,3.75]),grid);
      line(project([-3.65,-.11,i]),project([3.65,-.11,i]),grid);
    }
    if (options.links!==false) for (const [index,edge] of edges.entries()) {
      const a=locations.get(edge.from),b=locations.get(edge.to);
      const pointA=project(a),pointB=project(b);
      const via=[(pointA[0]+pointB[0])/2,(pointA[1]+pointB[1])/2-15];
      const traffic=edge.type==='tráfico',blocked=edge.type==='bloqueado';
      const color=traffic?(light?'#168c7e':'#63ecd3'):blocked?(options.hideErrors?'#8194b27d':'#fb8997'):(light?'#647fa5a0':'#718bbc8f');
      const dash=traffic?[]:blocked?[4,5]:[3,5];
      line(pointA,via,color,traffic?1.65:1,dash);line(via,pointB,color,traffic?1.65:1,dash);
      if (traffic && animation && !reduced()) {
        const t=(now/2150+index*.23)%1;
        const [a,b,f]=t<.5?[pointA,via,t*2]:[via,pointB,(t-.5)*2];
        ctx.beginPath();
        ctx.arc(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,3,0,Math.PI*2);
        ctx.fillStyle=light?'#087f6c':'#a5ffe6';ctx.fill();
      }
    }
    hits=[];
    const labels=[];
    const visible=items.map(resource=>({resource,point:locations.get(resourceKey(resource))})).sort((a,b)=>project(a.point)[2]-project(b.point)[2]);
    for (const {resource,point} of visible) {
      const key=resourceKey(resource);
      const highlight=selected===key;
      const fault=errorStatus(statusOf(resource)) && (!options.hideErrors || selected===key);
      const color=fault?'#fa7f8f':resourceColor(resource);
      let dims=sizes[resource.kind]??[.31,.35,.32];
      if (items.length>32 && resource.kind!=='Cluster' && resource.kind!=='Node') dims=dims.map(value=>value*.75);
      const bounds=cube(point,dims,color,highlight,light);
      hits.push({key,...bounds});
      const mid=project(point);
      ctx.font='700 '+(resource.kind==='Node'?11:10)+'px "DM Sans",sans-serif';
      ctx.fillStyle=light?'#183354':'#edf5ff';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(resourceGlyph(resource),mid[0],mid[1]+1);
      if (resource.kind==='Cluster' || resource.kind==='Node' || resource.kind==='Pod' || resource.kind==='Service' || highlight || options.focus===resource.kind && fault || items.length<12) {
        labels.push({name:resource.kind==='Cluster'?'Clúster':resource.metadata.name,x:mid[0],y:bounds.maxY+5,fault,highlight});
      }
    }
    labels.sort((a,b)=>Number(a.highlight)-Number(b.highlight));
    const labeled=[];
    for (const label of labels) {
      ctx.font=(label.highlight?'700 ':'600 ')+'11px "DM Sans",sans-serif';ctx.textBaseline='top';
      const text=label.name.length>23?label.name.slice(0,22)+'…':label.name;
      const width=ctx.measureText(text).width+9;
      const box={x:label.x-width/2,y:label.y,w:width,h:17};
      if(!label.highlight && labeled.some(item=>item.x+item.w>box.x && item.x<box.x+box.w && item.y+item.h>box.y && item.y<box.y+box.h)) continue;
      labeled.push(box);
      ctx.fillStyle=light?'#f2f7feed':'#0a1427e8';
      ctx.beginPath();ctx.roundRect(box.x,box.y,box.w,box.h,4);ctx.fill();
      ctx.fillStyle=label.fault?(light?'#a62038':'#ffb6be'):(light?'#253c61':'#d9e5fc');
      ctx.fillText(text,label.x,label.y+3);
    }
    if (animation && !reduced() && options.links!==false && edges.some(edge=>edge.type==='tráfico') && !document.hidden) schedule();
  }
  canvas.addEventListener('pointerdown',event=>{
    canvas.setPointerCapture(event.pointerId);
    drag={x:event.clientX,y:event.clientY,started:false,pan:event.shiftKey || event.button===2 || options.pan};
  },{signal});
  canvas.addEventListener('pointermove',event=>{
    if(!drag)return;
    const a=event.clientX-drag.x,b=event.clientY-drag.y;
    if (!drag.started && Math.abs(a)+Math.abs(b)<3)return;
    drag.started=true;
    if (drag.pan) {dx+=a;dy+=b;}
    else {yaw+=a*.009;pitch=clamp(pitch+b*.009,.21,1.27);}
    drag.x=event.clientX;drag.y=event.clientY;schedule();
  },{signal});
  canvas.addEventListener('pointerup',event=>{
    if (drag && !drag.started) {
      const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      const hit=hits.findLast(({minX,maxX,minY,maxY})=>x>=minX-2 && x<=maxX+2 && y>=minY-2 && y<=maxY+2);
      if (hit) onSelect(hit.key);
    }
    drag=null;
  },{signal});
  canvas.addEventListener('pointercancel',()=>{drag=null;},{signal});
  canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal});
  canvas.addEventListener('wheel',event=>{
    if (!event.ctrlKey && document.activeElement!==canvas) return;
    event.preventDefault();zoom=clamp(zoom*Math.exp(-event.deltaY*.002),.5,3);schedule();
  },{passive:false,signal});
  canvas.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(event.key)) return;
    event.preventDefault();
    if (event.key==='ArrowLeft') yaw-=.11;
    if (event.key==='ArrowRight') yaw+=.11;
    if (event.key==='ArrowUp') pitch=clamp(pitch-.08,.21,1.27);
    if (event.key==='ArrowDown') pitch=clamp(pitch+.08,.21,1.27);
    if (event.key==='+') zoom=clamp(zoom*1.15,.5,3);
    if (event.key==='-') zoom=clamp(zoom/1.15,.5,3);
    if (event.key==='0') reset();
    schedule();
  },{signal});
  window.addEventListener('kubepath:theme',schedule,{signal});
  document.addEventListener('visibilitychange',schedule,{signal});
  function reset(){yaw=-.52;pitch=.58;zoom=1;dx=0;dy=0;schedule();}
  return {
    update(next,config,select) {
      state=next;options=config;selected=select;
      items=visibleResources(state,options);
      locations=positions(items);
      edges=relationList(state).filter(edge=>locations.has(edge.from) && locations.has(edge.to));
      canvas.style.cursor=options.pan?'move':'grab';
      schedule();
    },
    reset,
    zoomBy(value){zoom=clamp(zoom*value,.5,3);schedule();},
    setAnimation(value){animation=value;schedule();},
    destroy(){controls.abort();resize.disconnect();cancelAnimationFrame(frame);}
  };
}
