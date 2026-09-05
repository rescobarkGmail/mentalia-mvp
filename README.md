# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Variables de entorno y ambientes

Este proyecto usa variables `VITE_*` para configurar el front por ambiente.

Archivos y uso esperado:

- `/.env.local`: desarrollo local diario.
- `/.env.qa.local`: pruebas de QA locales con `npm run dev:qa`.
- Variables de Vercel:
  - Preview: entorno QA o preproducción.
  - Production: entorno productivo.

Variables requeridas:

- `VITE_APP_ENV`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CLIENT_ID`

Plantilla base:

- `/.env.example`

Notas operativas:

- No commitear secretos reales al repositorio.
- Mantener separadas las credenciales de DEV, QA y PROD.
- Si falta alguna variable, la app detiene el arranque con un error explícito.
