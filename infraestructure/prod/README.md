# Infraestructura de producción

Esta carpeta queda reservada para despliegues productivos separados de desarrollo.

## Reglas mínimas

- NO reutilizar `.env` ni credenciales de `infraestructure/dev/`
- NO usar el usuario inicial `root-admin` ni passwords default en ambientes reales
- definir secretos, networking, storage y observabilidad específicos de producción
- versionar manifests/compose/helm/terraform productivos por separado cuando se diseñen

Por ahora se deja como placeholder intencional para evitar mezclar decisiones de dev con producción.
