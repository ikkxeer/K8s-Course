export const modules = [
  {id:'fundamentos', title:'Fundamentos', description:'Terminal, redes, contenedores y YAML.', icon:'layers', color:'mint', lessons:['primer-pod','redes','yaml']},
  {id:'introduccion', title:'Introducción a Kubernetes', description:'Clúster, Control Plane, Pods y namespaces.', icon:'cluster', color:'blue', lessons:['arquitectura','namespaces']},
  {id:'despliegue', title:'Despliegue de aplicaciones', description:'Réplicas, Services, Ingress y configuración.', icon:'box', color:'violet', lessons:['replicas','servicio','configuracion','ingress','rollout']},
  {id:'operacion', title:'Administración de clústeres', description:'Almacenamiento, memoria y planificación.', icon:'server', color:'blue', lessons:['almacenamiento','recursos']},
  {id:'diagnostico', title:'Troubleshooting', description:'Diagnóstico basado en eventos, logs y relaciones.', icon:'pulse', color:'amber', lessons:['selector-roto','imagen-rota','memoria','incidencia-doble']},
  {id:'avanzado', title:'Kubernetes avanzado y DevOps', description:'Control de acceso y seguridad de red.', icon:'shield', color:'violet', lessons:['rbac','politicas']}
];

const objective = (text, rule, params={}) => ({text, rule, ...params});
const inspected = (text, type, name) => objective(text,'inspect',{type,name});
const exists = (text, type, name, ns='default') => objective(text,'exists',{type,name,ns});
const field = (text, type, name, key, value) => objective(text,'field',{type,name,key,value});
const available = (name, count) => objective('Mantén '+count+' réplicas disponibles de '+name+'.','available',{name,count});
const pods = name => objective('Comprueba que '+name+' tenga al menos un Pod listo.','ready',{name});
const endpoints = name => objective('Recupera los endpoints listos de '+name+'.','endpoints',{name});
const defaultLesson = {category:'Práctica guiada', seed:'empty', minutes:8, xp:80, difficulty:'Inicial'};

export const lessons = Object.fromEntries([
  {
    id:'primer-pod', title:'Tu primer Pod', minutes:8, xp:80,
    intro:'Explora los nodos del clúster y ejecuta un contenedor web en tu primer Pod.',
    concept:'Un contenedor ejecuta un proceso y sus dependencias. Un Pod es la unidad que Kubernetes programa en un nodo. Sus contenedores comparten dirección IP y pueden compartir volúmenes.',
    objectives:[inspected('Inspecciona los nodos del clúster.','Node'),exists('Crea un Pod llamado hola en default.','Pod','hola'),objective('Consigue que hola esté Running con una imagen nginx.','podImage',{name:'hola',image:'nginx'})],
    hints:['Lista los nodos con kubectl get nodes. Fíjate en los roles y en el estado Ready.','Para ejecutar una imagen en un solo Pod, consulta kubectl help. Busca el comando run.','La sintaxis de run incluye un nombre y la opción --image. Elige nginx:1.27.'],
    explanation:'kubectl envía una solicitud a la API. El scheduler elige un nodo y el kubelet coordina la ejecución del contenedor. Aquí el simulador representa ese flujo con el resultado de planificación y el estado Running.'
  },
  {
    id:'redes', title:'De un puerto a un Service', seed:'app', xp:90,
    intro:'Conecta a los clientes con la aplicación atlas mediante un destino estable.',
    concept:'Un puerto identifica el punto de entrada de un proceso. Un Service asigna un puerto estable y elige Pods mediante etiquetas. La IP de un Pod puede cambiar al sustituirlo.',
    objectives:[inspected('Inspecciona los Pods de la aplicación.','Pod'),exists('Crea un Service llamado atlas.','Service','atlas'),endpoints('atlas')],
    hints:['Usa kubectl get pods --show-labels para averiguar qué etiquetas identifican a atlas.','kubectl expose puede crear un Service a partir de un Deployment y reutilizar su selector.','Consulta kubectl get endpoints atlas después de exponer atlas en el puerto 80.'],
    explanation:'Un Service activo selecciona Pods listos del mismo namespace. En producción, EndpointSlices registran esos destinos y el plano de datos gestiona el tráfico.'
  },
  {
    id:'yaml', title:'Tu primer manifiesto YAML', minutes:7,
    intro:'Declara un ConfigMap y aplícalo desde el editor.',
    concept:'YAML representa mapas y listas con indentación. Un manifiesto especifica apiVersion, kind y metadata. Con apply, los cambios se expresan como estado deseado.',
    template:'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: preferencias\ndata:\n  MODO: dev\n',
    objectives:[exists('Aplica el ConfigMap preferencias.','ConfigMap','preferencias'),field('Establece MODO en aula.','ConfigMap','preferencias','data.MODO','aula')],
    hints:['Abre la pestaña YAML del laboratorio.','En el bloque data, los valores de ConfigMap son cadenas. Cambia el valor de MODO.','Usa Validar YAML y después Aplicar al clúster.'],
    explanation:'La configuración se guarda como un recurso independiente. Una aplicación puede consumirla a través de variables de entorno o montarla como archivos.'
  },
  {
    id:'arquitectura', title:'Dentro del Control Plane', minutes:7, xp:80,
    intro:'Localiza los puntos desde los que Kubernetes controla y ejecuta las cargas.',
    concept:'El API server recibe solicitudes. etcd almacena el estado. El scheduler asigna Pods sin nodo. Los controladores reconcilian el estado deseado y el real. Los kubelets operan en los nodos.',
    objectives:[inspected('Consulta los nodos y sus roles.','Node'),inspected('Inspecciona kube-scheduler en kube-system.','Component','kube-scheduler')],
    hints:['El modo Experto de la escena muestra los componentes internos.','Selecciona kube-system en el filtro o usa kubectl get components -n kube-system.','Selecciona kube-scheduler en el explorador para leer su función.'],
    explanation:'La separación entre decisiones y ejecución permite que Kubernetes reconcilie cambios continuamente. En este simulador, Component es un tipo didáctico. En un clúster kubeadm, estos componentes suelen verse como Pods estáticos.'
  },
  {
    id:'namespaces', title:'Separa tus entornos', xp:90,
    intro:'Crea el namespace equipo y ejecuta un Pod en él.',
    concept:'Los namespaces agrupan recursos y delimitan nombres. Un Pod del mismo nombre puede existir en dos namespaces. Los nodos son recursos de ámbito de clúster.',
    objectives:[exists('Crea el namespace equipo.','Namespace','equipo',''),exists('Ejecuta el Pod demo en equipo.','Pod','demo','equipo')],
    hints:['Consulta kubectl create namespace y comprueba el nombre con kubectl get namespaces.','El argumento -n selecciona el namespace de un recurso.','Usa kubectl get pods -n equipo para verificar dónde quedó demo.'],
    explanation:'Los namespaces hacen posible aplicar políticas y cuotas por ámbito. Su existencia por sí sola no constituye un límite de red o seguridad.'
  },
  {
    id:'replicas', title:'Escala un Deployment', seed:'app', difficulty:'Intermedio', xp:120,
    intro:'Aumenta la capacidad de atlas a tres réplicas listas.',
    concept:'Un Deployment gestiona ReplicaSets. El ReplicaSet crea Pods hasta alcanzar la cantidad deseada. Al borrar un Pod gestionado, aparece un reemplazo.',
    objectives:[field('Fija las réplicas deseadas de atlas en 3.','Deployment','atlas','spec.replicas',3),available('atlas',3)],
    hints:['Inspecciona kubectl get deploy y compara READY con AVAILABLE.','kubectl scale modifica la cantidad de réplicas deseadas de un Deployment.','La opción --replicas acepta una cantidad. Observa la escena tras el cambio.'],
    explanation:'Kubernetes reconcilia el Deployment, su ReplicaSet y los Pods. Alcanzar 3/3 requiere que los Pods previstos estén listos, además de fijar spec.replicas.'
  },
  {
    id:'servicio', title:'Selecciona los Pods adecuados', seed:'app', difficulty:'Intermedio', xp:120,
    intro:'Prepara el Service atlas-web, con puerto 8080 y destinos en la aplicación atlas.',
    concept:'port es el puerto del Service. targetPort corresponde al puerto del contenedor. Los selectores deben coincidir con las etiquetas de los Pods.',
    objectives:[field('Configura el puerto 8080 en atlas-web.','Service','atlas-web','spec.ports.0.port',8080),endpoints('atlas-web')],
    hints:['Consulta las etiquetas de los Pods de atlas.','kubectl expose admite --name, --port y --target-port.','Comprueba que atlas-web devuelve endpoints, aunque el Service y el Deployment tengan nombres diferentes.'],
    explanation:'Los selectores enlazan Services con Pods por atributos. El nombre del Service puede elegirse con independencia del Deployment.'
  },
  {
    id:'configuracion', title:'Configuración y secretos', seed:'app', difficulty:'Intermedio', xp:120,
    intro:'Crea la configuración web y un Secret con un valor de demostración.',
    concept:'ConfigMap almacena configuración no confidencial. Secret separa material sensible y requiere políticas de acceso, cifrado y rotación en producción.',
    template:'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: atlas-config\ndata:\n  LOG_LEVEL: info\n---\napiVersion: v1\nkind: Secret\nmetadata:\n  name: atlas-demo\ntype: Opaque\nstringData:\n  DEMO_TOKEN: ejemplo-simulado\n',
    objectives:[exists('Crea atlas-config.','ConfigMap','atlas-config'),objective('Crea atlas-demo con la clave DEMO_TOKEN.','secretKey',{name:'atlas-demo',key:'DEMO_TOKEN'})],
    hints:['Usa valores de prueba en el simulador.','La clave --- inicia un documento YAML nuevo.','Puedes aplicar ambos manifiestos desde el editor con una sola operación.'],
    explanation:'Kubernetes convierte stringData a data en la API. El simulador conserva únicamente las claves del Secret para evitar mostrar o persistir valores.'
  },
  {
    id:'ingress', title:'Publica una ruta HTTP', seed:'service', difficulty:'Intermedio', xp:120,
    intro:'Crea un Ingress para enrutar atlas.local al Service atlas.',
    concept:'Un recurso Ingress describe reglas HTTP. Un controlador observado en el clúster materializa esas reglas. El Service y sus endpoints siguen formando parte de la ruta.',
    template:'apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: atlas-http\nspec:\n  ingressClassName: nginx\n  rules:\n    - host: atlas.local\n      http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: atlas\n                port:\n                  number: 80\n',
    objectives:[exists('Crea el Ingress atlas-http.','Ingress','atlas-http'),objective('Consigue una ruta activa hacia atlas.','route',{name:'atlas-http',backend:'atlas',host:'atlas.local'})],
    hints:['Verifica primero los endpoints de atlas.','La regla HTTP debe referenciar el nombre y puerto del Service.','Aplica el manifiesto y abre la pestaña de estado del Ingress.'],
    explanation:'La escena muestra la cadena Ingress → Service → Pods cuando el backend es utilizable. La práctica simula un controlador disponible y no registra dominios públicos.'
  },
  {
    id:'rollout', title:'Actualiza una aplicación', seed:'service', difficulty:'Intermedio', xp:140,
    intro:'Actualiza atlas a nginx:1.28 y conserva dos réplicas disponibles.',
    concept:'Cambiar la plantilla de un Deployment inicia un rollout. Kubernetes registra revisiones y permite volver a una plantilla anterior.',
    objectives:[field('Usa nginx:1.28 en la plantilla de atlas.','Deployment','atlas','spec.template.spec.containers.0.image','nginx:1.28'),available('atlas',2),endpoints('atlas')],
    hints:['Consulta kubectl describe deployment atlas para identificar el contenedor.','kubectl set image espera el nombre de contenedor seguido de = y la imagen nueva.','Verifica el resultado con kubectl rollout status deployment/atlas.'],
    explanation:'El estado final combina la imagen, la disponibilidad de réplicas y la posibilidad de enrutar tráfico. El simulador consolida las etapas de un rolling update en una transición determinista.'
  },
  {
    id:'almacenamiento', title:'Reserva almacenamiento persistente', seed:'volume', difficulty:'Intermedio', xp:140,
    intro:'Vincula un PersistentVolumeClaim con el volumen preaprovisionado.',
    concept:'Un PV representa almacenamiento disponible. Un PVC declara tamaño, modos de acceso y clase. Si son compatibles, Kubernetes vincula ambos recursos.',
    template:'apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: datos-atlas\nspec:\n  storageClassName: aula\n  accessModes: [ReadWriteOnce]\n  resources:\n    requests:\n      storage: 2Gi\n',
    objectives:[exists('Crea el PVC datos-atlas.','PersistentVolumeClaim','datos-atlas'),objective('Consigue que datos-atlas quede Bound al PV del aula.','status',{type:'PersistentVolumeClaim',name:'datos-atlas',value:'Bound'})],
    hints:['Ejecuta kubectl get pv para ver la capacidad disponible.','Compara la clase y los modos de acceso del manifiesto con los del volumen.','Inspecciona el claim después de aplicar el YAML.'],
    explanation:'Bound indica que un volumen compatible quedó reservado para el claim. Esta simulación representa la vinculación estática. En producción un provisionador puede crear el volumen dinámicamente.'
  },
  {
    id:'recursos', title:'Define los recursos de un contenedor', seed:'app', difficulty:'Intermedio', xp:140,
    intro:'Establece un request de memoria de 64Mi y un límite de 128Mi para atlas.',
    concept:'El scheduler considera los requests al colocar Pods. El límite de memoria restringe el consumo y el kernel puede terminar un contenedor que lo exceda.',
    objectives:[field('Define 64Mi de memoria solicitada.','Deployment','atlas','spec.template.spec.containers.0.resources.requests.memory','64Mi'),field('Define 128Mi de límite de memoria.','Deployment','atlas','spec.template.spec.containers.0.resources.limits.memory','128Mi'),available('atlas',2)],
    hints:['La configuración resources pertenece al contenedor dentro de spec.template.','El comando kubectl set resources admite --requests y --limits.','Compara la plantilla con kubectl get deployment atlas -o yaml.'],
    explanation:'Requests y límites cumplen funciones diferentes. El cambio de plantilla crea una revisión y el Deployment vuelve a reconciliar sus Pods.'
  },
  {
    id:'selector-roto', title:'El servicio sin destinos', seed:'bad-selector', category:'Incidencia', difficulty:'Inicial', xp:150,
    intro:'Atlas devuelve 503. El despliegue parece disponible, pero el Service no tiene destinos listos.',
    concept:'Un 503 simulado indica que el Service se quedó sin endpoints. Compara las etiquetas y los selectores antes de modificar el Deployment.',
    focus:'Service', objectives:[available('atlas',2),endpoints('atlas')],
    hints:['Empieza con kubectl get endpoints atlas.','Compara kubectl describe service atlas con kubectl get pods --show-labels.','Puedes ajustar el selector mediante YAML y conservar el puerto original.'],
    template:'apiVersion: v1\nkind: Service\nmetadata:\n  name: atlas\nspec:\n  selector:\n    app: revisa-esta-etiqueta\n  ports:\n    - port: 80\n      targetPort: 80\n',
    explanation:'La aplicación estaba sana. El selector del Service no coincidía con las etiquetas de los Pods. Restablecer los endpoints recupera la ruta de tráfico.'
  },
  {
    id:'imagen-rota', title:'El despliegue detenido', seed:'bad-image', category:'Incidencia', difficulty:'Intermedio', xp:170,
    intro:'El despliegue atlas acaba de perder las dos réplicas y genera una alerta de disponibilidad.',
    concept:'Los eventos de un Pod indican si el runtime pudo obtener su imagen. El contenido de logs depende de que algún contenedor haya llegado a ejecutar.',
    objectives:[available('atlas',2),endpoints('atlas')],
    hints:['Consulta kubectl get pods y qué estados devuelven.','Lee kubectl get events y averigua si el contenedor llegó a arrancar.','Si el problema apareció en la última revisión, compara la plantilla actual con el historial del Deployment.'],
    explanation:'La etiqueta de imagen inexistente impedía descargar el contenedor. Cambiar la imagen o deshacer la revisión puede recuperar la aplicación.'
  },
  {
    id:'memoria', title:'Atlas se queda sin memoria', seed:'bad-memory', category:'Incidencia', difficulty:'Avanzado', xp:180,
    intro:'La aplicación se reinicia y el tráfico falla de forma intermitente.',
    concept:'Examina el último motivo de terminación, los eventos y la demanda de memoria para distinguir un reinicio por OOM de una caída de la aplicación.',
    objectives:[available('atlas',2),endpoints('atlas')],
    hints:['Mira los eventos y el estado de los Pods.','Compara el límite actual con la demanda simulada en Métricas.','El contenedor de atlas necesita al menos 48Mi en este escenario. Conserva un presupuesto explícito de memoria.'],
    explanation:'El contenedor rebasaba su límite de memoria. Ajustar el presupuesto y verificar la disponibilidad recupera los endpoints.'
  },
  {
    id:'incidencia-doble', title:'Cambio de guardia', seed:'double', category:'Incidencia', difficulty:'Avanzado', xp:220,
    intro:'La sonda externa de atlas devuelve 503 después del último cambio. Restablece el servicio.',
    concept:'En una incidencia pueden coincidir varias causas. Valida la recuperación de extremo a extremo tras cada cambio.',
    objectives:[available('atlas',2),endpoints('atlas')],
    hints:['Comprueba de forma independiente el estado de los Pods y de los endpoints.','Inspecciona los eventos del Deployment y las etiquetas que llegan a la plantilla.','Una corrección puede recuperar las réplicas y dejar el Service sin endpoints. Revisa la cadena completa.'],
    explanation:'Fallaron a la vez la imagen del Deployment y el selector del Service. El objetivo exige disponibilidad y endpoints activos al mismo tiempo.'
  },
  {
    id:'rbac', title:'Acceso de mínimo privilegio', difficulty:'Avanzado', xp:190,
    intro:'Crea un Role y vincúlalo a observador para que pueda leer Pods del namespace default.',
    concept:'Role define permisos dentro de un namespace. RoleBinding los concede a sujetos. Los verbos y recursos deben ceñirse a la tarea.',
    template:'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: lector-pods\nrules:\n  - apiGroups: [""]\n    resources: ["pods"]\n    verbs: ["get", "list", "watch"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: observador-pods\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: Role\n  name: lector-pods\nsubjects:\n  - kind: User\n    name: observador\n    apiGroup: rbac.authorization.k8s.io\n',
    objectives:[objective('Concede a observador lectura de Pods con un Role de alcance limitado.','leastPrivilege',{name:'observador-pods'})],
    hints:['El API group de Pods es el grupo principal y se representa con una cadena vacía.','Limita verbs a get, list y watch.','RoleBinding debe apuntar al Role y tener el sujeto observador.'],
    explanation:'El RoleBinding concede permisos en su namespace. Esta práctica verifica recursos, verbos, referencias y el sujeto de la vinculación en el estado declarado.'
  },
  {
    id:'politicas', title:'Restringe el tráfico entrante', seed:'service', difficulty:'Avanzado', xp:190,
    intro:'Aplica una NetworkPolicy que deniegue las conexiones entrantes a los Pods de atlas.',
    concept:'Una política de Ingress sin reglas aísla a los Pods seleccionados. Las políticas se combinan de forma aditiva. Su aplicación efectiva requiere un plugin de red compatible.',
    template:'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: aislar-atlas\nspec:\n  podSelector:\n    matchLabels:\n      app: atlas\n  policyTypes: [Ingress]\n  ingress: []\n',
    objectives:[objective('Aísla el tráfico entrante de atlas.','denyIngress',{name:'aislar-atlas'}),available('atlas',2)],
    hints:['Usa podSelector.matchLabels para apuntar a atlas.','Para aislar tráfico entrante incluye Ingress en policyTypes.','Una lista ingress vacía indica que esta política no autoriza ningún origen.'],
    explanation:'Los Pods y sus endpoints pueden seguir listos mientras el simulador bloquea el tráfico entrante. Esto representa una propiedad de la política de red y no un fallo del Service.'
  },
  {
    id:'sandbox', title:'Sandbox de Kubernetes', seed:'service', category:'Entorno libre', difficulty:'Libre', xp:0, minutes:0,
    intro:'Experimenta con un clúster simulado que ya contiene una aplicación y un Service.',
    concept:'Prueba los comandos de ayuda, modifica atlas o crea una aplicación en otro namespace.',
    objectives:[], hints:['Usa kubectl help para ver los comandos compatibles.'], explanation:''
  },
  {
    id:'constructor', title:'Diseña una aplicación', seed:'empty', category:'Architecture Builder', difficulty:'Libre', xp:0, minutes:0,
    intro:'Agrega recursos al plano visual, revisa sus relaciones y exporta los manifiestos YAML.',
    concept:'Selecciona un tipo, dale un nombre y crea el recurso. Para conectar un Service, usa como destino el nombre de un Deployment o Pod que comparta esa etiqueta.',
    objectives:[], hints:['Para ver tráfico, agrega un Deployment y un Service que lo seleccione.'], explanation:''
  }
].map(lesson=>[lesson.id,{...defaultLesson,...lesson}]));

export const modes = [
  {id:'sandbox', title:'Sandbox', icon:'terminal', description:'Prueba comandos y manifiestos en un entorno libre.', color:'mint'},
  {id:'incidencias', title:'Troubleshooting', icon:'pulse', description:'Investiga alertas y recupera una aplicación.', color:'amber', lessons:modules[4].lessons},
  {id:'desafios', title:'Challenge Mode', icon:'target', description:'Resuelve objetivos medibles con menos indicaciones iniciales.', color:'violet', lessons:['replicas','ingress','almacenamiento','rbac']},
  {id:'supervivencia', title:'Survival Mode', icon:'bolt', description:'Recupera la disponibilidad a lo largo de tres incidentes consecutivos.', color:'amber', lessons:['selector-roto','imagen-rota','incidencia-doble']},
  {id:'certificacion', title:'Certification Mode', icon:'award', description:'Practica competencias de KCNA, CKAD y CKA sin pistas durante el reto.', color:'blue', tracks:[{title:'KCNA', lessons:['arquitectura','namespaces']},{title:'CKAD', lessons:['rollout','configuracion']},{title:'CKA', lessons:['almacenamiento','incidencia-doble']}]},
  {id:'constructor', title:'Architecture Builder', icon:'layers', description:'Construye una topología y descarga sus manifiestos.', color:'violet'}
];

export const ranks = ['Kubernetes Rookie','Cluster Operator','Kubernetes Administrator','DevOps Engineer','Kubernetes Architect','Cluster Master'];
export const rankThresholds = [0,240,620,1100,1700,2350];
export const totalLessons = modules.reduce((sum,module)=>sum+module.lessons.length,0);
