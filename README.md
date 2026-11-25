# KubePath · Curso interactivo de Kubernetes

KubePath reúne 18 prácticas en seis niveles, con una ruta guiada (siguiente misión, conceptos que aprenderás, insignias por nivel), recompensas al completar cada práctica (XP, bonus sin pistas, rangos y logros) y un panel de progreso visual. Puedes desplegar un Pod, escalar aplicaciones, inspeccionar un clúster simulado y diagnosticar incidencias desde una terminal en el navegador. El editor YAML, el explorador y la topología 3D se sincronizan con el mismo estado. Los objetivos se validan sobre los recursos y el progreso se guarda en el navegador.

## Ejecutar el proyecto

La aplicación estática vive en `dist/`. No necesita un paso de compilación.

En Sandbox, prueba `kubectl get pods`. La topología y el explorador resaltan los Pods de la respuesta. Los filtros de namespace y etiquetas también se aplican al resaltado. Al escalar un Deployment, la escena muestra qué recursos aparecieron o cambiaron, y el resumen registra las eliminaciones.

```sh
python3 -m http.server 4173 --directory dist
```

Abre [http://localhost:4173](http://localhost:4173).

### Docker

```sh
docker build -t kubepath .
docker run --rm -p 4173:8080 kubepath
```

### Pruebas

Requiere Node.js 22 o posterior.

```sh
npm test
```

## Alcance

La Academia incluye fundamentos, arquitectura, despliegue, administración, diagnóstico y seguridad. Sandbox, Troubleshooting, Challenge Mode, Survival Mode, simulacros de certificación y el constructor visual reutilizan el motor con objetivos y flujos distintos.

Los laboratorios se identifican como simulaciones. El intérprete admite un subconjunto de operaciones de `kubectl` y no inicia procesos del sistema. Los estados, el tráfico, las métricas y los eventos pertenecen al modelo didáctico. Los simulacros de certificación son material de práctica independiente.

Las cuentas, la sincronización entre dispositivos y los clústeres reales aislados se describen como ampliaciones en el [documento de arquitectura](docs/arquitectura.md).

### Vista del clúster

- Filtro por tipo: pulsa un tipo para mostrarlo u ocultarlo; doble clic para ver solo ese tipo. **Esencial** y **Todo** son preajustes.
- Ratón: arrastrar gira, clic derecho o Mayús + arrastrar desplaza, la rueda hace zoom hacia el cursor y el doble clic acerca la cámara al recurso (en el fondo, la restablece).
- Táctil: un dedo gira, dos dedos desplazan y hacen zoom.
- Teclado (con la escena enfocada): flechas giran, Mayús + flechas desplazan, + y − hacen zoom, F centra lo seleccionado y 0 restablece.

La escena 3D usa [three.js](https://threejs.org) (licencia MIT, copia en `dist/assets/three/LICENSE`).
