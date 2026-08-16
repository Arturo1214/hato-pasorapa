# Preparar Windows para desarrollar Pasorapa Hato sin Docker

Esta guía explica cómo preparar una computadora Windows para abrir, compilar y ejecutar el backend y el frontend desde IDEs, **sin Docker** y **sin compilación nativa**.

Está pensada para una persona con poca experiencia técnica. Seguí los pasos en orden y no saltes verificaciones.

Equipo objetivo:

```txt
Sistema: Windows 10/11 64-bit
RAM: 8 GB
Procesador: AMD A6-9225 Radeon R4
```

> Importante: esta guía es para desarrollo/local. Para distribución final o instalación simple con imágenes Docker existe otro manual.

---

## Qué se va a instalar

| Herramienta | Para qué sirve | Recomendación |
|---|---|---|
| Git | Descargar el código | Obligatorio |
| Java 21 | Ejecutar backend Quarkus | Obligatorio |
| PostgreSQL 16 | Base de datos local | Obligatorio |
| IntelliJ IDEA Community | Abrir backend | Recomendado |
| Node.js 20.19.6 | Ejecutar frontend Angular | Obligatorio |
| Visual Studio Code | Abrir frontend | Recomendado |

URLs finales esperadas:

| Servicio | URL |
|---|---|
| Backend Quarkus | `http://localhost:8080` |
| Health backend | `http://localhost:8080/q/health` |
| Swagger backend | `http://localhost:8080/q/swagger-ui` |
| Frontend Angular | `http://localhost:4200` |
| PostgreSQL | `localhost:5434` |

Usuario inicial del sistema:

```txt
Usuario: root-admin
Contraseña: RootAdmin9
```

---

# Parte 1 — Crear carpeta de trabajo

## 1. Crear carpeta principal

Abrí el Explorador de archivos y creá:

```txt
C:\pasorapa
```

Ahí se descargará el proyecto.

---

# Parte 2 — Instalar Git

## 2. Descargar Git

Abrí este enlace:

```txt
https://git-scm.com/download/win
```

Se descargará Git para Windows.

## 3. Instalar Git

1. Abrí el instalador.
2. En casi todas las pantallas podés dejar la opción por defecto.
3. Cuando pregunte por el editor, podés dejar **Vim** o elegir **Notepad** si aparece.
4. Terminá con **Install**.

## 4. Verificar Git

Abrí PowerShell:

1. Presioná `Windows + R`.
2. Escribí `powershell`.
3. Presioná Enter.

Ejecutá:

```powershell
git --version
```

Debe mostrar algo parecido a:

```txt
git version 2.x.x
```

---

# Parte 3 — Descargar el proyecto

## 5. Clonar repositorio

En PowerShell:

```powershell
cd C:\pasorapa
git clone https://github.com/Arturo1214/hato-pasorapa.git
cd hato-pasorapa\code
```

Verificá que existan estas carpetas:

```txt
hato-be
hato-fe
infraestructure
```

Si existen, el código se descargó correctamente.

---

# Parte 4 — Instalar Java 21

El backend usa **Quarkus 3.34.x** y necesita **Java 21**. Java 8, 11 o 17 NO alcanzan para este proyecto.

## 6. Descargar Java 21 Temurin

Abrí:

```txt
https://adoptium.net/temurin/releases/?version=21
```

Seleccioná:

```txt
Operating System: Windows
Architecture: x64
Package Type: JDK
Version: 21
```

Descargá el instalador `.msi`.

## 7. Instalar Java 21

1. Abrí el `.msi` descargado.
2. Continuá con **Next**.
3. Si aparece una opción para configurar `JAVA_HOME`, activala.
4. Terminá con **Install**.
5. Cerrá y volvé a abrir PowerShell.

## 8. Verificar Java

En PowerShell:

```powershell
java -version
```

Debe mostrar Java 21, por ejemplo:

```txt
openjdk version "21.x.x"
```

También verificá:

```powershell
javac -version
```

Debe mostrar:

```txt
javac 21.x.x
```

Si no aparece Java 21, reiniciá Windows y volvé a probar.

---

# Parte 5 — Instalar PostgreSQL

El backend necesita una base PostgreSQL local.

## 9. Descargar PostgreSQL

Abrí:

```txt
https://www.postgresql.org/download/windows/
```

Entrá a **Download the installer**. Normalmente te lleva a EnterpriseDB.

También podés abrir directamente:

```txt
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
```

Descargá PostgreSQL 16 para Windows x86-64.

## 10. Instalar PostgreSQL

Abrí el instalador.

Usá estas opciones:

| Pantalla | Qué elegir |
|---|---|
| Installation Directory | Dejar por defecto |
| Select Components | Dejar todo marcado, incluyendo pgAdmin |
| Data Directory | Dejar por defecto |
| Password | `postgres` |
| Port | `5434` |
| Locale | Dejar por defecto |

> Usamos puerto `5434` porque el backend ya viene configurado para buscar PostgreSQL en `localhost:5434`.

Terminá la instalación.

## 11. Abrir pgAdmin

1. Buscá **pgAdmin 4** en el menú inicio.
2. Abrilo.
3. La primera vez puede pedir una contraseña maestra. Podés usar una que recuerdes.
4. En el panel izquierdo abrí:

```txt
Servers → PostgreSQL 16
```

Si pide contraseña, usá:

```txt
postgres
```

## 12. Crear base de datos `hato`

En pgAdmin:

1. Click derecho sobre **Databases**.
2. Elegí **Create → Database...**.
3. En **Database** escribí:

```txt
hato
```

1. En **Owner** dejá:

```txt
postgres
```

1. Click en **Save**.

La base `hato` debe aparecer en la lista.

---

# Parte 6 — Instalar IntelliJ IDEA para backend

## 13. Descargar IntelliJ IDEA Community

Abrí:

```txt
https://www.jetbrains.com/idea/download/?section=windows
```

Descargá:

```txt
IntelliJ IDEA Community Edition
```

> Recomendación: Community es gratis y suficiente para abrir el backend como proyecto Maven/Java. IntelliJ Ultimate tiene más ayudas empresariales, pero no es necesaria para esta fase.

## 14. Instalar IntelliJ

1. Abrí el instalador.
2. Continuá con **Next**.
3. Si aparece opción para crear acceso directo, marcala.
4. Si aparece opción `Add launchers dir to PATH`, podés marcarla.
5. Terminá la instalación.

---

# Parte 7 — Abrir backend en IntelliJ

## 15. Abrir proyecto backend

1. Abrí IntelliJ IDEA.
2. Elegí **Open**.
3. Buscá esta carpeta:

```txt
C:\pasorapa\hato-pasorapa\code\hato-be
```

1. Click en **OK**.
2. Si pregunta si confiás en el proyecto, elegí **Trust Project**.

## 16. Configurar JDK en IntelliJ

En IntelliJ:

1. Entrá a **File → Project Structure**.
2. En **Project SDK**, elegí Java 21.
3. Si no aparece, hacé click en **Add SDK → JDK**.
4. Buscá una carpeta parecida a:

```txt
C:\Program Files\Eclipse Adoptium\jdk-21...
```

1. Aplicá cambios con **Apply → OK**.

## 17. Esperar indexación

IntelliJ va a descargar dependencias Maven y analizar el proyecto.

Esperá hasta que abajo deje de decir:

```txt
Indexing...
```

Esto puede tardar varios minutos.

---

# Parte 8 — Ejecutar backend sin native

## 18. Abrir terminal de IntelliJ

En IntelliJ, abajo buscá la pestaña:

```txt
Terminal
```

Verificá que estés en la carpeta `hato-be`.

Si no, ejecutá:

```powershell
cd C:\pasorapa\hato-pasorapa\code\hato-be
```

## 19. Ejecutar backend Quarkus dev

Ejecutá:

```powershell
.\mvnw.cmd quarkus:dev
```

La primera vez Maven descargará muchas dependencias. Es normal que tarde.

Cuando esté listo, deberías ver algo parecido a:

```txt
Listening on: http://localhost:8080
Profile dev activated
```

## 20. Verificar backend

Abrí en el navegador:

```txt
http://localhost:8080/q/health
```

Debe devolver estado `UP`.

También abrí:

```txt
http://localhost:8080/q/swagger-ui
```

Si aparece Swagger, el backend está funcionando.

## 21. Qué hace Liquibase

La primera vez que el backend arranca, Liquibase crea las tablas y datos iniciales en PostgreSQL.

Debe crear, entre otros datos, el usuario:

```txt
root-admin / RootAdmin9
```

---

# Parte 9 — Instalar Node.js para frontend

El frontend usa Angular 21 y necesita Node moderno. El proyecto indica Node:

```txt
20.19.6
```

## 22. Descargar Node.js

Opción simple recomendada:

```txt
https://nodejs.org/en/download
```

Descargá Node.js 20 LTS para Windows.

Si querés instalar exactamente `20.19.6`, usá nvm-windows:

```txt
https://github.com/coreybutler/nvm-windows/releases
```

Para una persona sin experiencia, la opción simple con Node 20 LTS alcanza siempre que sea versión 20.19.x o superior.

## 23. Instalar Node.js

1. Abrí el instalador.
2. Dejá opciones por defecto.
3. Terminá con **Install**.
4. Cerrá y volvé a abrir PowerShell.

## 24. Verificar Node y npm

En PowerShell:

```powershell
node -v
npm -v
```

Node debe mostrar algo parecido a:

```txt
v20.19.x
```

Si muestra una versión menor a 20.19, instalá una versión más nueva de Node 20.

---

# Parte 10 — Instalar Visual Studio Code para frontend

## 25. Descargar VS Code

Abrí:

```txt
https://code.visualstudio.com/download
```

Descargá la versión para Windows.

## 26. Instalar VS Code

1. Abrí el instalador.
2. Marcá estas opciones si aparecen:

```txt
Add to PATH
Add "Open with Code" action
```

1. Terminá la instalación.

## 27. Instalar extensiones recomendadas

Abrí VS Code.

Entrá a **Extensions** y buscá/instalá:

| Extensión | Para qué sirve |
|---|---|
| Angular Language Service | Ayuda con Angular/templates |
| ESLint | Ayuda con errores de código |
| Prettier - Code formatter | Formato de código |
| GitLens | Ayuda visual para Git |

---

# Parte 11 — Abrir frontend en VS Code

## 28. Abrir carpeta frontend

En VS Code:

1. **File → Open Folder**.
2. Elegí:

```txt
C:\pasorapa\hato-pasorapa\code\hato-fe
```

1. Click en **Select Folder**.

---

# Parte 12 — Crear proxy local del frontend

El frontend usa `/api`, pero cuando se ejecuta con Angular en `localhost:4200`, necesita redirigir `/api` hacia el backend en `localhost:8080`.

Para eso se crea un archivo local de proxy.

## 29. Crear archivo `proxy.conf.json`

En VS Code:

1. Click derecho sobre la raíz de `hato-fe`.
2. Elegí **New File**.
3. Nombre:

```txt
proxy.conf.json
```

1. Pegá este contenido:

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  },
  "/q": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  }
}
```

1. Guardá el archivo.

> Este archivo es solo para desarrollo local en Windows. No es necesario para Docker.

---

# Parte 13 — Instalar dependencias frontend

## 30. Abrir terminal en VS Code

En VS Code:

```txt
Terminal → New Terminal
```

Debe abrirse en:

```txt
C:\pasorapa\hato-pasorapa\code\hato-fe
```

Si no, ejecutá:

```powershell
cd C:\pasorapa\hato-pasorapa\code\hato-fe
```

## 31. Instalar dependencias

Ejecutá:

```powershell
npm install
```

Puede tardar varios minutos.

Si muestra warnings de auditoría, no te detengas por eso en esta fase. Lo importante es que termine sin error fatal.

---

# Parte 14 — Ejecutar frontend

## 32. Confirmar que backend esté encendido

Antes del frontend, el backend debe estar corriendo en IntelliJ con:

```powershell
.\mvnw.cmd quarkus:dev
```

Verificá:

```txt
http://localhost:8080/q/health
```

## 33. Ejecutar Angular con proxy

En la terminal de VS Code, dentro de `hato-fe`, ejecutá:

```powershell
npm start -- --proxy-config proxy.conf.json
```

Cuando compile, debería mostrar algo parecido a:

```txt
Local: http://localhost:4200
```

Abrí:

```txt
http://localhost:4200
```

Login:

```txt
Usuario: root-admin
Contraseña: RootAdmin9
```

---

# Parte 15 — Orden correcto para encender todo

Cada vez que quieras trabajar:

## 34. Encender PostgreSQL

PostgreSQL normalmente se inicia solo con Windows.

Para verificar:

1. Abrí pgAdmin.
2. Confirmá que podés entrar al servidor PostgreSQL.

## 35. Encender backend

En IntelliJ, terminal de `hato-be`:

```powershell
.\mvnw.cmd quarkus:dev
```

Esperá hasta ver que escucha en `localhost:8080`.

## 36. Encender frontend

En VS Code, terminal de `hato-fe`:

```powershell
npm start -- --proxy-config proxy.conf.json
```

Abrí:

```txt
http://localhost:4200
```

---

# Parte 16 — Apagar todo

## 37. Apagar frontend

En la terminal de VS Code donde corre Angular:

```txt
Ctrl + C
```

Si pregunta:

```txt
Terminate batch job (Y/N)?
```

Escribí:

```txt
Y
```

## 38. Apagar backend

En la terminal de IntelliJ donde corre Quarkus:

```txt
Ctrl + C
```

Si pregunta, respondé `Y`.

PostgreSQL puede quedar encendido como servicio de Windows.

---

# Parte 17 — Comandos útiles

## Backend

Desde `hato-be`:

```powershell
.\mvnw.cmd quarkus:dev
.\mvnw.cmd test
.\mvnw.cmd -DskipTests compile
```

## Frontend

Desde `hato-fe`:

```powershell
npm install
npm start -- --proxy-config proxy.conf.json
npm test
```

---

# Parte 18 — Problemas comunes

## `java` no se reconoce

Cerrá y abrí PowerShell.

Si sigue igual:

1. Reiniciá Windows.
2. Verificá que Java 21 esté instalado.
3. En IntelliJ configurá Project SDK manualmente.

---

## Backend dice que no puede conectarse a PostgreSQL

Revisá:

1. PostgreSQL está instalado.
2. Puerto usado durante instalación fue `5434`.
3. Password del usuario `postgres` es `postgres`.
4. Existe la base `hato`.

En pgAdmin confirmá que la base aparece como:

```txt
Databases → hato
```

---

## Me equivoqué y PostgreSQL quedó en puerto 5432

No pasa nada, pero tenés que arrancar backend con variable `DB_URL`.

En IntelliJ podés configurar environment variables o ejecutar desde PowerShell:

```powershell
$env:DB_URL="jdbc:postgresql://localhost:5432/hato"
$env:DB_USER="postgres"
$env:DB_PASS="postgres"
.\mvnw.cmd quarkus:dev
```

---

## Frontend abre pero login falla

Casi siempre es porque:

- backend no está encendido;
- frontend se arrancó sin proxy;
- `proxy.conf.json` está mal escrito.

Confirmá que usaste:

```powershell
npm start -- --proxy-config proxy.conf.json
```

Y que backend responde:

```txt
http://localhost:8080/q/health
```

---

## `npm install` falla

Probá:

```powershell
node -v
npm -v
```

Node debe ser 20.19.x o superior.

Si el error sigue, borrar instalación local y reinstalar:

```powershell
cd C:\pasorapa\hato-pasorapa\code\hato-fe
rmdir /s /q node_modules
del package-lock.json
npm install
```

> Ojo: si borrás `package-lock.json`, luego Git lo verá como cambiado. Para un usuario no técnico, pedí ayuda antes de commitear cambios.

---

## La computadora está lenta

Con 8 GB RAM es normal que se sienta ajustada.

Recomendaciones:

- Abrir solo IntelliJ o VS Code si es posible, no muchas apps.
- Cerrar pestañas de navegador innecesarias.
- No correr tests completos mientras se usa la app.
- No intentar compilación native.
- No levantar Docker al mismo tiempo que el entorno de IDE.

---

# Parte 19 — Qué NO hacer en esta fase

No hacer todavía:

```powershell
.\mvnw.cmd -Dnative package
```

No hacer compilación nativa de Quarkus en esta máquina. Es pesada y no es necesaria para desarrollo local.

Tampoco hace falta Docker en esta fase.

---

# Checklist final

Marcá cada punto:

- [ ] Git instalado.
- [ ] Proyecto clonado en `C:\pasorapa\hato-pasorapa\code`.
- [ ] Java 21 instalado y verificado.
- [ ] PostgreSQL 16 instalado.
- [ ] PostgreSQL configurado en puerto `5434`.
- [ ] Base `hato` creada.
- [ ] IntelliJ IDEA Community instalado.
- [ ] Backend abierto desde `hato-be`.
- [ ] Backend corre con `.\mvnw.cmd quarkus:dev`.
- [ ] `http://localhost:8080/q/health` responde.
- [ ] Node.js 20.19.x o superior instalado.
- [ ] VS Code instalado.
- [ ] Frontend abierto desde `hato-fe`.
- [ ] `proxy.conf.json` creado.
- [ ] `npm install` ejecutado.
- [ ] Frontend corre con `npm start -- --proxy-config proxy.conf.json`.
- [ ] `http://localhost:4200` abre.
- [ ] Login `root-admin` / `RootAdmin9` funciona.

---

# Información para pedir soporte

Si algo falla, copiá y enviá:

## Backend

```powershell
java -version
cd C:\pasorapa\hato-pasorapa\code\hato-be
.\mvnw.cmd quarkus:dev
```

Mandá captura del error.

## Frontend

```powershell
node -v
npm -v
cd C:\pasorapa\hato-pasorapa\code\hato-fe
npm start -- --proxy-config proxy.conf.json
```

Mandá captura del error.

## Base de datos

Mandá captura de pgAdmin donde se vea:

```txt
Servers → PostgreSQL 16 → Databases → hato
```
