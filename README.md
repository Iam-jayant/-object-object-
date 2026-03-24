# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Multi-User Report Email Flow

The project includes a shared backend service for:
- storing manufacturer contact emails by wallet
- sending report notification emails to the correct manufacturer
- deduplicating repeated notifications by transaction hash

### Run frontend + backend

1. Install dependencies:

```bash
npm install
```

2. Configure `.env` values:
- `VITE_DIRECTORY_API_URL=http://localhost:8787/api`
- `VITE_NOTIFY_API_URL=http://localhost:8787/api`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

3. Start backend:

```bash
npm run dev:server
```

4. Start frontend (new terminal):

```bash
npm run dev
```

### API endpoints

- `PUT /api/manufacturers/:wallet`
- `GET /api/manufacturers/:wallet`
- `POST /api/reports/notify`
- `GET /api/health`
