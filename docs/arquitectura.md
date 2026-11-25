# Arquitectura de KubePath

## Decisiones iniciales

La primera entrega ejecuta los laboratorios como simulaciones deterministas en el navegador. Las prácticas comparten un modelo de recursos y un intérprete con operaciones explícitas. El intérprete no ejecuta un shell, no realiza solicitudes al laboratorio ni recibe credenciales de Kubernetes. La aplicación se entrega como sitio estático y se puede alojar en Sites o NGINX mediante Docker.

La interfaz utiliza HTML semántico, CSS adaptable y módulos de JavaScript. La escena 3D usa WebGL con three.js (r170, servido desde `dist/assets/three` por la política de contenido): materiales físicos, sombras suaves, reflejos de entorno, bloom y un modelo propio por tipo de recurso. Un lienzo 2D superpuesto dibuja las etiquetas y recibe el ratón. Si el navegador no ofrece WebGL, la escena vuelve al render proyectado en Canvas 2D. La vista 2D es un diagrama de tarjetas en el mismo lienzo. El explorador HTML ofrece acceso alternativo a los recursos. El laboratorio y la escena se cargan al entrar a una práctica. El análisis YAML usa js-yaml con el esquema JSON y límites de tamaño y cantidad de objetos.

## Modelo de datos

| Entidad | Campos centrales | Persistencia |
|---|---|---|
| Módulo | Identificador, nivel, objetivos, lecciones | Catálogo versionado |
| Lección | Entorno, briefing, estado inicial, objetivos, pistas y explicación | Catálogo versionado |
| Sesión simulada | Recursos, inspecciones, eventos, historial, editor, fase | Memoria de la sesión, incluido el borrador del editor |
| Recurso | Tipo, namespace, nombre, especificación, estado, relaciones | Sesión simulada |
| Progreso | Identificador de lección, primer logro, XP, racha, intentos | Almacenamiento local con versión |
| Preferencias | Nombre visible y tema | Almacenamiento local |

La clave de un recurso combina tipo, namespace y nombre. Las acciones validadas alimentan la reconciliación de Pods, ReplicaSets y dependencias antes de actualizar la vista. Los objetivos evalúan el resultado del laboratorio. En prácticas de inspección se registra la lectura de recursos específicos. El progreso y el XP se asignan una vez por objetivo de aprendizaje completado.

## Componentes

- Catálogo curricular, misiones y definición de entornos.
- Motor simulado, parser de comandos, reconciliación y validación de manifiestos.
- Interfaz del laboratorio, editor, terminal, explorador, ayuda y validación.
- Escena 3D, cámara, selección y animación.
- Dashboard, mapa curricular, actividad, rango y ajustes de accesibilidad.
- Pruebas del motor y de los objetivos de aprendizaje.

## Implementación por fases

1. Academia, progreso local y simulaciones iniciales con interacción 3D.
2. Aplicaciones, almacenamiento, diagnóstico, simulacros y constructor. Validación de configuraciones y de resultados con pruebas de integración.
3. Cuentas, progreso multidispositivo y entornos reales aislados. API propia con OIDC, sesiones HTTP-only, PostgreSQL con propiedad por usuario, cola de aprovisionamiento, plano de ejecución separado y auditoría.
4. Ampliación del plan curricular, evaluación accesible, métricas pedagógicas y catálogo de escenarios validado con clústeres reales.

## Entornos reales y controles de producción

El adaptador futuro expondrá operaciones de sesión y recursos con el mismo contrato conceptual que el simulador. La interfaz distinguirá las sesiones con una etiqueta específica. Un clúster por sesión vivirá en una VM desechable con una identidad de corta duración. El servicio de ejecución se desplegará en una cuenta de infraestructura separada, con red denegada por defecto y acceso a imágenes mediante un registro controlado. La demanda de CPU, RAM, almacenamiento, sesiones simultáneas y tiempo estará limitada. Una tarea independiente reasignará o eliminará máquinas expiradas y verificará el borrado. Un namespace compartido no sustituye el aislamiento exigido.

El servicio verificará la propiedad de la sesión en cada operación y emitirá credenciales limitadas a ese entorno. La validación consultará el API de Kubernetes y, cuando proceda, resultados de sondas internas. Las métricas, los logs y los eventos estarán sujetos a límites y evitarán credenciales en registros. El runner quedará fuera del alcance de la API general y nunca usará el socket Docker ni credenciales de un clúster anfitrión. Antes de habilitar altas, se exige caracterizar el aislamiento, la expiración, la revocación, el coste y la recuperación ante fallos.

## Ampliación curricular

Los seis niveles avanzan desde Linux, terminal, redes, contenedores y YAML hasta arquitectura, despliegue, operación, diagnóstico y plataforma. Después del itinerario inicial, se prevé ampliar con Jobs/CronJobs, controladores Ingress, StorageClasses, StatefulSets/DaemonSets, afinidad, tolerancias, HPA, DNS, TLS, SLO y recuperación multicapa. La ruta avanzada se extiende a Helm, Kustomize, Argo CD, CI/CD, Prometheus/Grafana, gestión de secretos, alta disponibilidad y restauración. El catálogo visible enlaza únicamente actividades que se pueden abrir y resolver.
