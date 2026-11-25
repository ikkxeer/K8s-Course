export const modules = [
  {id:'fundamentos', goal:"Haz funcionar tu primera aplicación: un Pod, un Service y un manifiesto.", badge:"Primeros pasos", boss:{mode:'sandbox',label:"Practica libre en el Sandbox"}, title:'Fundamentos', description:'Terminal, redes, contenedores y YAML.', icon:'layers', color:'mint', lessons:['primer-pod','redes','yaml']},
  {id:'introduccion', goal:"Entiende quién decide y quién ejecuta dentro de un clúster.", badge:"Explorador del clúster", boss:{mode:'sandbox',label:"Explora el clúster en el Sandbox"}, title:'Introducción a Kubernetes', description:'Clúster, Control Plane, Pods y namespaces.', icon:'cluster', color:'blue', lessons:['arquitectura','namespaces']},
  {id:'despliegue', goal:"Publica, escala y actualiza una aplicación sin cortes.", badge:"Maestro del despliegue", boss:{mode:'desafios',label:"Supera los Desafíos"}, title:'Despliegue de aplicaciones', description:'Réplicas, Services, Ingress y configuración.', icon:'box', color:'violet', lessons:['replicas','servicio','configuracion','ingress','rollout']},
  {id:'operacion', goal:"Dale a tus cargas disco persistente y recursos justos.", badge:"Administrador de recursos", boss:{mode:'desafios',label:"Supera los Desafíos"}, title:'Administración de clústeres', description:'Almacenamiento, memoria y planificación.', icon:'server', color:'blue', lessons:['almacenamiento','recursos']},
  {id:'diagnostico', goal:"Diagnostica fallos reales a partir de eventos, logs y relaciones.", badge:"Bombero de producción", boss:{mode:'supervivencia',label:"Aguanta una guardia de Supervivencia"}, title:'Troubleshooting', description:'Diagnóstico basado en eventos, logs y relaciones.', icon:'pulse', color:'amber', lessons:['selector-roto','imagen-rota','memoria','incidencia-doble']},
  {id:'avanzado', goal:"Protege quién accede y qué tráfico circula.", badge:"Guardián del clúster", boss:{mode:'certificacion',label:"Practica un simulacro de certificación"}, title:'Kubernetes avanzado y DevOps', description:'Control de acceso y seguridad de red.', icon:'shield', color:'violet', lessons:['rbac','politicas']}
];

const objective = (text, rule, params={}) => ({text, rule, ...params});
const inspected = (text, type, name) => objective(text,'inspect',{type,name});
const exists = (text, type, name, ns='default') => objective(text,'exists',{type,name,ns});
const field = (text, type, name, key, value) => objective(text,'field',{type,name,key,value});
const available = (name, count) => objective('Mantén '+count+' réplicas disponibles de '+name+'.','available',{name,count});
const pods = name => objective('Comprueba que '+name+' tenga al menos un Pod listo.','ready',{name});
const endpoints = name => objective('Recupera los endpoints listos de '+name+', apuntando al puerto 80 del contenedor.','endpoints',{name});
const skillMap = {"primer-pod": ["Nodo", "Pod", "kubectl get", "kubectl run"], "redes": ["Puerto", "Service", "Etiquetas", "kubectl expose", "Endpoints"], "yaml": ["YAML", "Manifiesto", "ConfigMap", "kubectl apply"], "arquitectura": ["API server", "etcd", "Scheduler", "Controladores", "kubelet"], "namespaces": ["Namespace", "kubectl -n", "Ámbito de recursos"], "replicas": ["Deployment", "ReplicaSet", "kubectl scale", "Reconciliación"], "servicio": ["port / targetPort", "Selectores", "Service ≠ Deployment"], "configuracion": ["ConfigMap en uso", "Secret", "Variables de entorno"], "ingress": ["Ingress", "Reglas HTTP", "Ruta completa al Pod"], "rollout": ["Rollout", "Revisiones", "kubectl rollout", "Rollback"], "almacenamiento": ["PersistentVolume", "PersistentVolumeClaim", "Binding", "Modos de acceso"], "recursos": ["Requests", "Limits", "OOMKilled", "Planificación"], "selector-roto": ["Error 503", "kubectl describe", "Selector vs etiquetas"], "imagen-rota": ["ImagePullBackOff", "Eventos de Pod", "kubectl logs"], "memoria": ["Reinicios de Pod", "Motivo de terminación", "Memoria vs límite"], "incidencia-doble": ["Varias causas", "Validar de extremo a extremo", "Orden de diagnóstico"], "rbac": ["Role", "RoleBinding", "Mínimo privilegio", "kubectl auth can-i"], "politicas": ["NetworkPolicy", "Aislamiento de Pods", "Reglas de Ingress"]};
const defaultLesson = {category:'Práctica guiada', seed:'empty', minutes:8, xp:80, difficulty:'Inicial'};

export const lessons = Object.fromEntries([
  {
    id:'primer-pod', title:'Tu primer Pod', minutes:8, xp:80,
    intro:'Explora los nodos del clúster y ejecuta un contenedor web en tu primer Pod.',
    concept:'Un contenedor ejecuta un proceso y sus dependencias. Un Pod es la unidad que Kubernetes programa en un nodo. Sus contenedores comparten dirección IP y pueden compartir volúmenes.',
    objectives:[inspected('Inspecciona los nodos del clúster.','Node'),exists('Crea un Pod llamado hola en default.','Pod','hola'),objective('Consigue que hola esté Running con una imagen nginx.','podImage',{name:'hola',image:'nginx'})],
    hints:["Un clúster está formado por nodos (las máquinas donde se ejecutan tus apps). Para verlos escribe `kubectl get nodes` en la terminal y pulsa Enter. kubectl es el programa con el que hablas con Kubernetes.", "En la tabla, ESTADO Ready significa que el nodo está listo para recibir Pods. Con ese comando ya cumples el primer objetivo.", "Un Pod es la unidad mínima de Kubernetes: envuelve tu contenedor. Se crea con `kubectl run <nombre> --image=<imagen>`. El nombre lo eliges tú; la imagen es el programa que se ejecutará (nginx es un servidor web).", "Comando completo: `kubectl run hola --image=nginx:1.27`. El :1.27 es la versión de la imagen.", "Comprueba con `kubectl get pods`. Cuando ESTADO sea Running, pulsa Validar objetivos."],
    explanation:'kubectl envía una solicitud a la API. El scheduler elige un nodo y el kubelet coordina la ejecución del contenedor. Aquí el simulador representa ese flujo con el resultado de planificación y el estado Running.'
  },
  {
    id:'redes', title:'De un puerto a un Service', seed:'app', xp:90,
    intro:'Conecta a los clientes con la aplicación atlas mediante un destino estable.',
    concept:'Un puerto identifica el punto de entrada de un proceso. Un Service asigna un puerto estable y elige Pods mediante etiquetas. La IP de un Pod puede cambiar al sustituirlo.',
    objectives:[inspected('Inspecciona los Pods de la aplicación.','Pod'),exists('Crea un Service llamado atlas.','Service','atlas'),endpoints('atlas')],
    hints:["Los Pods de atlas ya existen. Míralos con `kubectl get pods --show-labels`. Las etiquetas (labels) son como pegatinas: el Service las usa para saber a qué Pods enviar el tráfico.", "Un Service es una dirección fija delante de los Pods (que pueden cambiar). Lo más fácil es crearlo a partir del Deployment con `kubectl expose deployment <nombre> --port=<puerto>`.", "El Deployment se llama atlas y nginx escucha en el puerto 80. Escribe `kubectl expose deployment atlas --port=80`.", "Comprueba con `kubectl get endpoints atlas`. Un endpoint es la dirección de un Pod listo al que el Service reenvía el tráfico: deben aparecer los Pods de atlas.", "Si el tercer objetivo sigue pendiente, probablemente el Service apunta a un puerto del contenedor equivocado. Bórralo con `kubectl delete service atlas` y créalo de nuevo con `--port=80`."],
    explanation:'Un Service activo selecciona Pods listos del mismo namespace. En producción, EndpointSlices registran esos destinos y el plano de datos gestiona el tráfico.'
  },
  {
    id:'yaml', title:'Tu primer manifiesto YAML', minutes:7,
    intro:'Declara un ConfigMap y aplícalo desde el editor.',
    concept:'YAML representa mapas y listas con indentación. Un manifiesto especifica apiVersion, kind y metadata. Con apply, los cambios se expresan como estado deseado.',
    template:'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: preferencias\ndata:\n  MODO: dev\n',
    objectives:[exists('Aplica el ConfigMap preferencias.','ConfigMap','preferencias'),field('Establece MODO en aula.','ConfigMap','preferencias','data.MODO','aula')],
    hints:["YAML es un formato de texto donde los espacios al inicio de cada línea (la sangría) indican qué pertenece a qué. Abre la pestaña YAML: ya hay un ejemplo cargado.", "Es un ConfigMap (configuración de una app). En el bloque data hay pares clave: valor. Ahora MODO vale dev y el objetivo pide aula.", "Cambia solo la palabra dev por aula. La línea debe quedar así: `  MODO: aula` (con dos espacios delante, sin tabuladores).", "Pulsa Validar para comprobar que el YAML está bien escrito y después Aplicar para enviarlo al clúster. Si da error, revisa los espacios de la sangría."],
    explanation:'La configuración se guarda como un recurso independiente. Una aplicación puede consumirla a través de variables de entorno o montarla como archivos.'
  },
  {
    id:'arquitectura', title:'Dentro del Control Plane', minutes:7, xp:80,
    intro:'Localiza los puntos desde los que Kubernetes controla y ejecuta las cargas.',
    concept:'El API server recibe solicitudes. etcd almacena el estado. El scheduler asigna Pods sin nodo. Los controladores reconcilian el estado deseado y el real. Los kubelets operan en los nodos.',
    objectives:[inspected('Consulta los nodos y sus roles.','Node'),inspected('Inspecciona kube-scheduler en kube-system.','Component','kube-scheduler')],
    hints:["Los componentes internos solo se ven en modo Detallado. Pulsa Detallado sobre la escena (o abre el explorador de recursos).", "Primer objetivo: ejecuta `kubectl get nodes`. El nodo con rol control-plane gobierna el clúster; los worker ejecutan tus aplicaciones.", "Los componentes del Control Plane viven en el namespace kube-system. Lístalos con `kubectl get components -n kube-system`.", "Para inspeccionar kube-scheduler, haz clic en él en el Explorador o ejecuta `kubectl describe component kube-scheduler -n kube-system`.", "Idea clave: el scheduler decide en qué nodo se ejecuta cada Pod nuevo; el API server recibe tus peticiones y etcd guarda el estado."],
    explanation:'La separación entre decisiones y ejecución permite que Kubernetes reconcilie cambios continuamente. En este simulador, Component es un tipo didáctico. En un clúster kubeadm, estos componentes suelen verse como Pods estáticos.'
  },
  {
    id:'namespaces', title:'Separa tus entornos', xp:90,
    intro:'Crea el namespace equipo y ejecuta un Pod en él.',
    concept:'Los namespaces agrupan recursos y delimitan nombres. Un Pod del mismo nombre puede existir en dos namespaces. Los nodos son recursos de ámbito de clúster.',
    objectives:[exists('Crea el namespace equipo.','Namespace','equipo',''),exists('Ejecuta el Pod demo en equipo.','Pod','demo','equipo')],
    hints:["Un namespace es como una carpeta dentro del clúster para separar recursos (por ejemplo, por equipo o entorno). Se crea con `kubectl create namespace <nombre>`.", "Escribe `kubectl create namespace equipo` y comprueba con `kubectl get namespaces`.", "Por defecto todo se crea en el namespace default. Para crear un Pod en otro, añade -n: `kubectl run <pod> --image=<imagen> -n <namespace>`.", "Comando completo: `kubectl run demo --image=nginx:1.27 -n equipo`.", "Verifica con `kubectl get pods -n equipo`. Sin -n solo verías los Pods de default."],
    explanation:'Los namespaces hacen posible aplicar políticas y cuotas por ámbito. Su existencia por sí sola no constituye un límite de red o seguridad.'
  },
  {
    id:'replicas', title:'Escala un Deployment', seed:'app', difficulty:'Intermedio', xp:120,
    intro:'Aumenta la capacidad de atlas a tres réplicas listas.',
    concept:'Un Deployment gestiona ReplicaSets. El ReplicaSet crea Pods hasta alcanzar la cantidad deseada. Al borrar un Pod gestionado, aparece un reemplazo.',
    objectives:[field('Fija las réplicas deseadas de atlas en 3.','Deployment','atlas','spec.replicas',3),available('atlas',3)],
    hints:["Un Deployment mantiene un número deseado de copias (réplicas) de tu app. Mira el estado actual con `kubectl get deployments`.", "La columna LISTOS muestra 2/2: dos réplicas funcionando. El objetivo pide 3.", "Cambia el número con `kubectl scale deployment/<nombre> --replicas=<número>`.", "Comando completo: `kubectl scale deployment/atlas --replicas=3`.", "Comprueba con `kubectl get pods`: deben salir 3 Pods Running. En la escena verás aparecer el Pod nuevo."],
    explanation:'Kubernetes reconcilia el Deployment, su ReplicaSet y los Pods. Alcanzar 3/3 requiere que los Pods previstos estén listos, además de fijar spec.replicas.'
  },
  {
    id:'servicio', title:'Selecciona los Pods adecuados', seed:'app', difficulty:'Intermedio', xp:120,
    intro:'Prepara el Service atlas-web, con puerto 8080 y destinos en la aplicación atlas.',
    concept:'port es el puerto del Service. targetPort corresponde al puerto del contenedor. Los selectores deben coincidir con las etiquetas de los Pods.',
    objectives:[field('Configura el puerto 8080 en atlas-web.','Service','atlas-web','spec.ports.0.port',8080),endpoints('atlas-web')],
    hints:["Aquí el Service se llamará atlas-web aunque el Deployment se llame atlas: los nombres son independientes. Lo que los une son las etiquetas.", "Mira las etiquetas de los Pods con `kubectl get pods --show-labels`. El Service usa app=atlas para encontrarlos; kubectl expose lo copia por ti.", "port es el puerto del Service y target-port el del contenedor (nginx escucha en el 80). Forma: `kubectl expose deployment atlas --name=<servicio> --port=<puerto> --target-port=<puerto del contenedor>`.", "Comando completo: `kubectl expose deployment atlas --name=atlas-web --port=8080 --target-port=80`. Si omites --target-port, usará 8080 y el tráfico no llegará.", "Comprueba con `kubectl get endpoints atlas-web`: deben salir los Pods de atlas."],
    explanation:'Los selectores enlazan Services con Pods por atributos. El nombre del Service puede elegirse con independencia del Deployment.'
  },
  {
    id:'configuracion', title:'Configuración y secretos', seed:'app', difficulty:'Intermedio', xp:120,
    intro:'Crea la configuración web y un Secret con un valor de demostración.',
    concept:'ConfigMap almacena configuración no confidencial. Secret separa material sensible y requiere políticas de acceso, cifrado y rotación en producción.',
    template:'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: atlas-config\ndata:\n  LOG_LEVEL: info\n---\napiVersion: v1\nkind: Secret\nmetadata:\n  name: atlas-demo\ntype: Opaque\nstringData:\n  DEMO_TOKEN: ejemplo-simulado\n',
    objectives:[exists('Crea atlas-config.','ConfigMap','atlas-config'),objective('Crea atlas-demo con la clave DEMO_TOKEN.','secretKey',{name:'atlas-demo',key:'DEMO_TOKEN'})],
    hints:["Hay que crear dos recursos: un ConfigMap (configuración normal) y un Secret (datos sensibles). El editor YAML ya trae los dos.", "Los dos recursos están en el mismo archivo, separados por una línea con tres guiones `---`.", "No necesitas cambiar nada: pulsa Validar y después Aplicar. Usa solo valores de prueba como ejemplo-simulado; nunca pongas contraseñas reales.", "Comprueba con `kubectl get configmap` y `kubectl get secret`. Si falla, revisa la sangría del YAML."],
    explanation:'Kubernetes convierte stringData a data en la API. El simulador conserva únicamente las claves del Secret para evitar mostrar o persistir valores.'
  },
  {
    id:'ingress', title:'Publica una ruta HTTP', seed:'service', difficulty:'Intermedio', xp:120,
    intro:'Crea un Ingress para enrutar atlas.local al Service atlas.',
    concept:'Un recurso Ingress describe reglas HTTP. Un controlador observado en el clúster materializa esas reglas. El Service y sus endpoints siguen formando parte de la ruta.',
    template:'apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: atlas-http\nspec:\n  ingressClassName: nginx\n  rules:\n    - host: atlas.local\n      http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: atlas\n                port:\n                  number: 80\n',
    objectives:[exists('Crea el Ingress atlas-http.','Ingress','atlas-http'),objective('Consigue una ruta activa hacia atlas.','route',{name:'atlas-http',backend:'atlas',host:'atlas.local'})],
    hints:["Un Ingress es la puerta de entrada HTTP: dirige las peticiones por dominio (host) y ruta hacia un Service. Antes comprueba que atlas funciona con `kubectl get endpoints atlas`.", "El editor ya trae un Ingress. Fíjate en sus partes: host atlas.local, path /, y backend con el nombre del Service (atlas) y su puerto (80).", "Si cambias algo, el nombre y el puerto del backend deben coincidir con los del Service. Míralos con `kubectl get service atlas`.", "Pulsa Aplicar y comprueba con `kubectl get ingress`, o selecciona atlas-http en el Explorador. Debe aparecer Activo."],
    explanation:'La escena muestra la cadena Ingress → Service → Pods cuando el backend es utilizable. La práctica simula un controlador disponible y no registra dominios públicos.'
  },
  {
    id:'rollout', title:'Actualiza una aplicación', seed:'service', difficulty:'Intermedio', xp:140,
    intro:'Actualiza atlas a nginx:1.28 y conserva dos réplicas disponibles.',
    concept:'Cambiar la plantilla de un Deployment inicia un rollout. Kubernetes registra revisiones y permite volver a una plantilla anterior.',
    objectives:[field('Usa nginx:1.28 en la plantilla de atlas.','Deployment','atlas','spec.template.spec.containers.0.image','nginx:1.28'),available('atlas',2),endpoints('atlas')],
    hints:["Actualizar una app es cambiar la imagen en la plantilla del Deployment. Kubernetes reemplaza los Pods poco a poco (rolling update) para no cortar el servicio.", "Necesitas el nombre del contenedor: `kubectl describe deployment atlas` y busca containers: name. Aquí se llama atlas.", "Forma del comando: `kubectl set image deployment/<deployment> <contenedor>=<imagen>`.", "Comando completo: `kubectl set image deployment/atlas atlas=nginx:1.28`.", "Sigue el avance con `kubectl rollout status deployment/atlas`. Si algo sale mal, `kubectl rollout undo deployment/atlas` vuelve a la versión anterior."],
    explanation:'El estado final combina la imagen, la disponibilidad de réplicas y la posibilidad de enrutar tráfico. El simulador consolida las etapas de un rolling update en una transición determinista.'
  },
  {
    id:'almacenamiento', title:'Reserva almacenamiento persistente', seed:'volume', difficulty:'Intermedio', xp:140,
    intro:'Vincula un PersistentVolumeClaim con el volumen preaprovisionado.',
    concept:'Un PV representa almacenamiento disponible. Un PVC declara tamaño, modos de acceso y clase. Si son compatibles, Kubernetes vincula ambos recursos.',
    template:'apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: datos-atlas\nspec:\n  storageClassName: aula\n  accessModes: [ReadWriteOnce]\n  resources:\n    requests:\n      storage: 2Gi\n',
    objectives:[exists('Crea el PVC datos-atlas.','PersistentVolumeClaim','datos-atlas'),objective('Consigue que datos-atlas quede Bound al PV del aula.','status',{type:'PersistentVolumeClaim',name:'datos-atlas',value:'Bound'})],
    hints:["Un PersistentVolume (PV) es un disco ya disponible. Un PersistentVolumeClaim (PVC) es la petición de un usuario: necesito 2Gi. Kubernetes los une (Bound) cuando son compatibles.", "Mira el disco disponible con `kubectl get pv`. Solo hay uno: pv-aula.", "El editor trae un PVC. Comprueba que su storageClassName, accessModes y el tamaño solicitado encajan con el PV.", "Pulsa Aplicar y mira `kubectl get pvc`. Debe pasar a Bound. Si se queda en Pending, algo no coincide: clase, modo de acceso o tamaño."],
    explanation:'Bound indica que un volumen compatible quedó reservado para el claim. Esta simulación representa la vinculación estática. En producción un provisionador puede crear el volumen dinámicamente.'
  },
  {
    id:'recursos', title:'Define los recursos de un contenedor', seed:'app', difficulty:'Intermedio', xp:140,
    intro:'Establece un request de memoria de 64Mi y un límite de 128Mi para atlas.',
    concept:'El scheduler considera los requests al colocar Pods. El límite de memoria restringe el consumo y el kernel puede terminar un contenedor que lo exceda.',
    objectives:[field('Define 64Mi de memoria solicitada.','Deployment','atlas','spec.template.spec.containers.0.resources.requests.memory','64Mi'),field('Define 128Mi de límite de memoria.','Deployment','atlas','spec.template.spec.containers.0.resources.limits.memory','128Mi'),available('atlas',2)],
    hints:["requests es la memoria que reservas para que el scheduler encuentre sitio; limits es el máximo que el contenedor puede usar antes de ser terminado.", "Se configuran por contenedor con `kubectl set resources deployment/<nombre> --requests=memory=<valor> --limits=memory=<valor>`.", "Comando completo: `kubectl set resources deployment/atlas --requests=memory=64Mi --limits=memory=128Mi`.", "Revisa el resultado con `kubectl get deployment atlas -o yaml` y busca el bloque resources. Las 2 réplicas deben seguir disponibles."],
    explanation:'Requests y límites cumplen funciones diferentes. El cambio de plantilla crea una revisión y el Deployment vuelve a reconciliar sus Pods.'
  },
  {
    id:'selector-roto', title:'El servicio sin destinos', seed:'bad-selector', category:'Incidencia', difficulty:'Inicial', xp:150,
    intro:'Atlas devuelve 503. El despliegue parece disponible, pero el Service no tiene destinos listos.',
    concept:'Un 503 simulado indica que el Service se quedó sin endpoints. Compara las etiquetas y los selectores antes de modificar el Deployment.',
    focus:'Service', objectives:[available('atlas',2),endpoints('atlas')],
    hints:["Método de diagnóstico: empieza por los Pods con `kubectl get pods` y luego mira si el Service tiene destinos con `kubectl get endpoints atlas`.", "Los Pods están Running, pero el Service no tiene endpoints. Un Service encuentra Pods por etiquetas: compara el Selector de `kubectl describe service atlas` con las etiquetas de `kubectl get pods --show-labels`.", "El Service busca la etiqueta app=portal, pero los Pods tienen app=atlas. Hay que corregir el selector del Service.", "Opción editor: en la pestaña YAML cambia `app: revisa-esta-etiqueta` por `app: atlas` y pulsa Aplicar.", "Opción comando: `kubectl patch service atlas --type=merge -p '{\"spec\":{\"selector\":{\"app\":\"atlas\"}}}'`."],
    template:'apiVersion: v1\nkind: Service\nmetadata:\n  name: atlas\nspec:\n  selector:\n    app: revisa-esta-etiqueta\n  ports:\n    - port: 80\n      targetPort: 80\n',
    explanation:'La aplicación estaba sana. El selector del Service no coincidía con las etiquetas de los Pods. Restablecer los endpoints recupera la ruta de tráfico.'
  },
  {
    id:'imagen-rota', title:'El despliegue detenido', seed:'bad-image', category:'Incidencia', difficulty:'Intermedio', xp:170,
    intro:'El despliegue atlas acaba de perder las dos réplicas y genera una alerta de disponibilidad.',
    concept:'Los eventos de un Pod indican si el runtime pudo obtener su imagen. El contenido de logs depende de que algún contenedor haya llegado a ejecutar.',
    objectives:[available('atlas',2),endpoints('atlas')],
    hints:["Empieza mirando los Pods: `kubectl get pods`. Si ESTADO es ImagePullBackOff, el contenedor ni siquiera llegó a arrancar.", "Para saber por qué: `kubectl get events`. Busca el aviso de que no se encontró la imagen (versión que no existe).", "Mira qué imagen usa el Deployment y su historial con `kubectl rollout history deployment/atlas`: la revisión 2 usa nginx:missing.", "Vuelve a la versión anterior que funcionaba con `kubectl rollout undo deployment/atlas`.", "Otra opción: poner la imagen buena a mano con `kubectl set image deployment/atlas atlas=nginx:1.27`."],
    explanation:'La etiqueta de imagen inexistente impedía descargar el contenedor. Cambiar la imagen o deshacer la revisión puede recuperar la aplicación.'
  },
  {
    id:'memoria', title:'Atlas se queda sin memoria', seed:'bad-memory', category:'Incidencia', difficulty:'Avanzado', xp:180,
    intro:'La aplicación se reinicia y el tráfico falla de forma intermitente.',
    concept:'Examina el último motivo de terminación, los eventos y la demanda de memoria para distinguir un reinicio por OOM de una caída de la aplicación.',
    objectives:[available('atlas',2),endpoints('atlas')],
    hints:["Pods con ESTADO OOMKilled: el contenedor superó su límite de memoria y Kubernetes lo terminó. OOM significa out of memory.", "Compara el consumo real con el límite usando `kubectl top pod`: usa 48Mi y el límite es 16Mi.", "Hay que subir el límite de memoria por encima de lo que consume la app (y pedir una reserva razonable).", "Comando: `kubectl set resources deployment/atlas --requests=memory=64Mi --limits=memory=128Mi`.", "Comprueba con `kubectl get pods`: deben volver a Running."],
    explanation:'El contenedor rebasaba su límite de memoria. Ajustar el presupuesto y verificar la disponibilidad recupera los endpoints.'
  },
  {
    id:'incidencia-doble', title:'Cambio de guardia', seed:'double', category:'Incidencia', difficulty:'Avanzado', xp:220,
    intro:'La sonda externa de atlas devuelve 503 después del último cambio. Restablece el servicio.',
    concept:'En una incidencia pueden coincidir varias causas. Valida la recuperación de extremo a extremo tras cada cambio.',
    objectives:[available('atlas',2),endpoints('atlas')],
    hints:["Aquí hay más de un fallo a la vez. Revisa por capas: 1) los Pods con `kubectl get pods` y 2) el Service con `kubectl get endpoints atlas`.", "Los Pods están en ImagePullBackOff: la imagen no se pudo descargar. Mira el historial con `kubectl rollout history deployment/atlas`.", "La versión nueva usa una imagen que no existe. Vuelve a la anterior con `kubectl rollout undo deployment/atlas`.", "Vuelve a comprobar con `kubectl get pods --show-labels` y `kubectl get endpoints atlas`. Los Pods ya funcionan, pero el Service sigue sin destinos: arreglar el primer fallo ha dejado ver el segundo.", "El Service busca app=portal y los Pods tienen app=atlas. Corrígelo: `kubectl patch service atlas --type=merge -p '{\"spec\":{\"selector\":{\"app\":\"atlas\"}}}'`.", "Valida de extremo a extremo: 2 réplicas disponibles y endpoints de atlas."],
    explanation:'Fallaron a la vez la imagen del Deployment y el selector del Service. El objetivo exige disponibilidad y endpoints activos al mismo tiempo.'
  },
  {
    id:'rbac', title:'Acceso de mínimo privilegio', difficulty:'Avanzado', xp:190,
    intro:'Crea un Role y vincúlalo a observador para que pueda leer Pods del namespace default.',
    concept:'Role define permisos dentro de un namespace. RoleBinding los concede a sujetos. Los verbos y recursos deben ceñirse a la tarea.',
    template:'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: lector-pods\nrules:\n  - apiGroups: [""]\n    resources: ["pods"]\n    verbs: ["get", "list", "watch"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: observador-pods\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: Role\n  name: lector-pods\nsubjects:\n  - kind: User\n    name: observador\n    apiGroup: rbac.authorization.k8s.io\n',
    objectives:[objective('Concede a observador lectura de Pods con un Role de alcance limitado.','leastPrivilege',{name:'observador-pods'})],
    hints:["RBAC controla quién puede hacer qué. Un Role lista permisos (qué acciones sobre qué recursos) y un RoleBinding asigna ese Role a un usuario.", "El editor ya trae las dos piezas. En el Role: resources pods, y verbs get, list y watch (solo lectura). El apiGroup vacío es el grupo principal, donde viven los Pods.", "Mínimo privilegio significa dar solo lo necesario: no añadas verbos como delete o create, ni comodines.", "El RoleBinding une el Role lector-pods con el usuario observador. Pulsa Validar y después Aplicar."],
    explanation:'El RoleBinding concede permisos en su namespace. Esta práctica verifica recursos, verbos, referencias y el sujeto de la vinculación en el estado declarado.'
  },
  {
    id:'politicas', title:'Restringe el tráfico entrante', seed:'service', difficulty:'Avanzado', xp:190,
    intro:'Aplica una NetworkPolicy que deniegue las conexiones entrantes a los Pods de atlas.',
    concept:'Una política de Ingress sin reglas aísla a los Pods seleccionados. Las políticas se combinan de forma aditiva. Su aplicación efectiva requiere un plugin de red compatible.',
    template:'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: aislar-atlas\nspec:\n  podSelector:\n    matchLabels:\n      app: atlas\n  policyTypes: [Ingress]\n  ingress: []\n',
    objectives:[objective('Aísla el tráfico entrante de atlas.','denyIngress',{name:'aislar-atlas'}),available('atlas',2)],
    hints:["Por defecto cualquier Pod acepta tráfico de cualquiera. Una NetworkPolicy lo restringe.", "El editor trae una política. podSelector elige a qué Pods se aplica (app: atlas); policyTypes Ingress dice que regula el tráfico entrante; ingress vacío significa que nadie puede entrar.", "Pulsa Aplicar. Los Pods siguen Running (el segundo objetivo sigue cumpliéndose), pero ya no les llegan conexiones: en la escena el tráfico aparece bloqueado."],
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
].map(lesson=>[lesson.id,{...defaultLesson,skills:Object.hasOwn(skillMap,lesson.id)?skillMap[lesson.id]:[],...lesson}]));

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

export const lessonOrder = modules.flatMap(module=>module.lessons);
export const allSkills = lessonOrder.flatMap(id=>lessons[id].skills.map(name=>({id:id+':'+name,name,lesson:id})));
export const bonusRate = 0.25;
