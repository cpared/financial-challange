# Cocos API Workspace

Frontend React para consultar y probar la API REST existente. La aplicación no
simula respuestas: todas las consultas y mutaciones del runtime van al backend
configurado por `VITE_API_BASE_URL`.

## Requisitos

- Node.js 24 o compatible con Vite 8.
- Backend NestJS iniciado en `http://localhost:3000`.

## Iniciar cada aplicación

Terminal 1, backend:

```bash
cd backend
npm install
npm run db:generate
npm run start:dev
```

Terminal 2, frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abrir `http://localhost:5173`. El origen local del frontend está permitido por
CORS en el backend; no se modificaron sus rutas ni contratos HTTP. La app inicia
con la cuenta 2, que responde correctamente con el seed actual; el campo
“Cuenta API” permite cambiar el `userId` usado por las rutas, ya que el backend
no implementa autenticación. La cuenta 1 tiene movimientos inconsistentes y el
backend puede responder 500 para ella.

## Funcionalidad y límites de la API

- **Portfolio:** consulta `GET /api/v1/users/:userId/portfolio`, con saldos,
  posiciones y rendimientos. El contrato no entrega el precio unitario, por lo
  que se informa esa limitación en vez de calcularlo localmente.
- **Instrumentos:** consulta `GET /api/v1/instruments?query=...` por ticker o
  nombre. No hay un endpoint de detalle ni de cotización.
- **Órdenes:** envía `POST /api/v1/users/:userId/orders` con los campos
  definidos por el backend y permite
  `PATCH /api/v1/users/:userId/orders/:orderId/cancel`.
- Una orden ejecutada muestra confirmación de compra/venta exitosa y redirige
  al portfolio actualizado; una LIMIT `NEW` se confirma como pendiente y una
  `REJECTED` se identifica como rechazada sin presentarla como exitosa.
- El backend no ofrece un endpoint para consultar el historial o filtrar
  órdenes. La pantalla solo muestra las respuestas de órdenes creadas durante
  la sesión actual, y permite cancelar esas órdenes NEW o ingresar manualmente
  el ID de otra orden.
- No existen endpoints de depósito ni retiro.
- El seed actual de user 1 tiene una posición negativa para el instrumento 31;
  el backend devuelve 500 para esa cuenta hasta que sus movimientos sean
  corregidos. La UI presenta ese error real. User 2 se usa como cuenta vacía de
  prueba según el seed actual.

## Calidad y pruebas

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Las pruebas unitarias usan mocks de API exclusivamente en el entorno de tests.
La prueba Playwright `npm run test:e2e` consulta el backend real en
`http://localhost:3000` y requiere que exista el instrumento BBAR del seed.
También valida las rutas de creación y cancelación de órdenes con un usuario
inexistente, para comprobar el recorrido real del backend sin persistir
operaciones de prueba. Playwright puede requerir una instalación inicial del
navegador:

```bash
npx playwright install chromium
```
