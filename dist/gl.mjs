// Escena WebGL de alta calidad: iluminación física, sombras suaves, reflejos de entorno,
// brillo (bloom) y un modelo propio para cada tipo de recurso de Kubernetes.
import * as THREE from './assets/three/three.module.min.js';
import {RoundedBoxGeometry} from './assets/three/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from './assets/three/environments/RoomEnvironment.js';
import {EffectComposer} from './assets/three/postprocessing/EffectComposer.js';
import {RenderPass} from './assets/three/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './assets/three/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './assets/three/postprocessing/OutputPass.js';

const palettes={
  dark:{bg:0x0a1120,ground:0x0c1524,deck:0x1a2840,grid:0x3b5683,gridOpacity:.32,net:0x4ff0c8,warn:0xff5f7a,link:0x7f9ccc,
    read:0x7fd3ff,write:0x6ff5bd,ok:0x52f0a8,wait:0xffc062,sky:0xb4c8ff,soil:0x0b1020,hemi:.5,key:1.9,rim:.7,env:.32,bloom:.62,exposure:.92,hdr:2.4},
  light:{bg:0xe4ebf5,ground:0xd3deec,deck:0xeef3fa,grid:0x8ea4c4,gridOpacity:.5,net:0x00a88c,warn:0xe0335a,link:0x5d7aa6,
    read:0x1b78c4,write:0x0a8f64,ok:0x0fb47a,wait:0xd88a12,sky:0xffffff,soil:0x9fb0c9,hemi:.7,key:2.8,rim:.35,env:.32,bloom:.16,exposure:.88,hdr:1.1}
};
const ease=t=>1-Math.pow(1-t,3);
const DARK=new THREE.Color(0x0a1222), WHITE=new THREE.Color(0xffffff);

function physical(color,{rough=.36,metal=.1,clear=.45,flat=false}={}) {
  return new THREE.MeshPhysicalMaterial({color,roughness:rough,metalness:metal,clearcoat:clear,clearcoatRoughness:.3,flatShading:flat});
}
const glow=color=>new THREE.MeshBasicMaterial({color,toneMapped:false});
function add(group,geometry,material,[x,y,z]=[0,0,0],cast=true) {
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}
const shade=(color,amount)=>new THREE.Color(color).lerp(amount<0?DARK:WHITE,Math.abs(amount));

/* ───── Modelos por tipo de recurso (base en y=0) ───── */
function buildModel(kind,[a,h,c],color,name='') {
  if (kind==='Component'&&name==='etcd') kind='PersistentVolume';
  const g=new THREE.Group(), body=[], status=[], accents=[];
  const W=a*2, D=c*2, r=Math.min(a,c);
  const main=physical(color);body.push(main);
  let spin=null;
  switch (kind) {
    case 'Pod': {
      const R=r*.94;
      const profile=[[0,0],[R*.84,0],[R*.97,.035],[R,.1],[R,h-.13],[R*.95,h-.045],[R*.8,h],[0,h]].map(([x,y])=>new THREE.Vector2(x,y));
      add(g,new THREE.LatheGeometry(profile,56),main);
      const band=add(g,new THREE.TorusGeometry(R*1.004,.024,12,72),glow(0xffffff));
      band.rotation.x=Math.PI/2;band.position.y=h*.3;status.push(band.material);
      const ring=add(g,new THREE.TorusGeometry(R*.52,.017,10,56),glow(shade(color,.35)),[0,h+.004,0],false);
      ring.rotation.x=Math.PI/2;accents.push(ring.material);
      const disc=add(g,new THREE.CylinderGeometry(R*.44,R*.44,.012,40),physical(shade(color,.4),{rough:.12,clear:1}),[0,h+.004,0],false);
      body.push(disc.material);
      break;
    }
    case 'Container': {
      add(g,new RoundedBoxGeometry(W,h,D,2,Math.min(.025,W*.2)),main,[0,h/2,0]);
      break;
    }
    case 'Node': case 'Component': {
      const rack=kind==='Node';
      const height=rack?h:h*.5;
      const metal=physical(shade(color,-.25),{metal:.55,rough:.28,clear:.7});body.push(metal);
      add(g,new RoundedBoxGeometry(W,height,D,4,.05),metal,[0,height/2,0]);
      if (rack) {
        const slotMat=physical(0x08101e,{metal:.5,rough:.45,clear:.3});
        for (let k=0;k<3;k++) {
          const y=height*(.24+k*.25);
          add(g,new RoundedBoxGeometry(W*.66,height*.12,.024,2,.008),slotMat,[-W*.08,y,D/2+.004],false);
          const led=add(g,new THREE.SphereGeometry(.024,14,10),glow(0xffffff),[W*.34,y,D/2+.014],false);
          status.push(led.material);
        }
        const top=add(g,new RoundedBoxGeometry(W*.84,.03,D*.84,2,.012),physical(shade(color,.25),{rough:.12,clear:1}),[0,height+.01,0],false);
        body.push(top.material);
      } else {
        const core=add(g,new RoundedBoxGeometry(W*.48,.035,D*.48,2,.01),glow(shade(color,.3)),[0,height+.012,0],false);
        accents.push(core.material);
        const pin=new THREE.BoxGeometry(.03,.03,.07), pinMat=physical(0xd9c27a,{metal:.9,rough:.25,clear:.2});
        for (let k=0;k<3;k++) {
          const off=(k-1)*W*.28;
          add(g,pin,pinMat,[off,height*.45,D/2+.03],false);add(g,pin,pinMat,[off,height*.45,-D/2-.03],false);
          const side=add(g,pin,pinMat,[W/2+.03,height*.45,off],false);side.rotation.y=Math.PI/2;
          const other=add(g,pin,pinMat,[-W/2-.03,height*.45,off],false);other.rotation.y=Math.PI/2;
        }
      }
      break;
    }
    case 'Service': {
      const R=r*.98, prism=physical(color,{flat:true,rough:.22});body.push(prism);
      const hex=add(g,new THREE.CylinderGeometry(R*.9,R,h*.62,6),prism,[0,h*.31,0]);hex.rotation.y=Math.PI/6;
      const lid=add(g,new THREE.CylinderGeometry(R*.62,R*.9,h*.08,6),physical(shade(color,.25),{flat:true,rough:.15}),[0,h*.66,0]);
      lid.rotation.y=Math.PI/6;body.push(lid.material);
      const core=add(g,new THREE.SphereGeometry(R*.2,28,18),glow(shade(color,.45)),[0,h*.86,0],false);accents.push(core.material);
      const ring=add(g,new THREE.TorusGeometry(R*1.12,.02,10,80),glow(color),[0,h*.86,0],false);
      ring.rotation.x=Math.PI/2.3;accents.push(ring.material);spin=ring;
      break;
    }
    case 'Deployment': case 'ReplicaSet': {
      const count=kind==='Deployment'?3:2, step=h/(count*1.18);
      for (let k=0;k<count;k++) {
        const s=1-k*.09, m=physical(shade(color,k*.1),{rough:.25});body.push(m);
        add(g,new RoundedBoxGeometry(W*s,step*.78,D*s,3,.045),m,[0,step*.39+k*step*1.15,0]);
      }
      const strip=add(g,new THREE.BoxGeometry(W*.62,.014,.012),glow(shade(color,.4)),[0,step*.39+(count-1)*step*1.15,D*(1-(count-1)*.09)/2+.002],false);
      accents.push(strip.material);
      break;
    }
    case 'Ingress': {
      const base=physical(shade(color,-.2),{metal:.4});body.push(base);
      add(g,new RoundedBoxGeometry(W,h*.16,D*.86,3,.04),base,[0,h*.08,0]);
      const R=Math.min(a*.78,h*.62);
      add(g,new THREE.TorusGeometry(R,.065,18,56,Math.PI),main,[0,h*.16,0]);
      const inner=add(g,new THREE.TorusGeometry(R*.74,.018,10,56,Math.PI),glow(shade(color,.35)),[0,h*.16,0],false);
      accents.push(inner.material);
      break;
    }
    case 'Cluster': {
      const metal=physical(shade(color,-.2),{metal:.5,rough:.25});body.push(metal);
      add(g,new THREE.CylinderGeometry(r*.92,r*1.02,h*.22,64),metal,[0,h*.11,0]);
      const R=Math.min(r*.62,h*.4);
      const wheel=new THREE.Group();wheel.position.set(0,h*.22+R+.03,0);g.add(wheel);
      const white=glow(shade(color,.55));accents.push(white);
      const steel=physical(shade(color,.15),{metal:.6,rough:.2,clear:.8});body.push(steel);
      add(wheel,new THREE.TorusGeometry(R,.04,14,72),steel);
      add(wheel,new THREE.TorusGeometry(R*.82,.014,8,72),white,[0,0,.03],false);
      const hub=add(wheel,new THREE.CylinderGeometry(R*.24,R*.24,.08,32),steel);hub.rotation.x=Math.PI/2;
      add(wheel,new THREE.CircleGeometry(R*.14,28),white,[0,0,.042],false);
      for (let k=0;k<7;k++) {
        const angle=k/7*Math.PI*2+Math.PI/2;
        const spoke=add(wheel,new THREE.BoxGeometry(R*.82,.05,.05),steel,[Math.cos(angle)*R*.5,Math.sin(angle)*R*.5,0]);
        spoke.rotation.z=angle;
        add(wheel,new THREE.SphereGeometry(.045,16,12),steel,[Math.cos(angle)*R*1.1,Math.sin(angle)*R*1.1,0]);
      }
      const post=add(g,new THREE.CylinderGeometry(.05,.07,R*.9,16),steel,[0,h*.22+R*.45,-.02]);
      spin=wheel;
      break;
    }
    case 'Namespace': {
      add(g,new RoundedBoxGeometry(W,h*.5,D,3,.05),main,[0,h*.25,0]);
      const tab=add(g,new RoundedBoxGeometry(W*.42,h*.2,D*.3,2,.03),physical(shade(color,.2)),[-W*.26,h*.58,-D*.3]);
      body.push(tab.material);
      const line=add(g,new THREE.BoxGeometry(W*.7,.01,.014),glow(shade(color,.45)),[0,h*.5+.006,D*.18],false);accents.push(line.material);
      break;
    }
    case 'ConfigMap': {
      for (let k=0;k<3;k++) {
        const sheet=add(g,new RoundedBoxGeometry(W*.9,h*.12,D*.95,2,.02),k===2?main:physical(shade(color,-.1-k*.05)),[k*.02,h*.07+k*h*.16,-k*.02]);
        sheet.rotation.y=(k-1)*.12;if(k!==2) body.push(sheet.material);
      }
      for (let k=0;k<3;k++) {
        const text=add(g,new THREE.BoxGeometry(W*(.5-k*.08),.008,.03),glow(shade(color,.5)),[.04-k*.02,h*.07+2*h*.16+h*.065,-D*.22+k*D*.2],false);
        text.rotation.y=.12;accents.push(text.material);
      }
      break;
    }
    case 'Secret': {
      add(g,new RoundedBoxGeometry(W*.82,h*.6,D*.6,3,.06),main,[0,h*.3,0]);
      add(g,new THREE.TorusGeometry(W*.22,.05,14,40,Math.PI),physical(0xd5deec,{metal:.9,rough:.2,clear:.4}),[0,h*.6,0]);
      const hole=add(g,new THREE.CylinderGeometry(.035,.035,.02,20),glow(shade(color,.5)),[0,h*.32,D*.3+.006],false);
      hole.rotation.x=Math.PI/2;accents.push(hole.material);
      break;
    }
    case 'PersistentVolume': case 'PersistentVolumeClaim': {
      const disks=kind==='PersistentVolume'?3:2, slab=h/(disks*1.25);
      for (let k=0;k<disks;k++) {
        const y=slab/2+k*slab*1.25;
        add(g,new THREE.CylinderGeometry(r,r,slab,64),main,[0,y,0]);
        if (k<disks-1) {
          const ring=add(g,new THREE.TorusGeometry(r*.94,.014,8,64),glow(shade(color,.4)),[0,y+slab*.62,0],false);
          ring.rotation.x=Math.PI/2;accents.push(ring.material);
        }
      }
      const cap=add(g,new THREE.CylinderGeometry(r*.3,r*.3,.012,32),glow(shade(color,.5)),[0,disks*slab*1.25-slab*.25+.006,0],false);
      accents.push(cap.material);
      break;
    }
    case 'Role': case 'RoleBinding': case 'NetworkPolicy': {
      const base=physical(shade(color,-.25),{metal:.4});body.push(base);
      add(g,new RoundedBoxGeometry(W*.9,h*.12,D*.7,2,.03),base,[0,h*.06,0]);
      if (kind==='NetworkPolicy') {
        for (let k=0;k<5;k++) add(g,new RoundedBoxGeometry(.05,h*.72,.05,2,.015),main,[(k-2)*W*.2,h*.12+h*.36,0]);
        const rail=add(g,new THREE.BoxGeometry(W*.9,.03,.03),glow(shade(color,.35)),[0,h*.62,0],false);accents.push(rail.material);
        add(g,new THREE.BoxGeometry(W*.9,.03,.03),main,[0,h*.34,0]);
      } else {
        const sw=W*.92, sh=h*1.05, shape=new THREE.Shape();
        shape.moveTo(-sw/2,sh);shape.lineTo(sw/2,sh);shape.lineTo(sw/2,sh*.5);
        shape.quadraticCurveTo(sw/2,sh*.12,0,0);shape.quadraticCurveTo(-sw/2,sh*.12,-sw/2,sh*.5);shape.closePath();
        const geometry=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:3,curveSegments:18});
        geometry.translate(0,0,-.035);
        add(g,geometry,main,[0,h*.12,0]);
        const mark=add(g,new THREE.TorusGeometry(sw*.17,.016,8,40),glow(shade(color,.5)),[0,h*.12+sh*.58,.065],false);accents.push(mark.material);
      }
      break;
    }
    default:
      add(g,new RoundedBoxGeometry(W,h,D,3,.05),main,[0,h/2,0]);
  }
  return {group:g,body,status,accents,spin};
}

function roundedRect(shape,x,y,w,h,r) {
  shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);
  shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  return shape;
}
function dispose(object) {
  object.traverse(node=>{
    node.geometry?.dispose();
    for (const material of [node.material].flat()) material?.dispose?.();
  });
}

export function createGL(overlay,{sizeOf,colorOf}) {
  const canvas=document.createElement('canvas');
  canvas.className='gl-layer';canvas.setAttribute('aria-hidden','true');
  let renderer;
  try {renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});}
  catch {return null;}
  overlay.before(canvas);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;

  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(30,1,.05,250);
  const pmrem=new THREE.PMREMGenerator(renderer), environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
  scene.environment=environment;
  const hemi=new THREE.HemisphereLight(), key=new THREE.DirectionalLight(0xffffff,2), rim=new THREE.DirectionalLight(0x8fb4ff,.8);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.radius=5;key.shadow.bias=-.0005;key.shadow.normalBias=.025;
  scene.add(hemi,key,key.target,rim,rim.target);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({roughness:.96,metalness:0}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.24;ground.receiveShadow=true;scene.add(ground);
  const decksGroup=new THREE.Group(), edgesGroup=new THREE.Group(), objectsGroup=new THREE.Group();
  scene.add(decksGroup,edgesGroup,objectsGroup);

  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.6,.38,1);
  composer.addPass(bloom);composer.addPass(new OutputPass());

  let palette=palettes.dark, theme=null, width=0, height=0;
  let decksData=[], edgesData=[], bounds=new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,1,1));
  const objects=new Map();
  const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
  const center=new THREE.Vector3(), focus=new THREE.Vector3(), dir=new THREE.Vector3(), corner=new THREE.Vector3();

  function setTheme(light) {
    const name=light?'light':'dark';
    if (name===theme) return false;
    theme=name;palette=palettes[name];
    scene.background=new THREE.Color(palette.bg);scene.fog=new THREE.Fog(palette.bg,20,60);
    ground.material.color.set(palette.ground);
    hemi.color.set(palette.sky);hemi.groundColor.set(palette.soil);hemi.intensity=palette.hemi;
    key.intensity=palette.key;rim.intensity=palette.rim;
    scene.environmentIntensity=palette.env;bloom.strength=palette.bloom;renderer.toneMappingExposure=palette.exposure;
    renderer.toneMapping=light?THREE.NeutralToneMapping:THREE.ACESFilmicToneMapping;
    return true;
  }

  function buildDecks() {
    for (const child of [...decksGroup.children]) {decksGroup.remove(child);dispose(child);}
    bounds.makeEmpty();
    for (const deck of decksData) {
      const w=deck.halfWidth*2, l=deck.length, cx=deck.x, cz=deck.z+l/2;
      const slab=add(decksGroup,new RoundedBoxGeometry(w,.22,l,4,.08),
        new THREE.MeshPhysicalMaterial({color:palette.deck,roughness:.72,metalness:.12,clearcoat:.2,clearcoatRoughness:.6}),[cx,-.11,cz]);
      slab.castShadow=false;
      const outer=roundedRect(new THREE.Shape(),-w/2+.05,-l/2+.05,w-.1,l-.1,.16);
      outer.holes.push(roundedRect(new THREE.Path(),-w/2+.09,-l/2+.09,w-.18,l-.18,.13));
      const strip=add(decksGroup,new THREE.ShapeGeometry(outer,8),new THREE.MeshBasicMaterial({color:new THREE.Color(deck.color).multiplyScalar(palette.hdr*.7),toneMapped:false,transparent:true,opacity:theme==='light'?.85:.8}),[cx,.004,cz],false);
      strip.rotation.x=-Math.PI/2;strip.receiveShadow=false;
      const points=[];
      for (let x=-w/2+.55;x<w/2-.1;x+=.55) points.push(new THREE.Vector3(cx+x,.003,cz-l/2+.14),new THREE.Vector3(cx+x,.003,cz+l/2-.14));
      for (let z=-l/2+.55;z<l/2-.1;z+=.55) points.push(new THREE.Vector3(cx-w/2+.14,.003,cz+z),new THREE.Vector3(cx+w/2-.14,.003,cz+z));
      decksGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:palette.grid,transparent:true,opacity:palette.gridOpacity})));
      bounds.expandByPoint(corner.set(cx-w/2,-.2,cz-l/2));bounds.expandByPoint(corner.set(cx+w/2,1.05,cz+l/2));
    }
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,1,1));
  }

  function buildEdges() {
    for (const child of [...edgesGroup.children]) {edgesGroup.remove(child);dispose(child);}
    for (const edge of edgesData) {
      const network=edge.type==='tráfico', blocked=edge.type==='bloqueado';
      const color=network?palette.net:blocked?palette.warn:palette.link;
      const a=new THREE.Vector3(edge.a.x,edge.a.lift,edge.a.z), b=new THREE.Vector3(edge.b.x,edge.b.lift,edge.b.z);
      const mid=a.clone().lerp(b,.5);mid.y+=network||blocked?.35+a.distanceTo(b)*.16:.15;
      const curve=new THREE.QuadraticBezierCurve3(a,mid,b);
      const group=new THREE.Group();group.userData={edge,curve,network,blocked,pulses:[]};
      if (network) {
        group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,64,.016,8),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(palette.hdr*.75),toneMapped:false,transparent:true,opacity:.9})));
        const tangent=curve.getTangent(.97), cone=new THREE.Mesh(new THREE.ConeGeometry(.05,.13,16),new THREE.MeshBasicMaterial({color,toneMapped:false}));
        cone.position.copy(curve.getPoint(.97));cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent);group.add(cone);
        for (let k=0;k<3;k++) {
          const pulse=new THREE.Mesh(new THREE.SphereGeometry(.05-k*.011,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(color).lerp(WHITE,.4).multiplyScalar(palette.hdr),toneMapped:false,transparent:true,opacity:1-k*.28}));
          group.add(pulse);group.userData.pulses.push(pulse);
        }
      } else {
        const geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
        const material=blocked?new THREE.LineDashedMaterial({color,dashSize:.09,gapSize:.06,transparent:true,toneMapped:false}):new THREE.LineBasicMaterial({color,transparent:true});
        const line=new THREE.Line(geometry,material);if(blocked) line.computeLineDistances();
        group.add(line);
      }
      edgesGroup.add(group);
    }
  }

  function makeObject(record,key) {
    const {item}=record, size=sizeOf(item.kind), color=colorOf(item);
    const model=buildModel(item.kind,size,color,item.metadata?.name);
    const radius=Math.max(size[0],size[2]);
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*1.12,radius*1.32,64),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,toneMapped:false,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.012;ring.visible=false;
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.055,18,12),new THREE.MeshBasicMaterial({color:palette.warn,toneMapped:false}));
    orb.visible=false;
    const scale=record.small?1:1.18;
    model.group.scale.setScalar(scale);
    const shown=[size[0]*scale,size[1]*scale,size[2]*scale];
    ring.geometry.dispose();ring.geometry=new THREE.RingGeometry(Math.max(shown[0],shown[2])*1.12,Math.max(shown[0],shown[2])*1.32,64);
    const root=new THREE.Group();root.add(model.group,ring,orb);
    root.userData={key,record,model,ring,orb,size:shown,color:new THREE.Color(color),kind:item.kind};
    root.traverse(node=>{node.userData.key=key;});
    objectsGroup.add(root);
    return root;
  }

  return {
    canvas,
    sync({places,decks,edges,items}) {
      decksData=decks;
      setTheme(document.documentElement.dataset.theme==='light');
      buildDecks();
      const seen=new Set();
      for (const [key,record] of places) {
        if (!items.has(key)) continue;
        seen.add(key);
        let root=objects.get(key);
        if (root&&root.userData.kind!==record.item.kind) {objectsGroup.remove(root);dispose(root);root=null;}
        if (!root) {root=makeObject(record,key);objects.set(key,root);}
        root.userData.record=record;
        root.position.set(record.x,Math.max(0,record.y-.19),record.z);
      }
      for (const [key,root] of objects) if (!seen.has(key)) {objectsGroup.remove(root);dispose(root);objects.delete(key);}
      const lift=key=>{const root=objects.get(key);return root?{x:root.position.x,z:root.position.z,lift:root.position.y+root.userData.size[1]*.55}:null;};
      edgesData=edges.map(edge=>({...edge,a:lift(edge.from),b:lift(edge.to)})).filter(edge=>edge.a&&edge.b);
      buildEdges();
    },
    frame({now,w,h,ratio,light,yaw,pitch,zoom,dx,dy,info,animation,links,focusKind,born}) {
      if (setTheme(light)) {buildDecks();buildEdges();}
      if (w!==width||h!==height) {
        width=w;height=h;
        renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
        composer.setPixelRatio(ratio);composer.setSize(w,h);
        camera.aspect=w/h;
      }
      // Encaje independiente del giro: la cámara orbita sin acercarse ni alejarse.
      bounds.getCenter(center);
      dir.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
      camera.updateProjectionMatrix();
      const half=THREE.MathUtils.degToRad(camera.fov/2), across=Math.atan(Math.tan(half)*camera.aspect);
      const sphere=bounds.getSize(corner).multiply(new THREE.Vector3(1,.35,1)).length()/2;
      let distance=sphere/Math.sin(Math.min(half,across))*.92;
      distance/=zoom;
      const unit=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/h;
      camera.position.copy(center).addScaledVector(dir,distance);camera.lookAt(center);camera.updateMatrixWorld();
      const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0), up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      focus.copy(center).addScaledVector(right,-dx*unit).addScaledVector(up,dy*unit);
      camera.position.copy(focus).addScaledVector(dir,distance);camera.lookAt(focus);camera.updateMatrixWorld();
      scene.fog.near=distance*(theme==='light'?1.4:.9);scene.fog.far=distance*(theme==='light'?6:3.2);
      const radius=bounds.getSize(corner).length()*.6;
      key.position.copy(focus).add(new THREE.Vector3(-radius*.7,radius*1.6,radius*.9));key.target.position.copy(focus);
      rim.position.copy(focus).add(new THREE.Vector3(radius,radius*.5,-radius));rim.target.position.copy(focus);
      Object.assign(key.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.5,far:radius*5});
      key.shadow.camera.updateProjectionMatrix();

      const pulse=animation?.5+.5*Math.sin(now/260):1;
      const accent=new THREE.Color(focusKind==='write'?palette.write:palette.read);
      const dimmed=[...info.values()].some(state=>state.focused);
      for (const [key,root] of objects) {
        const state=info.get(key)??{};
        const {model,ring,orb,size,color}=root.userData;
        const age=born.has(key)?Math.min(1,(now-born.get(key))/600):1, grow=ease(age);
        root.scale.set(.55+.45*grow,Math.max(.02,grow),.55+.45*grow);
        const base=state.fault?new THREE.Color(palette.warn):color;
        const tone=state.fault?palette.warn:state.tone==='ok'?palette.ok:state.tone==='wait'?palette.wait:0x8fa3c4;
        for (const material of model.body) {material.color.copy(base);material.emissive.copy(base);material.emissiveIntensity=state.fault?.25+.3*pulse:state.pointed||state.chosen?.12:0;}
        for (const material of model.status) material.color.set(tone).multiplyScalar(palette.hdr*(state.fault?.5+.5*pulse:.8));
        for (const material of model.accents) material.color.copy(state.fault?base:color).lerp(WHITE,.25).multiplyScalar(palette.hdr*.6);
        const active=state.focused||state.chosen||state.pointed;
        ring.visible=!!active;
        if (active) {
          ring.material.color.copy(state.focused?accent:new THREE.Color(state.chosen?palette.read:palette.link)).multiplyScalar(palette.hdr*.7);
          ring.material.opacity=state.pointed&&!state.chosen&&!state.focused?.55:.95;
          const breathe=state.focused&&animation?1+.06*Math.sin(now/300):1;ring.scale.set(breathe,breathe,1);
        }
        orb.visible=!!state.fault&&!root.userData.record.small;orb.material.color.set(palette.warn).multiplyScalar(palette.hdr);
        if (orb.visible) orb.position.set(size[0]*.75,size[1]+.18+(animation?.04*Math.sin(now/380):0),size[2]*.6);
        if (model.spin&&animation) model.spin.rotation.z=now/1800;
        for (const material of [...model.body]) {material.transparent=dimmed&&!active;material.opacity=dimmed&&!active?.86:1;}
      }
      edgesGroup.visible=links;
      edgesGroup.children.forEach((group,index)=>{
        const {edge,curve,network,blocked,pulses}=group.userData;
        const active=[edge.from,edge.to].some(key=>{const state=info.get(key);return state?.focused||state?.chosen||state?.pointed;});
        const structural=edge.type==='estructura';
        group.visible=!structural||active;
        const muted=blocked&&edge.hidden&&!active;
        group.children.forEach(child=>{if(child.material&&!pulses.includes(child)) child.material.opacity=active?1:network?.85:blocked&&!muted?.85:.4;});
        for (const [k,ball] of pulses.entries()) {
          ball.visible=animation;
          if (animation) ball.position.copy(curve.getPoint(((now/2200+index*.21)-k*.035+1)%1));
        }
      });
      composer.render();
    },
    project([x,y,z]) {
      const v=new THREE.Vector3(x,Math.max(0,y-.19),z).project(camera);
      return [(v.x+1)/2*width,(1-v.y)/2*height,v.z];
    },
    anchor(key) {
      const root=objects.get(key);
      if (!root) return null;
      const {size}=root.userData, top=new THREE.Vector3(root.position.x,root.position.y+size[1]*root.scale.y+.05,root.position.z).project(camera);
      const bottom=new THREE.Vector3(root.position.x,root.position.y,root.position.z+size[2]).project(camera);
      return {top:[(top.x+1)/2*width,(1-top.y)/2*height],bottom:[(bottom.x+1)/2*width,(1-bottom.y)/2*height],depth:top.z};
    },
    pick(x,y) {
      pointer.set(x/width*2-1,-(y/height)*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects(objectsGroup.children,true).find(entry=>entry.object.visible&&entry.object.userData.key);
      return hit?.object.userData.key??null;
    },
    destroy() {
      dispose(scene);environment.dispose();pmrem.dispose();target.dispose();composer.dispose?.();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    }
  };
}
