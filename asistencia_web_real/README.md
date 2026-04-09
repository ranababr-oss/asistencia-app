# Asistencia Web Real

Esta es una versión web real de tu app de asistencia.

## Qué hace
- Lista fija de jóvenes
- Presente / Ausente / Limpiar por fecha
- Institución
- Nombre del maestro al marcar
- Historial por día
- Varios maestros pueden usar el mismo registro si todos entran a la misma URL

## Cómo probarla en tu computadora
1. Instala Node.js
2. Abre esta carpeta en terminal
3. Ejecuta:
   npm install
   npm start
4. Abre:
   http://localhost:3000

## Cómo publicarla
Necesitas subir esta carpeta a un hosting para Node.js.
Ejemplos comunes:
- Render
- Railway
- VPS / servidor propio
- Cualquier hosting que corra Node.js

## Importante sobre los datos
Esta app guarda los datos en `db.json`.

Eso significa:
- si la subes a un hosting con almacenamiento persistente, el historial se conserva
- si la subes a un hosting sin almacenamiento persistente, los datos pueden perderse al reiniciar

## Siguiente mejora recomendada
Para una versión todavía más profesional:
- login por maestro
- base de datos en internet (Postgres o similar)
- reportes en Excel / PDF
- permisos por usuario
- publicación como app móvil con wrapper nativo
