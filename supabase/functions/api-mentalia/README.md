# API/BFF de Mentalia

Endpoint base: `/functions/v1/api-mentalia/v1`.

Los endpoints protegidos reciben `Authorization: Bearer <supabase_access_token>`.

Contrato inicial:

- `GET /v1/health`: comprobación pública.
- `GET /v1/me`: usuario autenticado y perfil mínimo.

Las respuestas usan `{ data, error, request_id }`. Las reglas de negocio se incorporarán por módulos antes de migrar cada pantalla.
