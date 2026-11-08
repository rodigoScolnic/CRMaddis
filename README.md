# CRMaddis

CRM liviano para administrar clientes, tareas y fechas de entrega. Stack: Node.js, Express y PostgreSQL; frontend responsive en HTML/CSS/JavaScript.

## Funcionalidades
- Panel con métricas, tareas pendientes, vencidas y próximas entregas.
- Clientes: alta, edición, búsqueda y eliminación protegida ante tareas vinculadas.
- Tareas: alta, edición, asignación a cliente, prioridad, estado, vencimiento y marcado rápido como completada.
- Autenticación con JWT y contraseñas hasheadas con bcrypt.
- API REST validada y persistencia PostgreSQL.

## Requisitos
Node.js 20+ y PostgreSQL 14+.

## Configuración
1. Copiar `.env.example` a `.env` y completar `DATABASE_URL`, `JWT_SECRET` y `SETUP_TOKEN`.
2. Ejecutar `npm install`.
3. Crear la base PostgreSQL y ejecutar `npm run db:init`.
4. Ejecutar `npm run dev`.
5. Abrir http://localhost:3000. En la primera ejecución, crear el usuario administrador desde la pantalla de configuración inicial usando el `SETUP_TOKEN`.

## API
- `POST /api/auth/setup` (solo si todavía no hay usuarios)
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST|PUT|DELETE /api/clients`
- `GET|POST|PUT|PATCH|DELETE /api/tasks`
- `GET /api/dashboard`

Todas las rutas salvo health y autenticación requieren Bearer JWT.

## Deploy en Render
Crear un Web Service desde este repositorio y una instancia PostgreSQL. Configurar `DATABASE_URL` con la Internal Database URL, `JWT_SECRET` y `SETUP_TOKEN`. Build: `npm install`; Start: `npm start`. El servidor ejecuta migraciones idempotentes al iniciar.

## Seguridad
No subir el archivo `.env`. Usar secretos largos y únicos. El endpoint de configuración inicial se deshabilita automáticamente cuando ya existe un usuario.
