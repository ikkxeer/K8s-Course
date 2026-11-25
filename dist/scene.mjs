import {list, resourceKey, relationList, statusOf, errorStatus} from './cluster.mjs';

const kinds = {
  Cluster:              {color:'#9b95ff', icon:'cluster', size:[.49,.46,.44]},
  Node:                 {color:'#77a7ff', icon:'server',  size:[.57,.43,.42]},
  Namespace:            {color:'#bd9dff', icon:'tag',     size:[.40,.20,.32]},
  Component:            {color:'#a8a7ff', icon:'chip',    size:[.35,.32,.30], expert:true},
  Deployment:           {color:'#b59bff', icon:'layers', size:[.44,.48,.36]},
  ReplicaSet:           {color:'#ceb1ff', icon:'layers', size:[.36,.34,.31], expert:true},
  Pod:                  {color:'#57e0b1', icon:'box',    size:[.37,.47,.35]},
  Container:            {color:'#96ebcb', icon:'box',    size:[.13,.23,.13], expert:true},
  Service:              {color:'#58caed', icon:'network',size:[.43,.48,.36]},
  Ingress:              {color:'#7d9eff', icon:'gate',   size:[.40,.52,.37]},
  ConfigMap:            {color:'#ffca85', icon:'file',    size:[.35,.30,.31], expert:true},
  Secret:               {color:'#f994ad', icon:'lock',    size:[.35,.37,.31], expert:true},
  PersistentVolume:     {color:'#f7c77d', icon:'disk',    size:[.41,.38,.36], expert:true},
  PersistentVolumeClaim:{color:'#ffd69d', icon:'disk',    size:[.36,.30,.32], expert:true},
  Role:                 {color:'#f49bb3', icon:'shield',  size:[.34,.34,.29], expert:true},
  RoleBinding:          {color:'#f48fb6', icon:'shield',  size:[.34,.34,.29], expert:true},
  NetworkPolicy:        {color:'#f7af89', icon:'shield',  size:[.39,.41,.32], expert:true}
};
const order=Object.keys(kinds);
const colors={
  dark:{stage:'#101d31',pad:'#16243a',edge:'#304362',bottom:'#101a2b',shadow:'#000711',mesh:'#0a1423',stroke:'#e2ebff',
    label:'#111d30',text:'#eff5ff',muted:'#a1b4d3',link:'#7b94c1',net:'#66edcf',warn:'#ff8b9b',read:'#8bd8ff',write:'#76f4bf'},
  light:{stage:'#dce6f4',pad:'#dbe6f5',edge:'#9fb2d0',bottom:'#bbcbe2',shadow:'#7289b1',mesh:'#364d70',stroke:'#243c63',
    label:'#f7faff',text:'#142643',muted:'#425c7c',link:'#526f98',net:'#00826e',warn:'#a82b49',read:'#176caa',write:'#087553'}
};
const glyphPaths={
  cluster:'M2 12h20M12 2v20M5 5l14 14M5 19 19 5M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16',
  server:'M3 4h18v6H3zM3 14h18v6H3zM6 7h1m2 0h8M6 17h1m2 0h8',
  box:'m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9',
  tag:'M3 4h11l7 7-10 10-8-8V4Zm5 5h.1',
  chip:'M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  layers:'m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5',
  network:'M10 3h4v4h-4zM3 17h4v4H3zM17 17h4v4h-4zM12 7v5m-7 5v-5h14v5',
  gate:'M4 21V5h16v16M7 21V9h10v12M9 15h6m-3-3 3 3-3 3',
  file:'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8m-8 4h8',
  lock:'M7 10V7a5 5 0 1 1 10 0v3M5 10h14v11H5zM12 14v3',
  disk:'M4 6a8 3 0 1 0 16 0 8 3 0 1 0-16 0Zm0 0v12a8 3 0 1 0 16 0V6M4 12a8 3 0 1 0 16 0',
  shield:'m12 3 8 3v6c0 4-3.5 7-8 9-4.5-2-8-5-8-9V6l8-3Zm-3 9 2 2 4-4'
};
const glyphNames={Cluster:'CL',Node:'NO',Namespace:'NS',Component:'CP',Deployment:'DE',ReplicaSet:'RS',Pod:'PO',Container:'CT',Service:'SV',Ingress:'IN',ConfigMap:'CM',Secret:'SE',PersistentVolume:'PV',PersistentVolumeClaim:'PVC',Role:'RO',RoleBinding:'RB',NetworkPolicy:'NP'};
const hitSlop=3;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const alpha=(color,opacity)=>color+Math.round(clamp(opacity,0,1)*255).toString(16).padStart(2,'0');

export const resourceColor=item=>kinds[item.kind]?.color??'#a79fff';
export const resourceGlyph=item=>glyphNames[item.kind]??'?';

export function visibleResources(state,{expert=false,namespace='*',kind='*',reveal=new Set()}={}) {
  return list(state).filter(item=>{
    if (reveal.has(resourceKey(item))) return true;
    if (kind!=='*' && item.kind!==kind) return false;
    if (!expert && kind==='*' && kinds[item.kind]?.expert) return false;
    if (namespace!=='*' && item.kind==='Namespace') return item.metadata.name===namespace;
    return namespace==='*' || !item.metadata.namespace || item.metadata.namespace===namespace;
  }).sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind) || a.metadata.name.localeCompare(b.metadata.name));
}

const isWorker=item=>item.kind==='Node' && item.sim?.role==='worker';

function layout(items) {
  const places=new Map(), decks=[];
  const groups=Object.groupBy(items,item=>item.kind);
  const get=kind=>groups[kind]??[];
  const place=(item,x,y,z,deck,details={})=>{
    if (item) places.set(resourceKey(item),{item,x,y,z,deck,...details});
  };
  function addDeck(label,key,x,z,halfWidth,length,color,caption='') {
    const deck={label,key,x,z,halfWidth,length,color,caption};
    decks.push(deck);
    return deck;
  }
  function arrange(items,deck,columns,{start=.91,step=.75,space=1.06}={}) {
    for (const [i,item] of items.entries()) {
      const count=Math.min(columns,items.length-Math.floor(i/columns)*columns);
      const x=deck.x+((i%columns)-(count-1)/2)*space;
      place(item,x,.19,deck.z+start+Math.floor(i/columns)*step,deck);
    }
  }
  const left=-2.35, right=2.35;
  const control=get('Node').find(node=>!isWorker(node));
  const cluster=get('Cluster')[0];
  const namespaces=get('Namespace'), components=get('Component');
  const services=[...get('Ingress'),...get('Service'),...get('Deployment'),...get('ReplicaSet'),...get('NetworkPolicy')];
  const controlRows=(cluster||control?1:0)+Math.ceil(components.length/3)+Math.ceil(namespaces.length/3);
  const rearLength=Math.max(2.30,1.12+Math.max(controlRows,Math.ceil(services.length/3))*.82);
  if (controlRows) {
    const deck=addDeck('Plano de control','control',left,0,2.12,rearLength,'#9b95ff');
    place(cluster,left-.76,.19,.90,deck);
    place(control,left+.76,.19,.90,deck);
    arrange(components,deck,3,{start:(cluster||control?1.72:.86),step:.82,space:1.23});
    arrange(namespaces,deck,3,{start:(cluster||control?1.72:.86)+Math.ceil(components.length/3)*.82,step:.82,space:1.23});
  }
  const appDeck=addDeck('Aplicación y red','apps',right,0,2.12,rearLength,'#6ebcfa',services.length?'':'Sin cargas de aplicación');
  arrange(services,appDeck,3,{start:.93,step:.82,space:1.24});

  const podsByNode=Object.groupBy(get('Pod'),pod=>pod.status?.node??'pending');
  const containersByPod=Object.groupBy(get('Container'),container=>container.sim.owner);
  const workers=get('Node').filter(isWorker);
  const rows=Math.max(1,...Object.values(podsByNode).map(pods=>Math.ceil(pods.length/3)));
  const workerLength=2.45+(rows-1)*1.03, front=rearLength+.37;

  function placePods(pods,deck,start) {
    const slots=[0,-1,1];
    for(const [index,pod] of pods.entries()) {
      const key=resourceKey(pod), x=deck.x+slots[index%3]*1.14, z=deck.z+start+Math.floor(index/3)*1.03;
      place(pod,x,.19,z,deck);
      for(const [i,container] of (containersByPod[key]??[]).entries()) {
        place(container,x-.26+i*.18,.69,z,deck,{small:true});
      }
    }
  }
  for (const [index,node] of workers.entries()) {
    const pods=podsByNode[resourceKey(node)]??[];
    const count=pods.length;
    const deck=addDeck(node.metadata.name,resourceKey(node),index%2?right:left,front+Math.floor(index/2)*(workerLength+.36),2.12,workerLength,
      '#77a7ff',count===1?'1 Pod':count===0?'Sin Pods':count+' Pods');
    place(node,deck.x,.19,deck.z+.76,deck,{noLabel:true});
    placePods(pods,deck,1.72);
  }

  const misc=items.filter(item=>!places.has(resourceKey(item)) && !['Pod','Container'].includes(item.kind));
  const unassigned=get('Pod').filter(item=>!places.has(resourceKey(item)));
  const extraZ=front+Math.max(1,Math.ceil(workers.length/2))*(workerLength+.36);
  if (misc.length) {
    const deck=addDeck('Configuración y almacenamiento','config',left,extraZ,2.12,1.23+Math.ceil(misc.length/3)*.78,'#ffc485');
    arrange(misc,deck,3);
  }
  if (unassigned.length) {
    const deck=addDeck('Sin nodo asignado','pending',right,extraZ,2.12,1.05+Math.ceil(unassigned.length/3)*1.03,'#fa9ca6');
    placePods(unassigned,deck,1.0);
  }
  return {places,decks};
}

function footprint(x,y,z,left,right,back,front,cut) {
  return [[x-left+cut,y,z-back],[x+right-cut,y,z-back],[x+right,y,z-back+cut],[x+right,y,z+front-cut],
    [x+right-cut,y,z+front],[x-left+cut,y,z+front],[x-left,y,z+front-cut],[x-left,y,z-back+cut]];
}

function within([x,y],points) {
  let inside=false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const [a,b]=points[i], [c,d]=points[j];
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) inside=!inside;
  }
  return inside;
}
function overlap(a,b,pad=2) {
  return a.x<b.x+b.w+pad && a.x+a.w+pad>b.x && a.y<b.y+b.h+pad && a.y+a.h+pad>b.y;
}
const font=(weight,size)=>weight+' '+size+'px "DM Sans",system-ui,sans-serif';
function displayName(item) {
  if (item.kind==='Cluster') return 'Clúster';
  if (item.kind==='Node'&&item.sim?.role==='control-plane') return 'Control Plane';
  if (['Ingress','Service','Deployment','ReplicaSet'].includes(item.kind)) return item.kind+' · '+item.metadata.name;
  return item.metadata.name;
}

export function mountScene(canvas,{onSelect,onHover}) {
  const ctx=canvas.getContext('2d');
  const paths=Object.fromEntries(Object.entries(glyphPaths).map(([name,d])=>[name,new Path2D(d)]));
  const controls=new AbortController(), signal=controls.signal;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let state,options,selected,operation,items=new Set(),edges=[],locations=new Map(),decks=[],frame=0,w=1,h=1;
  let hitAreas=[], focusKeys=new Set(), highlightStart=0, hovered=null, drag=null, animation=true, inView=true;
  let yaw=-.35,pitch=.72,zoom=1,dx=0,dy=0;
  let view;
  const resize=new ResizeObserver(()=>{
    const rect=canvas.getBoundingClientRect();
    w=Math.max(1,rect.width);h=Math.max(1,rect.height);
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    schedule();
  });
  resize.observe(canvas);
  const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView)schedule();});
  observer.observe(canvas);
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  function rawProject([x,y,z]) {
    const side=x*view.cosYaw-z*view.sinYaw, depth=x*view.sinYaw+z*view.cosYaw;
    return [side,depth*view.sinPitch-y*view.cosPitch,depth*view.cosPitch+y*view.sinPitch];
  }
  function project(point) {
    const [x,y,z]=rawProject(point);
    return [view.cx+x*view.scale,view.cy+y*view.scale,z];
  }
  function fit() {
    view={cosYaw:Math.cos(yaw),sinYaw:Math.sin(yaw),cosPitch:Math.cos(pitch),sinPitch:Math.sin(pitch)};
    const limits=decks.flatMap(deck=>footprint(deck.x,0,deck.z,deck.halfWidth,deck.halfWidth,0,deck.length,.14).map(rawProject));
    for (const {x,y,z,item} of locations.values()) {
      const size=kinds[item.kind].size;
      limits.push(rawProject([x-size[0],y+size[1],z-size[2]]),rawProject([x+size[0],y+size[1],z+size[2]]));
    }
    const xs=limits.map(point=>point[0]),ys=limits.map(point=>point[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const base=Math.min((w-(w<440?22:51))/Math.max(1,maxX-minX),(h-52)/Math.max(1,maxY-minY));
    const scale=Math.max(4,base)*zoom;
    Object.assign(view,{scale,cx:w/2-(minX+maxX)/2*scale+dx,cy:h/2-(minY+maxY)/2*scale+dy});
  }
  function polygon(points,fill,stroke,width=1) {
    ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();
    if (fill) {ctx.fillStyle=fill;ctx.fill();}
    if (stroke) {ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function stroke(points,color,width=1,dash=[]) {
    ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
  }
  function dot(x,y,size,color) {
    ctx.beginPath();ctx.arc(x,y,size,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
  }
  function stack(rings,faceColors,edge) {
    const projected=rings.map(ring=>ring.map(project));
    const faces=[];
    for (let tier=1;tier<projected.length;tier++) {
      const lower=projected[tier-1],upper=projected[tier];
      for(let i=0;i<upper.length;i++) {
        const j=(i+1)%upper.length;
        const points=[lower[i],lower[j],upper[j],upper[i]];
        faces.push({points,fill:faceColors(tier,i),depth:points.reduce((sum,p)=>sum+p[2],0)/4});
      }
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces) polygon(face.points,face.fill,edge);
    return {cap:projected.at(-1),foot:projected[0],faces};
  }
  function drawDeck(deck,theme,light) {
    const {x,z,halfWidth:a,length:b,color}=deck;
    const cut=.14;
    const ring=(y,inset=0)=>footprint(x,y,z,a-inset,a-inset,-inset,b-inset,cut);
    ctx.save();
    ctx.shadowColor=alpha(theme.shadow,light?.20:.60);ctx.shadowBlur=12;ctx.shadowOffsetY=5;
    polygon(ring(-.10).map(project),theme.bottom);
    ctx.restore();
    const {cap}=stack([ring(-.11),ring(.02)],()=>theme.bottom,theme.edge);
    const [first,,,,last]=cap;
    const gradient=ctx.createLinearGradient(first[0],first[1],last[0],last[1]);
    gradient.addColorStop(0,theme.pad);gradient.addColorStop(1,theme.stage);
    polygon(cap,gradient,theme.edge);
    polygon(ring(.025,.11).map(project),null,alpha(color,light?.34:.26));
  }
  function edgePath(from,to,type) {
    const a=project([from.x,from.y+.10,from.z]), b=project([to.x,to.y+.10,to.z]);
    const raise=type==='tráfico'||type==='bloqueado'?Math.min(40,7+Math.hypot(b[0]-a[0],b[1]-a[1])*.10):7;
    const control=[(a[0]+b[0])/2,(a[1]+b[1])/2-raise];
    return {a,b,control};
  }
  function drawEdge(edge,index,now,theme) {
    const from=locations.get(edge.from),to=locations.get(edge.to);
    const active=focusKeys.has(edge.from)||focusKeys.has(edge.to)||selected===edge.from||selected===edge.to||hovered===edge.from||hovered===edge.to;
    const network=edge.type==='tráfico', blocked=edge.type==='bloqueado', structural=edge.type==='estructura';
    if (structural && !active) return;
    const muted=blocked&&options.hideErrors&&!active;
    const color=network?theme.net:blocked&&!muted?theme.warn:theme.link;
    const opacity=active?.97:network?.80:blocked&&!muted?.76:.34;
    const {a,b,control}=edgePath(from,to,edge.type);
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(control[0],control[1],b[0],b[1]);
    ctx.strokeStyle=alpha(color,opacity);ctx.lineWidth=network||active?1.8:1;
    ctx.setLineDash(blocked?[4,5]:structural?[3,5]:[]);ctx.stroke();ctx.setLineDash([]);
    if (network&&animation&&!motion.matches) {
      const t=(now/2200+index*.21)%1, r=1-t;
      const x=r*r*a[0]+2*r*t*control[0]+t*t*b[0],y=r*r*a[1]+2*r*t*control[1]+t*t*b[1];
      dot(x,y,5,alpha(color,.21));dot(x,y,2.8,color);
    }
  }
  function drawObject(record,theme,light,now) {
    const {item,x,y,z,small}=record;
    const key=resourceKey(item), focused=focusKeys.has(key), chosen=selected===key, pointed=hovered===key;
    const fault=errorStatus(statusOf(item)) && (!options.hideErrors||focused||chosen||state.inspected.has(item.kind+'/'+item.metadata.name));
    const color=fault?theme.warn:resourceColor(item);
    const focusColor=operation?.effect.type==='write'?theme.write:theme.read;
    const [a,height,c]=kinds[item.kind].size;
    const cut=Math.min(a,c)*(item.kind==='Service'?.51:item.kind==='Pod'?.34:.22);
    const shape=(level,inset=0)=>footprint(x,level,z,a-inset,a-inset,c-inset,c-inset,Math.max(.018,cut-inset/2));
    const halo=(expansion,opacity)=>{
      const ring=footprint(x,.08,z,a+expansion,a+expansion,c+expansion,c+expansion,cut).map(project);
      polygon(ring,alpha(focusColor,opacity*.15),alpha(focusColor,opacity),focused?1.4:1);
    };

    ctx.save();
    if (focusKeys.size&&!focused&&!chosen&&!pointed) ctx.globalAlpha=.79;
    if (focused||chosen||pointed) halo(.15,focused?.98:.76);
    if (focused&&!motion.matches && now-highlightStart<850) {
      const t=clamp((now-highlightStart)/850,0,1);
      halo(.15+t*.30,.74*(1-t));
    }
    const bottom=y+(small?0:-.05), capY=bottom+height;
    polygon(footprint(x,Math.max(.035,bottom-.02),z,a+.08,a+.08,c+.07,c+.07,cut).map(project),alpha(theme.shadow,light?.24:.62));
    const {cap,faces}=stack([shape(bottom),shape(capY-.085),shape(capY,.056)],(tier,i)=> {
      const side=tier===2?(i<3?.66:.49):(i===2||i===3?.48:.34);
      return alpha(color,light?side+.29:side);
    },alpha(color,light?.66:.51));
    const [start,,,,end]=cap;
    const sheen=ctx.createLinearGradient(start[0],start[1],end[0],end[1]);
    sheen.addColorStop(0,alpha(color,light?.90:.84));sheen.addColorStop(1,alpha(color,light?.59:.46));
    polygon(cap,sheen,focused?focusColor:alpha(color,.92),focused?1.55:1);
    const top=project([x,capY+.016,z]);
    const iconSize=clamp(view.scale*(small?.26:.39),small?7:12,small?13:25);
    ctx.save();
    ctx.translate(top[0]-iconSize/2,top[1]-iconSize/2);
    ctx.scale(iconSize/24,iconSize/24);
    ctx.strokeStyle=light?'#172947':'#f4f8ff';
    ctx.lineWidth=1.65;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.stroke(paths[kinds[item.kind].icon]);
    ctx.restore();

    if (fault&&!small) {
      const [sx,sy]=project([x+a*.60,capY+.13,z+c*.64]);
      dot(sx,sy,5,theme.label);dot(sx,sy,3.1,theme.warn);
    }
    ctx.restore();
    return {record,key,focused,chosen,pointed,fault,cap,faces,x:top[0],y:top[1],rim:Math.max(...cap.map(p=>p[1]))};
  }
  function pill(text,x,y,theme,{accent,priority=false,secondary=false}={}) {
    const size=secondary?10:11;
    ctx.font=font(priority?750:650,size);ctx.textAlign='left';ctx.textBaseline='middle';
    const max=w<430?101:155;
    let label=text;
    while(ctx.measureText(label).width>max && label.length>2) label=label.slice(0,-2)+'…';
    const inner=ctx.measureText(label).width+12+(accent?8:0),height=secondary?17:19;
    const box={x:clamp(x-inner/2,4,Math.max(4,w-inner-4)),y:clamp(y,4,Math.max(4,h-height-4)),w:inner,h:height};
    return {box,paint(){
      ctx.beginPath();ctx.roundRect(box.x,box.y,box.w,box.h,5);
      ctx.fillStyle=theme.label;ctx.fill();
      ctx.strokeStyle=alpha(accent??theme.edge,priority?.86:.56);ctx.lineWidth=1;ctx.stroke();
      if(accent)dot(box.x+7,box.y+height/2,2.5,accent);
      ctx.font=font(priority?750:650,size);ctx.fillStyle=secondary?theme.muted:theme.text;
      ctx.fillText(label,box.x+(accent?13:6),box.y+height/2+.25);
    }};
  }

  /* ───── Vista 2D: diagrama de tarjetas ───── */
  const CARD={w:118,h:56,gap:10,pad:12,head:34,cols:2,colGap:18};
  function layout2D() {
    const {w:cw,h:ch,gap,pad,head,cols,colGap}=CARD;
    const bandW=pad*2+cols*cw+(cols-1)*gap;
    const byDeck=new Map(decks.map(deck=>[deck,[]]));
    for (const record of locations.values()) {
      if (!items.has(resourceKey(record.item))||record.item.kind==='Container'||record.noLabel) continue;
      byDeck.get(record.deck)?.push(record);
    }
    const columns=[[],[]];
    for (const deck of [...decks].sort((a,b)=>a.z-b.z)) columns[deck.x<0?0:1].push(deck);
    const sides=columns.filter(column=>column.length).length||1;
    const bands=[];
    let y=0;
    for (let row=0;row<Math.max(columns[0].length,columns[1].length);row++) {
      const start=bands.length;
      let rowHeight=0;
      for (let side=0;side<2;side++) {
        const deck=columns[side][row];
        if (!deck) continue;
        const cards=byDeck.get(deck);
        const lines=Math.max(1,Math.ceil(cards.length/cols));
        const height=head+(cards.length?lines*(ch+gap)-gap:20)+pad;
        bands.push({deck,x:sides===1?0:side*(bandW+colGap),y,w:bandW,h:height,
          cards:cards.map((record,i)=>({record,x:pad+(i%cols)*(cw+gap),y:head+Math.floor(i/cols)*(ch+gap)}))});
        rowHeight=Math.max(rowHeight,height);
      }
      for (const band of bands.slice(start)) band.h=rowHeight;
      y+=rowHeight+colGap;
    }
    return {bands,W:sides===1?bandW:bandW*2+colGap,H:Math.max(1,y-colGap)};
  }
  function trimText(text,max) {
    let label=text;
    while (ctx.measureText(label).width>max&&label.length>2) label=label.slice(0,-2)+'…';
    return label;
  }
  const healthy=new Set(['Running','Ready','Activo','Active','Disponible','Bound','Operativo','Available']);
  function draw2D(now,theme,light) {
    const layout=layout2D();
    const k=clamp(Math.min((w-20)/layout.W,(h-20)/layout.H),.35,1.25)*zoom;
    const ox=(w-layout.W*k)/2+dx, oy=(h-layout.H*k)/2+dy;
    const {w:cw,h:ch}=CARD;
    const centers=new Map(), cardList=[];
    hitAreas=[];
    ctx.save();
    ctx.translate(ox,oy);ctx.scale(k,k);
    for (const band of layout.bands) {
      const {deck}=band;
      ctx.beginPath();ctx.roundRect(band.x,band.y,band.w,band.h,12);
      ctx.fillStyle=alpha(theme.pad,light?.9:.75);ctx.fill();
      ctx.strokeStyle=alpha(deck.color,light?.55:.38);ctx.lineWidth=1.2;ctx.stroke();
      ctx.textBaseline='middle';ctx.textAlign='left';
      ctx.fillStyle=deck.color;ctx.beginPath();ctx.arc(band.x+16,band.y+17,3.5,0,Math.PI*2);ctx.fill();
      ctx.font=font(750,13);ctx.fillStyle=theme.text;
      ctx.fillText(trimText(deck.label,band.w-100),band.x+26,band.y+17.5);
      let caption=deck.caption||(band.cards.length?'':'Vacío');
      ctx.font=font(750,13);
      const free=band.w-26-ctx.measureText(deck.label).width-20;
      ctx.font=font(600,11);
      if (caption&&ctx.measureText(caption).width>free) caption=band.cards.length?'':'Vacío';
      if (caption&&ctx.measureText(caption).width>free) caption='';
      if (caption) {ctx.font=font(600,11);ctx.fillStyle=theme.muted;ctx.textAlign='right';ctx.fillText(caption,band.x+band.w-12,band.y+17.5);ctx.textAlign='left';}
      if (state.resources[deck.key]) hitAreas.push({key:deck.key,box:{x:ox+band.x*k,y:oy+band.y*k,w:band.w*k,h:32*k}});
      for (const card of band.cards) {
        const key=resourceKey(card.record.item), x=band.x+card.x, y=band.y+card.y;
        centers.set(key,{x:x+cw/2,y:y+ch/2});
        cardList.push({record:card.record,key,x,y});
      }
    }
    if (options.links) edges.forEach((edge,index)=>{
      const a=centers.get(edge.from), b=centers.get(edge.to);
      if (!a||!b) return;
      const active=focusKeys.has(edge.from)||focusKeys.has(edge.to)||selected===edge.from||selected===edge.to||hovered===edge.from||hovered===edge.to;
      const network=edge.type==='tráfico', blocked=edge.type==='bloqueado', structural=edge.type==='estructura';
      if (structural&&!active) return;
      const muted=blocked&&options.hideErrors&&!active;
      const color=network?theme.net:blocked&&!muted?theme.warn:theme.link;
      const control={x:(a.x+b.x)/2,y:(a.y+b.y)/2-Math.min(26,Math.hypot(b.x-a.x,b.y-a.y)*.12)};
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(control.x,control.y,b.x,b.y);
      ctx.strokeStyle=alpha(color,active?.97:network?.85:blocked&&!muted?.8:.42);ctx.lineWidth=network||active?2.2:1.3;
      ctx.setLineDash(blocked?[5,5]:structural?[3,5]:[]);ctx.stroke();ctx.setLineDash([]);
      if (network&&animation&&!motion.matches) {
        const t=(now/2200+index*.21)%1, r=1-t;
        dot(r*r*a.x+2*r*t*control.x+t*t*b.x,r*r*a.y+2*r*t*control.y+t*t*b.y,3.2,color);
      }
    });
    const focusColor=operation?.effect.type==='write'?theme.write:theme.read;
    for (const {record,key,x,y} of cardList) {
      const {item}=record, phase=statusOf(item);
      const focused=focusKeys.has(key), chosen=selected===key, pointed=hovered===key;
      const fault=errorStatus(phase)&&(!options.hideErrors||focused||chosen||state.inspected.has(item.kind+'/'+item.metadata.name));
      const color=fault?theme.warn:resourceColor(item);
      ctx.save();
      if (focusKeys.size&&!focused&&!chosen&&!pointed) ctx.globalAlpha=.8;
      if (focused||chosen||pointed) {ctx.shadowColor=alpha(focusColor,.7);ctx.shadowBlur=10;}
      ctx.beginPath();ctx.roundRect(x,y,cw,ch,9);
      ctx.fillStyle=theme.label;ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle=focused||chosen||pointed?focusColor:alpha(color,.7);ctx.lineWidth=focused||chosen?2.2:1.2;ctx.stroke();
      ctx.beginPath();ctx.roundRect(x,y,5,ch,[9,0,0,9]);ctx.fillStyle=color;ctx.fill();
      ctx.save();
      ctx.translate(x+14,y+11);ctx.scale(.8,.8);
      ctx.strokeStyle=color;ctx.lineWidth=1.9;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.stroke(paths[kinds[item.kind].icon]);
      ctx.restore();
      ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.font=font(700,9.5);ctx.fillStyle=theme.muted;
      ctx.fillText(trimText(item.kind.replace(/([a-z])([A-Z])/g,'$1 $2').toUpperCase(),cw-52),x+37,y+14);
      ctx.font=font(750,12.5);ctx.fillStyle=theme.text;
      ctx.fillText(trimText(item.metadata.name,cw-22),x+14,y+34);
      const ok=healthy.has(phase);
      dot(x+17,y+47,3,fault?theme.warn:ok?theme.write:theme.muted);
      ctx.font=font(650,10);ctx.fillStyle=fault?theme.warn:theme.muted;
      ctx.fillText(trimText(phase,cw-36),x+25,y+47.5);
      ctx.restore();
      hitAreas.push({key,box:{x:ox+x*k,y:oy+y*k,w:cw*k,h:ch*k}});
    }
    ctx.restore();
    if(inView&&!document.hidden&&!motion.matches&&((animation&&options.links&&edges.some(edge=>edge.type==='tráfico'))||(focusKeys.size&&now-highlightStart<850))) schedule();
  }
  function draw(now) {
    frame=0;
    ctx.clearRect(0,0,w,h);
    if (!state||!decks.length) return;
    const light=document.documentElement.dataset.theme==='light', theme=colors[light?'light':'dark'];
    if (options.view==='2d') {draw2D(now,theme,light);return;}
    fit();
    const orderedDecks=[...decks].sort((a,b)=>project([a.x,0,a.z+a.length/2])[2]-project([b.x,0,b.z+b.length/2])[2]);
    for(const deck of orderedDecks) drawDeck(deck,theme,light);
    if(options.links) edges.forEach((edge,index)=>drawEdge(edge,index,now,theme));
    const ordered=[...locations.values()].filter(place=>items.has(resourceKey(place.item))).sort((a,b)=>project([a.x,a.y,a.z])[2]-project([b.x,b.y,b.z])[2]);
    const shapes=ordered.map(record=>drawObject(record,theme,light,now));
    hitAreas=shapes.map(shape=>({key:shape.key,areas:[shape.cap,...shape.faces.map(face=>face.points)]}));
    const occupied=[];
    for(const deck of orderedDecks) {
      const rear=deck.key==='control'||deck.key==='apps';
      const [x,y]=project([deck.x,0,deck.z+(rear?0:deck.length+.09)]);
      const label=pill(deck.label,x,y+(rear?-25:7),theme,{accent:deck.color});
      if(!occupied.some(box=>overlap(box,label.box))) {label.paint();occupied.push(label.box);}
      if (deck.caption && w>510) {
        const caption=pill(deck.caption,x,rear?label.box.y-19:label.box.y+21,theme,{secondary:true});
        if(!occupied.some(box=>overlap(box,caption.box))) {caption.paint();occupied.push(caption.box);}
      }
    }
    const priority=shape=>(shape.chosen||shape.pointed?6:0)+(shape.focused?4:0)+(shape.fault?3:0)+(shape.record.item.kind==='Pod'?2:0);
    for(const shape of [...shapes].sort((a,b)=>priority(b)-priority(a))) {
      const active=shape.focused||shape.chosen||shape.pointed;
      if (!active&&(shape.record.noLabel||shape.record.small||items.size>24&&priority(shape)<2)) continue;
      const {item}=shape.record;
      const name=displayName(item);
      const activeAccent=operation?.effect.type==='write'?theme.write:theme.read;
      const accent=shape.fault?theme.warn:active?activeAccent:null;
      const y=shape.rim+4;
      const candidates=[[shape.x,y],[shape.x,shape.y-31],[shape.x-28,y+6],[shape.x+28,y+6]];
      const label=candidates.map(([x,y])=>pill(name,x,y,theme,{accent,priority:active})).find(item=>!occupied.some(box=>overlap(box,item.box)));
      if (!label) continue;
      label.paint();occupied.push(label.box);
      hitAreas.push({key:shape.key,box:label.box});
    }
    if(inView&&!document.hidden&&!motion.matches&&((animation&&options.links&&edges.some(edge=>edge.type==='tráfico'))||(focusKeys.size&&now-highlightStart<850))) schedule();
  }

  function hit(event) {
    const rect=canvas.getBoundingClientRect(), x=event.clientX-rect.left,y=event.clientY-rect.top;
    return hitAreas.findLast(entry=>entry.box
      ?x>=entry.box.x-hitSlop&&x<=entry.box.x+entry.box.w+hitSlop&&y>=entry.box.y-hitSlop&&y<=entry.box.y+entry.box.h+hitSlop
      :entry.areas.some(points=>within([x,y],points)))?.key??null;
  }
  function hover(key) {
    if (hovered===key) return;
    hovered=key;
    canvas.style.cursor=options?.pan?'move':key?'pointer':'grab';
    onHover?.(key);
    schedule();
  }
  canvas.addEventListener('pointerdown',event=>{
    if (event.button===1) return;
    canvas.setPointerCapture(event.pointerId);
    drag={x:event.clientX,y:event.clientY,started:false,pan:event.shiftKey||event.button===2||options.pan||options.view==='2d'};
  },{signal});
  canvas.addEventListener('pointermove',event=>{
    if (!drag) {hover(hit(event));return;}
    const x=event.clientX-drag.x,y=event.clientY-drag.y;
    if (!drag.started&&Math.abs(x)+Math.abs(y)<3) return;
    drag.started=true;
    hover(null);
    if(drag.pan){dx+=x;dy+=y;}
    else{yaw+=x*.008;pitch=clamp(pitch+y*.008,.30,1.44);}
    drag.x=event.clientX;drag.y=event.clientY;schedule();
  },{signal});
  canvas.addEventListener('pointerup',event=>{
    if(drag&&!drag.started&&event.button!==2){const key=hit(event);if(key)onSelect(key);}
    drag=null;
  },{signal});
  canvas.addEventListener('pointercancel',()=>{drag=null;hover(null);},{signal});
  canvas.addEventListener('pointerleave',()=>hover(null),{signal});
  canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal});
  canvas.addEventListener('wheel',event=>{
    if(!event.ctrlKey&&document.activeElement!==canvas)return;
    event.preventDefault();zoom=clamp(zoom*Math.exp(-event.deltaY*.002),.55,3.5);schedule();
  },{passive:false,signal});
  canvas.addEventListener('keydown',event=>{
    const key=event.key;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(key)) return;
    event.preventDefault();
    if(key==='0'){reset();return;}
    if(['+','=','-'].includes(key)){zoomBy(key==='-'?1/1.15:1.15);return;}
    if(options.pan||event.shiftKey||options.view==='2d') {
      dx+=key==='ArrowLeft'?-16:key==='ArrowRight'?16:0;
      dy+=key==='ArrowUp'?-16:key==='ArrowDown'?16:0;
    } else {
      yaw+=key==='ArrowLeft'?-.11:key==='ArrowRight'?.11:0;
      pitch=clamp(pitch+(key==='ArrowUp'?-.07:key==='ArrowDown'?.07:0),.30,1.44);
    }
    schedule();
  },{signal});
  window.addEventListener('kubepath:theme',schedule,{signal});
  document.addEventListener('visibilitychange',schedule,{signal});
  motion.addEventListener('change',schedule,{signal});
  document.fonts.ready.then(()=>{if(!signal.aborted)schedule();});
  function reset(){yaw=-.35;pitch=.72;zoom=1;dx=0;dy=0;schedule();}
  function zoomBy(value){zoom=clamp(zoom*value,.55,3.5);schedule();}

  return {
    update(next,config,select,op) {
      state=next;options=config;selected=select;
      items=new Set(visibleResources(state,options).map(resourceKey));
      const context=visibleResources(state,{expert:options.expert,reveal:items});
      const {places,decks:shownDecks}=layout(context);
      locations=places;
      decks=shownDecks;
      edges=relationList(state).filter(edge=>items.has(edge.from)&&items.has(edge.to)&&locations.has(edge.from)&&locations.has(edge.to)&&
        !(edge.type==='gestión' && items.has(state.resources[edge.to]?.sim?.owner)));
      if(operation!==op) highlightStart=performance.now();
      operation=op;
      focusKeys=op?.keys??new Set();
      if (hovered&&!items.has(hovered)) hover(null);
      canvas.style.cursor=options.pan?'move':hovered?'pointer':'grab';
      schedule();
    },
    reset,zoomBy,
    setAnimation(value){animation=value;schedule();},
    destroy(){controls.abort();resize.disconnect();observer.disconnect();cancelAnimationFrame(frame);}
  };
}
