# Backend challenge

API REST desarrollada con NestJS, TypeScript, PostgreSQL y Prisma para el enunciado `backend-challenge.md`.

## Requisitos

- Node.js 24.15 o superior (validado con 24.18.1).
- PostgreSQL compatible con el esquema de `../database.sql`.

## Configuración

1. Instalar dependencias y configurar el entorno:

   ```bash
   npm install
   cp .env.example .env
   ```

2. Crear la base de datos configurada en `DATABASE_URL` e importar el esquema y los datos de ejemplo:

   ```bash
   psql "postgresql://postgres:postgres@localhost:5432/cocos_challenge" -f ../database.sql
   ```

3. Generar el cliente de Prisma:

   ```bash
   npm run db:generate
   ```

4. Iniciar la API:

   ```bash
   npm run start:dev
   ```

La API escucha en `PORT` (por defecto `3000`) y todos los endpoints usan el prefijo `/api/v1`.
La configuración valida `DATABASE_URL` y `PORT` al iniciar.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/users/:userId/portfolio` | Efectivo, valor total y posiciones del usuario |
| `GET` | `/api/v1/instruments?query=...` | Búsqueda parcial case-insensitive por ticker y nombre |
| `POST` | `/api/v1/users/:userId/orders` | Enviar una orden MARKET o LIMIT |
| `PATCH` | `/api/v1/users/:userId/orders/:orderId/cancel` | Cancelar una orden NEW |

Los ejemplos de éxito y error se mantienen junto a cada feature en `src/modules/*/requests/request.http`.

### Crear una orden

El body acepta exactamente uno de `quantity` (acciones enteras) o `amountArs` (monto máximo en pesos). `LIMIT` requiere `price`; `MARKET` usa el último `close` y, si el body incluye `price`, lo ignora. El monto se convierte a la cantidad máxima de acciones enteras usando el precio límite o el `close`, según corresponda.

Una orden que supera el efectivo o las acciones disponibles se guarda con estado `REJECTED` y responde `201 Created`. Una orden MARKET aceptada se guarda como `FILLED`; una LIMIT aceptada como `NEW`.

## Criterios funcionales acordados

- El efectivo parte de los movimientos `CASH_IN`/`CASH_OUT` FILLED y se ajusta por el importe de compras y ventas FILLED.
- Las órdenes BUY LIMIT en estado NEW reservan efectivo; las SELL LIMIT NEW reservan acciones hasta cancelarse. Las reservas reducen la disponibilidad, pero no alteran las posiciones FILLED ni el valor total de la cuenta.
- El valor total de cuenta es el efectivo neto de movimientos FILLED más el valor de mercado de las posiciones FILLED. El efectivo disponible sí descuenta las reservas de compras NEW.
- La cantidad y el valor de cada posición se calculan con órdenes BUY/SELL FILLED y el `close` más reciente. `dailyReturnPercent` usa `(close - previousClose) / previousClose * 100`.
- Si un monto no alcanza para una acción entera, la API responde `400` y no crea una orden.
- Solo se cancelan órdenes NEW. Los identificadores de usuario se envían en la ruta; no se implementa autenticación.
- El modelo Prisma refleja el esquema SQL existente, incluida la columna `marketdata.date`. No se modificó `database.sql`.

## Pruebas y validación

```bash
npm test
npm run test:e2e
npm run build
npm run typecheck
npm run lint
```

Las pruebas unitarias no requieren una base de datos. La prueba e2e ejercita el endpoint HTTP de creación de órdenes con la capa de persistencia simulada.
