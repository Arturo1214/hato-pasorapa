# Entorno local sin Docker

Guia rapida para levantar Pasorapa Hato en tu maquina usando PostgreSQL local, `jenv` para Java y `nvm` para Node. Esto es para desarrollo rapido: no construye imagenes Docker ni ejecuta build de produccion.

## Puertos

| Servicio | URL |
| --- | --- |
| Frontend Angular | http://localhost:4200 |
| Backend Quarkus | http://localhost:8080 |
| Swagger UI | http://localhost:8080/q/swagger-ui |
| Health | http://localhost:8080/q/health |
| PostgreSQL local | localhost:5432 |

## 1. Preparar PostgreSQL local

Si ya tenes PostgreSQL instalado, crea la base y el usuario esperado para local:

```bash
createdb hato
```

Si necesitás forzar usuario/password `postgres/postgres` en tu PostgreSQL local, ajustalo desde `psql` segun tu instalacion. El backend local asume por defecto:

```txt
DB_URL=jdbc:postgresql://localhost:5432/hato
DB_USER=postgres
DB_PASS=postgres
```

Si tu PostgreSQL usa otro usuario o puerto, exporta las variables antes de levantar el backend.

## 2. Instalar dependencias frontend

Desde la raiz del repo:

```bash
nvm use
cd hato-fe
npm install
```

Este repo usa `npm` (`packageManager: npm@11.12.1`). No uses `yarn` salvo que decidas migrar el lockfile.

## 3. Levantar backend local

Opcion recomendada:

```bash
bash infraestructure/local/start-be.sh
```

Comando manual equivalente:

```bash
cd hato-be
jenv local 21.0.5
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export PATH="$JAVA_HOME/bin:$PATH"
export HTTP_PORT=8080
export DB_URL=jdbc:postgresql://localhost:5432/hato
export DB_USER=postgres
export DB_PASS=postgres
export CORS_ORIGINS=http://localhost:4200,http://localhost:3000,http://localhost:5173
export QUARKUS_LOG_FILE_ENABLED=true
export QUARKUS_LOG_FILE_PATH=../logs/hato-be-local.log
export QUARKUS_LOG_CONSOLE_JSON_ENABLED=false
export QUARKUS_LOG_FILE_JSON_ENABLED=false
export HATO_STORAGE_ANIMAL_IMAGES_ROOT_DIR=../images
./mvnw quarkus:dev
```

Liquibase corre al iniciar y aplica migraciones sobre la base `hato`.

## 4. Levantar frontend local

En otra terminal, desde la raiz del repo:

```bash
bash infraestructure/local/start-fe.sh
```

Comando manual equivalente:

```bash
nvm use
cd hato-fe
npm start -- --proxy-config ../infraestructure/local/proxy.conf.json --host 0.0.0.0 --port 4200
```

El proxy local envia `/api`, `/q` y `/animal-images` al backend en `http://localhost:8080`, reemplazando el nginx de Docker.

## 5. Levantar todo en una sola terminal

```bash
bash infraestructure/local/start-all.sh
```

Esto inicia backend y frontend en paralelo. Para cortar ambos procesos usa `Ctrl+C`.

## 6. Logs locales

Backend local escribe en:

```txt
logs/hato-be-local.log
```

Para seguirlos:

```bash
tail -f logs/hato-be-local.log
```

## 7. Reset rapido de base local

Esto borra datos locales. Usalo solo si queres reiniciar migraciones desde cero:

```bash
dropdb hato
createdb hato
```

Despues levanta de nuevo el backend para que Liquibase regenere el esquema.

## 8. Tests focalizados utiles

Backend con Java 21:

```bash
cd hato-be
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalServiceTest,AnimalResourceTest,AnimalCategoryWorkflowLiquibaseMigrationTest test
```

Frontend:

```bash
cd hato-fe
nvm use
npm test -- --watch=false
```

## Problemas comunes

### El backend toma Java 8 aunque `java -version` diga 21

Forza `JAVA_HOME`:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export PATH="$JAVA_HOME/bin:$PATH"
```

### El frontend devuelve 404/500 para `/api/*`

Verifica que estes usando el proxy:

```bash
npm start -- --proxy-config ../infraestructure/local/proxy.conf.json --host 0.0.0.0 --port 4200
```

### PostgreSQL rechaza conexion

Verifica que el servicio local este corriendo y que exista la base:

```bash
pg_isready -h localhost -p 5432
psql -h localhost -p 5432 -U postgres -d hato
```
