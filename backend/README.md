# Backend challenge

API REST desarrollada con NestJS, TypeScript, PostgreSQL y Prisma para el enunciado `backend-challenge.md`.

## Requisitos

- Node.js 24.15 o superior (validado con 24.18.1).
- Docker Engine con Docker Compose.

## Configuración

1. Levantar PostgreSQL desde `backend/`. Al crear el volumen por primera vez, Compose importa automáticamente `../database.sql` con el esquema y los datos de ejemplo:

   ```bash
   docker compose up -d db
   docker compose ps
   ```

   Esperá que el servicio `db` figure como `healthy`.

2. Instalar dependencias y configurar la conexión local:

   ```bash
   npm install
   cp .env.example .env
   npm run db:generate
   ```

   El `.env.example` usa los valores por defecto del servicio Compose y conecta el backend local a `localhost:5432`.

3. Iniciar la API:

   ```bash
   npm run start:dev
   ```

Para detener PostgreSQL sin borrar la base:

```bash
docker compose down
```

La importación del SQL de inicialización se ejecuta solo cuando el volumen está vacío. Para borrar los datos y volver a inicializar la base desde cero:

```bash
docker compose down -v
docker compose up -d db
```

Las credenciales por defecto del Compose son solo para desarrollo local; se pueden reemplazar mediante `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_PORT` en el entorno.

La API escucha en `PORT` (por defecto `3000`) y todos los endpoints usan el prefijo `/api/v1`.
La configuración valida `DATABASE_URL` y `PORT` al iniciar.

## Request context y tracing

Cada solicitud recibe un `X-Request-ID` validado o generado como UUID. El
identificador se devuelve en la respuesta y queda disponible en toda la cadena
asíncrona mediante `RequestContextService`. Los `traceparent` W3C válidos se
propagan; cuando OpenTelemetry está activo, la respuesta devuelve también el
`traceparent` del span HTTP. El ID de solicitud identifica una petición y el
trace ID puede abarcar varias operaciones distribuidas; no son intercambiables.

OpenTelemetry está desactivado por defecto y no requiere un collector para
iniciar el backend. Para habilitar exportación OTLP, configurar en `.env`:

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=backend-api
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Con `OTEL_ENABLED=true`, `OTEL_TRACES_EXPORTER=none` activa la propagación y
generación local de spans sin exportarlos. Se habilita la instrumentación HTTP
oficial y el middleware garantiza un span servidor si no hay uno activo; los
servicios y repositorios instrumentan los casos de uso y operaciones Prisma.
Prisma 6 utiliza su propio query engine, por lo que la instrumentación del
driver Node `pg` no observa estas consultas. Los spans de repositorio registran
operación y sistema de base de datos, no SQL, parámetros ni datos financieros.

Los logs se emiten como JSON e incluyen `requestId`, `traceId` y `spanId` cuando
están disponibles. El filtro global registra el tipo de error sin exponer
mensajes internos y mantiene el formato HTTP ya establecido. No hay autenticación
en esta API; por eso el contexto no asigna `userId`.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/ping` | Liveness check del proceso NestJS; no valida PostgreSQL ni dependencias externas |
| `GET` | `/api/v1/users/:userId/portfolio` | Efectivo, valor total y posiciones del usuario |
| `GET` | `/api/v1/instruments?query=...` | Búsqueda parcial case-insensitive por ticker y nombre |
| `POST` | `/api/v1/users/:userId/orders` | Enviar una orden MARKET o LIMIT |
| `PATCH` | `/api/v1/users/:userId/orders/:orderId/cancel` | Cancelar una orden NEW |

Los ejemplos de éxito y error se mantienen junto a cada feature en `src/modules/*/requests/request.http`.

Las excepciones lanzadas en solicitudes HTTP se registran una sola vez por el
filtro global como logs JSON de nivel `error`, incluidos errores de validación y
de negocio 4xx. Los errores inesperados se responden con un mensaje genérico;
el log registra el tipo de excepción y el contexto, no su mensaje interno.
`/ping` es un healthcheck de liveness: seguirá respondiendo aunque PostgreSQL
no esté disponible.

El portfolio conserva `dailyReturnPercent` como variación diaria del instrumento. Cada posición también incluye `totalReturnArs` y `totalReturnPercent`, calculados sobre el valor de mercado actual y el costo de adquisición de las acciones remanentes. Una posición sin costo de adquisición reporta `totalReturnPercent: null`.

### Crear una orden

El body acepta exactamente uno de `quantity` (acciones enteras) o `amountArs` (monto máximo en pesos). `LIMIT` requiere `price`; `MARKET` usa el último `close` y, si el body incluye `price`, lo ignora. El monto se convierte a la cantidad máxima de acciones enteras usando el precio límite o el `close`, según corresponda.

Una orden que supera el efectivo o las acciones disponibles se guarda con estado `REJECTED` y responde `201 Created`. Una orden MARKET aceptada se guarda como `FILLED`; una LIMIT aceptada como `NEW`.

## Criterios funcionales acordados

- El efectivo parte de los movimientos `CASH_IN`/`CASH_OUT` FILLED y se ajusta por el importe de compras y ventas FILLED.
- Las órdenes BUY LIMIT en estado NEW reservan efectivo; las SELL LIMIT NEW reservan acciones hasta cancelarse. Las reservas reducen la disponibilidad, pero no alteran las posiciones FILLED ni el valor total de la cuenta.
- El valor total de cuenta es el efectivo neto de movimientos FILLED más el valor de mercado de las posiciones FILLED. El efectivo disponible sí descuenta las reservas de compras NEW.
- La cantidad y el valor de cada posición se calculan con órdenes BUY/SELL FILLED y el `close` más reciente. `dailyReturnPercent` usa `(close - previousClose) / previousClose * 100`.
- El rendimiento total se calcula contra el costo de adquisición de las acciones aún mantenidas. Para ventas parciales se usa costo promedio ponderado cronológico: cada venta reduce el costo remanente al promedio vigente antes de vender. Esta metodología no está especificada en el challenge y se eligió explícitamente para dar un costo determinista a las posiciones que se conservan; ver [la decisión y alternativas](./docs/portfolio-cost-method.md).
- Las inconsistencias en órdenes FILLED, la cantidad neta negativa o precios de mercado inválidos producen un error interno genérico; la falta de datos de mercado requeridos para una posición abierta produce `503`. No se incluyen detalles de base de datos en estos errores. Los importes que excedan el rango que permite representar centavos distintos como números JSON se rechazan antes de perder precisión.
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

Las pruebas unitarias y `npm run test:e2e` no requieren una base de datos. La prueba e2e normal ejercita el pipeline HTTP con el repositorio simulado.

### Pruebas de concurrencia contra PostgreSQL real

Las pruebas de concurrencia son opt-in y limpian únicamente los usuarios, instrumentos, órdenes y datos de mercado que crean. Usá una base descartable separada de desarrollo:

```bash
docker compose exec -T db createdb -U postgres cocos_challenge_test
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d cocos_challenge_test < ../database.sql
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cocos_challenge_test?schema=public" npm run test:concurrency
```

La suite comprueba las seis intercalaciones concurrentes de compra/venta/cancelación requeridas, además de liberación de reservas, validaciones de entrada, límites monetarios, redondeo por centavos, instrumentos MONEDA y órdenes LIMIT sin precio de mercado.
