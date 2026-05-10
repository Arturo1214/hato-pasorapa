# Infraestructura de desarrollo

Objetivo: levantar **frontend + backend + PostgreSQL** con **un solo comando** usando un único `docker compose` con servicios separados.

## Qué incluye

- `db`: PostgreSQL 16 con volumen persistente
- `be`: Quarkus compilado a **nativo** dentro del build Docker
- `fe`: Angular compilado en build Docker y servido por **nginx**
- reverse proxy nginx para:
  - `/api` → backend
  - `/q` → endpoints técnicos de Quarkus (health/openapi/swagger)
  - fallback SPA a `index.html`

## Uso

Desde la raíz del repo o desde esta carpeta:

```bash
./infraestructure/dev/start.sh
```

El script:

1. crea `infraestructure/dev/.env` si no existe
2. resuelve `PROJECT_ROOT` y crea las carpetas host de imágenes y logs si no existen
3. ejecuta `docker compose up --build -d`
4. deja todo listo sin configuración manual extra

### Rebuild de BE/FE cuando cambió código

`./infraestructure/dev/start.sh up` ya corre `docker compose up --build -d`, así que normalmente alcanza con relanzarlo después de cambios en backend o frontend.

Si sospechás cache Docker vieja o una imagen local inconsistente, podés forzar rebuild manual antes de levantar:

```bash
docker compose --env-file infraestructure/dev/.env -f infraestructure/dev/docker-compose.yml build --no-cache be fe
./infraestructure/dev/start.sh up
```

Ese comando desde la raíz del repo funciona siempre que `infraestructure/dev/.env` tenga los defaults actuales (`../../images` y `../../logs`) o paths absolutos. Esos paths relativos se resuelven contra `infraestructure/dev/docker-compose.yml`, así que NO necesitás exportar `PROJECT_ROOT` manualmente.

## URLs

- App: `http://localhost:8080`
- Backend directo: `http://localhost:8081`
- Health backend: `http://localhost:8081/q/health`
- Swagger vía nginx: `http://localhost:8080/q/swagger-ui`
- PostgreSQL: `localhost:5434`

## Credenciales dev conocidas

El backend ya tiene un seed inicial documentado en `hato-be/README.md`:

- usuario: `root-admin`
- password: `RootAdmin9`

Usalo solo para desarrollo local.

## Variables

Partí de `infraestructure/dev/.env.example`.

Las más importantes:

- `DEV_WEB_PORT`: puerto expuesto por nginx
- `DEV_API_PORT`: puerto expuesto por Quarkus directo
- `DEV_DB_PORT`: puerto expuesto por PostgreSQL
- `POSTGRES_*`: credenciales dev de la base
- `CORS_ORIGINS`: orígenes permitidos por Quarkus
- `HATO_IMAGES_HOST_PATH`: carpeta del host donde persisten las imágenes subidas por el backend
- `HATO_LOGS_HOST_PATH`: carpeta del host donde persisten los logs de archivo del backend
- `QUARKUS_LOG_FILE_*`: toggle/path/level del archivo de log del backend
- `QUARKUS_LOG_CONSOLE_JSON_ENABLED` y `QUARKUS_LOG_FILE_JSON_ENABLED`: fuerzan logs legibles en texto plano

### Persistencia de imágenes

Las imágenes que guarda el backend **sí persisten fuera del contenedor** mediante un bind mount:

- host: `HATO_IMAGES_HOST_PATH`
- contenedor/backend: `HATO_STORAGE_ANIMAL_IMAGES_ROOT_DIR`

Default recomendado en `.env.example`:

```env
HATO_IMAGES_HOST_PATH=../../images
```

Ejemplo absoluto local:

```env
HATO_IMAGES_HOST_PATH=/Users/arturoherrera/Documents/proyectos/personal/pasorapa-hato/code/images
```

Si levantás esto en otro servidor, SOLO cambiá `HATO_IMAGES_HOST_PATH` en `infraestructure/dev/.env` hacia la carpeta persistente deseada. `start.sh` la crea automáticamente antes de correr Compose.

### Persistencia de logs del backend

Además de los logs por consola de Docker, el backend escribe un archivo persistente en el host mediante otro bind mount:

- host: `HATO_LOGS_HOST_PATH`
- contenedor/backend: archivo `QUARKUS_LOG_FILE_PATH` (default `/work/logs/hato-be.log`)

Default recomendado en `.env.example`:

```env
HATO_LOGS_HOST_PATH=../../logs
QUARKUS_LOG_FILE_ENABLED=true
QUARKUS_LOG_FILE_PATH=/work/logs/hato-be.log
QUARKUS_LOG_CONSOLE_JSON_ENABLED=false
QUARKUS_LOG_FILE_JSON_ENABLED=false
```

Ejemplo absoluto local:

```env
HATO_LOGS_HOST_PATH=/Users/arturoherrera/Documents/proyectos/personal/pasorapa-hato/code/logs
```

`start.sh` crea esa carpeta automáticamente antes de levantar Compose. Si querés desactivar el archivo de logs, poné `QUARKUS_LOG_FILE_ENABLED=false`; los logs por consola siguen funcionando igual.

> Si ya tenías un `.env` viejo con `${PROJECT_ROOT}/images` o `${PROJECT_ROOT}/logs`, actualizalo a `../../images` y `../../logs` (o usá un path absoluto) para que también funcione con `docker compose ... --env-file infraestructure/dev/.env` directo desde la raíz.

### PWA/service worker en entorno dev

La stack Docker de desarrollo **deshabilita explícitamente el service worker** sobre `localhost` y nginx responde `404` para `ngsw-worker.js`/`ngsw.json`. ¿Por qué? Porque en desarrollo local el SW puede quedar viejo y enmascarar respuestas reales del backend (por ejemplo mostrar 500 genérico cuando la API respondió 401).

Si ya tenías una versión vieja registrada en el navegador, después de recrear la stack limpiá el sitio una vez:

1. Abrí `http://localhost:8080`
2. DevTools → Application
3. Service Workers → **Unregister**
4. Storage → **Clear site data**
5. Hard reload de la página

## Operación

```bash
./infraestructure/dev/start.sh logs
./infraestructure/dev/start.sh ps
./infraestructure/dev/start.sh down
./infraestructure/dev/start.sh reset-db
```

## Recuperación segura cuando falla una migración Liquibase

Si un changeset falla a mitad de ejecución, Liquibase puede dejar la base dev en **estado parcial**: por ejemplo, algunas columnas o índices creados, pero el changeset todavía sin marcar como aplicado.

En este proyecto eso es especialmente importante después del fix en `010-offline-conflict-resolution-v2.yaml`: si el intento fallido previo ya alcanzó a crear pasos parciales, no alcanza con “levantar de nuevo” sobre la misma base.

### Reset recomendado de base dev

⚠️ **Esto borra TODOS los datos de PostgreSQL de desarrollo.** No lo uses si querés conservar datos locales.

Opción interactiva:

```bash
./infraestructure/dev/start.sh reset-db
```

Opción no interactiva explícita:

```bash
CONFIRM_RESET=yes ./infraestructure/dev/start.sh reset-db
```

Ese comando ejecuta `docker compose down --volumes --remove-orphans` para esta stack dev y recrea la base desde cero en el próximo `up`.

### Reintento después del reset

```bash
./infraestructure/dev/start.sh up
./infraestructure/dev/start.sh logs
```

Si el problema venía de una migración parcial anterior, el backend debería reintentar Liquibase sobre una base limpia.

### Qué NO borra

- no borra tu código fuente
- no borra el bind mount de imágenes configurado en `HATO_IMAGES_HOST_PATH`
- no borra el bind mount de logs configurado en `HATO_LOGS_HOST_PATH`
- sí borra el volumen nombrado `hato_dev_postgres_data` usado por PostgreSQL dev

## Decisión técnica

No se usa “todo dentro de un solo contenedor”.

Se usa **un solo comando** sobre **un solo compose** con **tres servicios separados** porque eso mantiene:

- aislamiento entre FE / BE / DB
- reinicios independientes
- logs por servicio
- healthchecks reales
- una base más cercana a producción
