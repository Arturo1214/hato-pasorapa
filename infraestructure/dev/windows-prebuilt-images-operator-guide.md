# Levantar Pasorapa Hato en Windows usando imágenes Docker ya publicadas

Esta guía está pensada para una persona **sin conocimiento técnico profundo** que necesita levantar el sistema completo en una computadora Windows con recursos limitados, por ejemplo:

```txt
RAM: 8 GB
Procesador: AMD A6-9225 Radeon R4
Sistema: Windows 10/11 de 64 bits
```

El objetivo es NO compilar el proyecto en esa máquina. En vez de eso, Windows descargará imágenes Docker ya construidas desde GitHub Container Registry.

---

## Qué vas a levantar

El sistema tiene 3 partes:

| Parte | Qué hace | Imagen |
|---|---|---|
| Frontend | Pantalla web Angular | `ghcr.io/arturo1214/hato-pasorapa-fe:latest` |
| Backend | API Quarkus | `ghcr.io/arturo1214/hato-pasorapa-be:latest` |
| Base de datos | PostgreSQL | `postgres:16-alpine` |

Al final deberías poder abrir:

```txt
http://localhost:8080
```

Usuario inicial:

```txt
Usuario: root-admin
Contraseña: RootAdmin9
```

---

## Importante antes de empezar

Las imágenes de GitHub Container Registry están **privadas**.

Eso significa que antes de descargarlas necesitás:

1. una cuenta de GitHub con acceso a los paquetes, o
2. un token entregado por el dueño del repositorio.

El token debe permitir al menos:

```txt
read:packages
```

> Nunca publiques ese token en WhatsApp, documentos públicos o capturas. Es una contraseña técnica.

---

# Parte 1 — Preparar Windows

## 1. Verificar que Windows sea compatible

Presioná:

```txt
Windows + R
```

Escribí:

```txt
winver
```

Debe abrirse una ventana con la versión de Windows.

Recomendado:

- Windows 10 64-bit actualizado, o
- Windows 11.

---

## 2. Verificar virtualización

1. Presioná:

   ```txt
   Ctrl + Shift + Esc
   ```

2. Se abre el **Administrador de tareas**.
3. Entrá a la pestaña **Rendimiento**.
4. Hacé clic en **CPU**.
5. Buscá la línea:

   ```txt
   Virtualización: Habilitada
   ```

Si dice `Deshabilitada`, Docker puede fallar.

En ese caso, alguien con más experiencia debe entrar al BIOS/UEFI y activar una opción llamada parecido a:

- `SVM Mode`
- `AMD-V`
- `Virtualization Technology`

---

# Parte 2 — Instalar Docker Desktop

## 3. Descargar Docker Desktop

Abrí el navegador y entrá a:

```txt
https://www.docker.com/products/docker-desktop/
```

Descargá **Docker Desktop for Windows**.

---

## 4. Instalar Docker Desktop

1. Abrí el instalador descargado.
2. Dejá marcada la opción:

   ```txt
   Use WSL 2 instead of Hyper-V
   ```

3. Continuá con **Next / Install**.
4. Reiniciá la computadora si Windows lo pide.

---

## 5. Abrir Docker Desktop

1. Buscá **Docker Desktop** en el menú inicio.
2. Abrilo.
3. Esperá hasta que diga algo parecido a:

   ```txt
   Docker Desktop is running
   ```

Puede tardar varios minutos en una computadora lenta.

---

## 6. Configurar Docker para una PC de 8 GB RAM

En Docker Desktop:

1. Entrá a **Settings**.
2. Entrá a **Resources**.
3. Si aparecen opciones de memoria, usá algo similar a:

   ```txt
   Memory: 5 GB o 6 GB
   CPUs: 2 o 4
   Swap: 4 GB o 6 GB
   ```

4. Guardá con **Apply & Restart**.

> No uses los 8 GB completos. Windows también necesita memoria para funcionar.

---

# Parte 3 — Crear carpeta del sistema

## 7. Crear carpeta principal

Abrí el Explorador de archivos y creá esta carpeta:

```txt
C:\pasorapa-hato
```

Dentro de esa carpeta creá también:

```txt
C:\pasorapa-hato\images
C:\pasorapa-hato\logs
```

La carpeta debería quedar así:

```txt
C:\pasorapa-hato
  ├── images
  └── logs
```

---

# Parte 4 — Crear archivo docker-compose.yml

## 8. Abrir Bloc de notas

1. Abrí **Bloc de notas**.
2. Copiá TODO este contenido:

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: hato-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: hato
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      TZ: America/La_Paz
    ports:
      - "5434:5432"
    volumes:
      - hato_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d hato"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s

  be:
    image: ghcr.io/arturo1214/hato-pasorapa-be:latest
    container_name: hato-be
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      HTTP_PORT: 8080
      DB_URL: jdbc:postgresql://db:5432/hato
      DB_USER: postgres
      DB_PASS: postgres
      CORS_ORIGINS: http://localhost:8080,http://127.0.0.1:8080
      LOG_LEVEL: INFO
      QUARKUS_LOG_FILE_ENABLED: "true"
      QUARKUS_LOG_FILE_PATH: /work/logs/hato-be.log
      QUARKUS_LOG_FILE_LEVEL: INFO
      QUARKUS_LOG_CONSOLE_JSON_ENABLED: "false"
      QUARKUS_LOG_FILE_JSON_ENABLED: "false"
      AUTH_LEGACY_TOKEN_ENABLED: "false"
      HATO_STORAGE_ANIMAL_IMAGES_ENABLED: "true"
      HATO_STORAGE_ANIMAL_IMAGES_ROOT_DIR: /work/storage/animal-images
      HATO_STORAGE_ANIMAL_IMAGES_MAX_BYTES: 2097152
      HATO_STORAGE_ANIMAL_IMAGES_MIME_ALLOWLIST: image/jpeg,image/png
    ports:
      - "8081:8080"
    volumes:
      - ./images:/work/storage/animal-images
      - ./logs:/work/logs
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8080/q/health/ready || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 40s

  fe:
    image: ghcr.io/arturo1214/hato-pasorapa-fe:latest
    container_name: hato-fe
    restart: unless-stopped
    depends_on:
      be:
        condition: service_healthy
    ports:
      - "8080:80"
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1/ || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 10s

volumes:
  hato_postgres_data:
```

1. Guardalo como:

```txt
C:\pasorapa-hato\docker-compose.yml
```

MUY importante: el archivo debe llamarse exactamente:

```txt
docker-compose.yml
```

No debe quedar como:

```txt
docker-compose.yml.txt
```

Para verificarlo:

1. Abrí la carpeta `C:\pasorapa-hato`.
2. En el Explorador, activá **Ver → Extensiones de nombre de archivo**.
3. Confirmá que el archivo termine en `.yml`.

---

# Parte 5 — Iniciar sesión en GitHub Container Registry

## 9. Abrir PowerShell

1. Presioná:

   ```txt
   Windows + R
   ```

2. Escribí:

   ```txt
   powershell
   ```

3. Presioná Enter.

---

## 10. Ir a la carpeta del sistema

En PowerShell escribí:

```powershell
cd C:\pasorapa-hato
```

---

## 11. Iniciar sesión en GHCR

Ejecutá:

```powershell
docker login ghcr.io
```

Docker va a pedir:

```txt
Username:
```

Escribí tu usuario de GitHub.

Después va a pedir:

```txt
Password:
```

Pegá el token de GitHub con permiso `read:packages`.

> No te preocupes si al pegar no se ve nada. En PowerShell las contraseñas muchas veces no se muestran mientras se escriben.

Si salió bien, verás algo parecido a:

```txt
Login Succeeded
```

Si sale error, revisá:

- usuario correcto;
- token correcto;
- el token tiene permiso `read:packages`;
- la cuenta tiene acceso al paquete privado.

---

# Parte 6 — Descargar y levantar el sistema

## 12. Descargar imágenes

Desde PowerShell, dentro de `C:\pasorapa-hato`, ejecutá:

```powershell
docker compose pull
```

Esto descargará:

- frontend;
- backend;
- PostgreSQL.

En una conexión lenta puede tardar varios minutos.

---

## 13. Levantar el sistema

Ejecutá:

```powershell
docker compose up -d
```

Eso inicia el sistema en segundo plano.

---

## 14. Verificar que los contenedores estén arriba

Ejecutá:

```powershell
docker compose ps
```

Deberías ver algo parecido a:

```txt
hato-db   running
hato-be   running
hato-fe   running
```

Si alguno aparece como `starting`, esperá 1 o 2 minutos y volvé a ejecutar:

```powershell
docker compose ps
```

---

# Parte 7 — Abrir el sistema

## 15. Abrir la aplicación

En el navegador abrí:

```txt
http://localhost:8080
```

Ingresá con:

```txt
Usuario: root-admin
Contraseña: RootAdmin9
```

---

## 16. Verificar backend

En el navegador abrí:

```txt
http://localhost:8081/q/health
```

Debe aparecer una respuesta con estado `UP`.

También podés abrir Swagger:

```txt
http://localhost:8080/q/swagger-ui
```

---

# Parte 8 — Comandos útiles

## Ver estado

```powershell
docker compose ps
```

## Ver logs de todo

```powershell
docker compose logs -f
```

## Ver logs del backend

```powershell
docker compose logs -f be
```

## Ver logs del frontend

```powershell
docker compose logs -f fe
```

## Apagar el sistema

```powershell
docker compose down
```

## Encender nuevamente

```powershell
cd C:\pasorapa-hato
docker compose up -d
```

---

# Parte 9 — Actualizar a una nueva versión

Cuando se suba una nueva imagen, ejecutá:

```powershell
cd C:\pasorapa-hato
docker compose pull
docker compose up -d
```

Docker descargará la nueva versión y reiniciará los servicios necesarios.

---

# Parte 10 — Borrar base de datos y empezar de cero

⚠️ Esto borra todos los datos cargados en la base local.

Usalo solo si te lo indican.

```powershell
cd C:\pasorapa-hato
docker compose down -v
docker compose up -d
```

Qué borra:

- datos de PostgreSQL.

Qué NO debería borrar:

- carpeta `images`;
- carpeta `logs`;
- archivo `docker-compose.yml`.

---

# Parte 11 — Problemas comunes

## Docker no abre

Probá:

1. Reiniciar Windows.
2. Abrir Docker Desktop manualmente.
3. Esperar a que diga `Docker Desktop is running`.

---

## Error: Docker daemon is not running

Significa que Docker Desktop no está iniciado.

Solución:

1. Abrí Docker Desktop.
2. Esperá que termine de iniciar.
3. Reintentá el comando.

---

## Error al hacer docker login ghcr.io

Revisá:

- usuario GitHub correcto;
- token correcto;
- token con permiso `read:packages`;
- cuenta autorizada a leer los paquetes privados.

---

## La página no abre en localhost:8080

Primero revisá:

```powershell
docker compose ps
```

Si `hato-fe` no está corriendo, mirá logs:

```powershell
docker compose logs -f fe
```

Si `hato-be` no está corriendo:

```powershell
docker compose logs -f be
```

---

## Backend no está UP

Probá:

```powershell
docker compose logs -f be
```

Puede tardar un poco la primera vez porque Liquibase crea la base de datos.

---

## Puerto ocupado

Si aparece un error con puertos `8080`, `8081` o `5434`, significa que otro programa está usando ese puerto.

Solución simple:

1. Cerrá otros servicios locales.
2. Reiniciá Windows.
3. Reintentá:

```powershell
docker compose up -d
```

---

## La PC está muy lenta

Esta máquina tiene recursos limitados. Recomendaciones:

- cerrá Chrome si tiene muchas pestañas;
- cerrá programas pesados;
- no abras IDEs mientras levanta Docker;
- esperá unos minutos después de iniciar los contenedores.

La ventaja de usar imágenes preconstruidas es que esta PC **no compila** el backend ni el frontend; solo los ejecuta.

---

# Parte 12 — Acceso desde otra computadora en la misma red

Si querés abrir el sistema desde otra computadora o celular en la misma red:

1. En Windows abrí PowerShell.
2. Ejecutá:

```powershell
ipconfig
```

1. Buscá la IPv4, por ejemplo:

```txt
192.168.1.50
```

1. Desde otro equipo abrí:

```txt
http://192.168.1.50:8080
```

Si no abre, puede ser el Firewall de Windows. Permití el acceso al puerto `8080`.

---

# Checklist final

Marcá cada punto:

- [ ] Docker Desktop instalado.
- [ ] Docker Desktop está corriendo.
- [ ] Carpeta `C:\pasorapa-hato` creada.
- [ ] Carpetas `images` y `logs` creadas.
- [ ] Archivo `docker-compose.yml` creado correctamente.
- [ ] Login a `ghcr.io` realizado con éxito.
- [ ] `docker compose pull` terminó sin errores.
- [ ] `docker compose up -d` terminó sin errores.
- [ ] `docker compose ps` muestra `hato-db`, `hato-be`, `hato-fe` corriendo.
- [ ] `http://localhost:8080` abre la aplicación.
- [ ] Login con `root-admin` / `RootAdmin9` funciona.

---

# Resumen para soporte

Si necesitás pedir ayuda, enviá esta información:

1. Captura de:

```powershell
docker compose ps
```

1. Logs del backend:

```powershell
docker compose logs be --tail=100
```

1. Logs del frontend:

```powershell
docker compose logs fe --tail=100
```

1. Mensaje exacto del error que aparece en pantalla.
