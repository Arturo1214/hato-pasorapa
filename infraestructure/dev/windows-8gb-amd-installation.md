# Levantar Pasorapa Hato en Windows con 8 GB RAM y AMD A6-9225

Esta guía explica cómo preparar una máquina Windows limitada —8 GB de RAM y procesador AMD A6-9225 Radeon R4— para levantar el proyecto completo: frontend Angular, backend Quarkus y PostgreSQL.

> Recomendación principal: usar **WSL2 + Docker Desktop**. No intentes levantar todo directamente en Windows con Java/Maven/Node/PostgreSQL instalados a mano; en esta máquina vas a perder tiempo con diferencias de entorno.

## Resultado esperado

Al terminar, deberías poder abrir:

| Servicio | URL |
|---|---|
| Aplicación web | `http://localhost:8080` |
| Backend directo | `http://localhost:8081` |
| Health backend | `http://localhost:8081/q/health` |
| Swagger | `http://localhost:8080/q/swagger-ui` |
| PostgreSQL dev | `localhost:5434` |

Credencial inicial de desarrollo:

```txt
Usuario: root-admin
Contraseña: RootAdmin9
```

---

## 1. Verificar requisitos mínimos

### Hardware

- RAM: 8 GB mínimo.
- Procesador: AMD A6-9225 Radeon R4.
- Disco: preferible SSD. Con disco mecánico va a ser MUY lento.
- Espacio libre recomendado: 30 GB.

### Windows

Recomendado:

- Windows 10 64-bit versión 2004 o superior, o Windows 11.
- WSL2 disponible.
- Virtualización activada en BIOS/UEFI.

Para verificar versión de Windows:

```powershell
winver
```

Para verificar virtualización:

1. Abrí **Administrador de tareas**.
2. Pestaña **Rendimiento**.
3. CPU.
4. Revisá que diga: `Virtualización: Habilitada`.

Si dice `Deshabilitada`, entrá al BIOS/UEFI y activá una opción similar a:

- `SVM Mode`
- `AMD-V`
- `Virtualization Technology`

Sin virtualización, Docker/WSL2 no va a levantar correctamente.

---

## 2. Instalar WSL2

Abrí PowerShell como administrador y ejecutá:

```powershell
wsl --install
```

Reiniciá Windows cuando lo pida.

Después verificá:

```powershell
wsl --status
```

Debe mostrar WSL2 como versión predeterminada. Si no:

```powershell
wsl --set-default-version 2
```

Instalá Ubuntu si no quedó instalado automáticamente:

```powershell
wsl --install -d Ubuntu
```

Abrí Ubuntu desde el menú inicio y creá tu usuario Linux.

---

## 3. Limitar WSL2 para una máquina de 8 GB

En Windows, creá este archivo:

```txt
C:\Users\TU_USUARIO\.wslconfig
```

Contenido recomendado:

```ini
[wsl2]
memory=6GB
processors=4
swap=6GB
localhostForwarding=true
```

Luego reiniciá WSL:

```powershell
wsl --shutdown
```

> No le des los 8 GB completos a WSL. Windows también necesita memoria para seguir vivo.

---

## 4. Instalar Docker Desktop

1. Descargá Docker Desktop: `https://www.docker.com/products/docker-desktop/`
2. Instalalo con backend WSL2.
3. Abrí Docker Desktop.
4. Andá a **Settings → Resources → WSL Integration**.
5. Activá integración con Ubuntu.
6. Aplicá cambios.

Verificá desde Ubuntu:

```bash
docker --version
docker compose version
```

Si esos comandos funcionan, Docker está listo.

---

## 5. Preparar herramientas dentro de Ubuntu

En Ubuntu/WSL:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
```

Opcional, pero útil:

```bash
sudo apt install -y nano htop unzip
```

---

## 6. Clonar el proyecto dentro de WSL

IMPORTANTE: cloná el repo dentro del filesystem Linux, no dentro de `C:\`.

Bien:

```bash
mkdir -p ~/proyectos
cd ~/proyectos
git clone <URL_DEL_REPO> pasorapa-hato
cd pasorapa-hato/code
```

Evitá esto:

```bash
cd /mnt/c/Users/...
```

¿Por qué? Porque Docker + Node + Maven trabajan mucho más lento sobre `/mnt/c`.

---

## 7. Crear configuración de desarrollo

Desde la raíz del repo `code`:

```bash
cp infraestructure/dev/.env.example infraestructure/dev/.env 2>/dev/null || true
```

Si el archivo `.env.example` no existe en esa carpeta, podés dejar que el script cree el `.env` automáticamente en el siguiente paso.

Asegurate de que el script tenga permisos:

```bash
chmod +x infraestructure/dev/start.sh
```

---

## 8. Levantar todo el proyecto

Desde la raíz del repo:

```bash
./infraestructure/dev/start.sh up
```

Este comando levanta:

- PostgreSQL
- Backend Quarkus
- Frontend Angular servido por nginx

La primera vez puede tardar bastante porque Docker tiene que descargar imágenes y compilar.

En esta máquina, esperá algo como:

- frontend: varios minutos
- backend native: puede tardar mucho más

---

## 9. Verificar que todo esté corriendo

```bash
./infraestructure/dev/start.sh ps
```

También podés verificar con Docker:

```bash
docker ps
```

Health backend:

```bash
curl http://localhost:8081/q/health
```

Debe devolver algo parecido a:

```json
{"status":"UP"}
```

Abrí en el navegador:

```txt
http://localhost:8080
```

Login:

```txt
root-admin
RootAdmin9
```

---

## 10. Ver logs si algo falla

Logs de todos los servicios:

```bash
./infraestructure/dev/start.sh logs
```

Logs solo backend:

```bash
docker compose --env-file infraestructure/dev/.env -f infraestructure/dev/docker-compose.yml logs -f be
```

Logs solo frontend:

```bash
docker compose --env-file infraestructure/dev/.env -f infraestructure/dev/docker-compose.yml logs -f fe
```

Logs solo base de datos:

```bash
docker compose --env-file infraestructure/dev/.env -f infraestructure/dev/docker-compose.yml logs -f db
```

---

## 11. Problema esperado en esta máquina: build native del backend

El backend actual se construye como Quarkus native dentro de Docker. Eso es bueno para validar un binario cercano a producción, pero en una PC con 8 GB RAM y AMD A6-9225 puede fallar por memoria o tardar demasiado.

Síntomas típicos:

- Docker se queda sin memoria.
- El build del backend se corta.
- La PC queda muy lenta.
- Aparecen errores durante `native-image` o `mandrel`.

### Qué hacer si pasa

Primero intentá cerrar todo lo pesado:

- navegadores con muchas pestañas
- IDEs
- programas de sincronización
- apps de videollamada

Luego reintentá:

```bash
./infraestructure/dev/start.sh up
```

Si sigue fallando, hay dos caminos razonables:

| Opción | Cuándo usarla |
|---|---|
| Usar una imagen backend ya construida | Si otra máquina o CI puede compilar el backend native. |
| Agregar modo backend JVM para desarrollo | Si esta PC va a ser usada habitualmente para desarrollo/local. |

Para esta máquina, lo más sano es tener un **modo JVM de desarrollo** y reservar native para CI o una máquina más fuerte.

---

## 12. Limpiar y reconstruir

Si cambió código y necesitás reconstruir:

```bash
./infraestructure/dev/start.sh up
```

Si sospechás cache vieja:

```bash
docker compose --env-file infraestructure/dev/.env -f infraestructure/dev/docker-compose.yml build --no-cache be fe
./infraestructure/dev/start.sh up
```

En 8 GB esto puede tardar mucho. Usalo solo cuando realmente haga falta.

---

## 13. Reiniciar base de datos de desarrollo

⚠️ Esto borra todos los datos locales de PostgreSQL dev.

```bash
./infraestructure/dev/start.sh reset-db
```

Modo no interactivo:

```bash
CONFIRM_RESET=yes ./infraestructure/dev/start.sh reset-db
```

Luego:

```bash
./infraestructure/dev/start.sh up
```

---

## 14. Apagar el proyecto

```bash
./infraestructure/dev/start.sh down
```

Si también querés liberar memoria de WSL:

```powershell
wsl --shutdown
```

---

## 15. Acceder desde otro equipo en la misma red

En Windows, obtené la IP:

```powershell
ipconfig
```

Buscá la IPv4 de tu red, por ejemplo:

```txt
192.168.1.50
```

Desde otro equipo abrí:

```txt
http://192.168.1.50:8080
```

Si no carga, revisá Firewall de Windows y permití entrada al puerto `8080`.

---

## 16. Checklist rápido

Antes de pedir soporte, confirmá:

- [ ] Virtualización activada en BIOS/UEFI.
- [ ] WSL2 instalado.
- [ ] Docker Desktop abierto.
- [ ] Docker integrado con Ubuntu.
- [ ] Repo clonado dentro de WSL, no en `/mnt/c`.
- [ ] `.wslconfig` creado con máximo 6 GB para WSL.
- [ ] `docker ps` funciona desde Ubuntu.
- [ ] `./infraestructure/dev/start.sh ps` muestra servicios activos.
- [ ] `http://localhost:8081/q/health` responde.
- [ ] `http://localhost:8080` abre la app.

---

## 17. Recomendación final para AMD A6-9225 + 8 GB

Esta máquina puede servir para levantar el sistema, demos livianas o validaciones funcionales, pero no es buena para compilar Quarkus native repetidamente.

Para trabajar cómodo:

1. Usá Docker + WSL2.
2. Cerrá apps pesadas antes de construir.
3. Evitá `--no-cache` salvo que sea necesario.
4. Si el backend native falla o tarda demasiado, prepará un modo backend JVM para desarrollo.
5. Dejá native para CI o una máquina más potente.
