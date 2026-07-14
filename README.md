# BillBook Backend

Node + Express + TypeScript + MongoDB backend for the BillBook frontend.

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values
npm run seed           # seed GST taxes, units, and Indian states
npm run dev            # start dev server (tsx watch) on http://localhost:5000
```

Build for production:

```bash
npm run build && npm start
```

## Environment variables

See `.env.example`. Required: `MONGO_URI`, `JWT_SECRET`, Firebase Admin
(`FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`), and
Cloudinary (`CLOUDINARY_*`). Secrets live only in `.env` (gitignored).

## Auth model

1. Frontend runs Firebase phone/OTP in the browser.
2. On success it sends the Firebase **ID token** to `POST /api/auth/login`.
3. Backend verifies it with the Firebase Admin SDK, upserts the user, and
   returns a backend-issued **JWT**.
4. All `/api/item`, `/api/party`, `/api/sale`, `/api/purchase` routes require
   `Authorization: Bearer <jwt>`. Every record is scoped to the user.

## Routes (matched to the frontend contract)

| Group | Method + path |
|-------|---------------|
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile` |
| Item | `POST /create` (multipart image), `POST /bulk-create-items` (xlsx), `GET /items`, `GET /get-item?id=&itemType=`, `POST /create-item-category`, `GET /get-item-catagories`, `GET /taxes`, `GET /units`, `PUT /update-item-stock` |
| Party | `POST /create`, `POST /bulk-create` (xlsx), `GET /parties`, `GET /get-party/:id`, `PUT /update-party/:id`, `POST /create-category`, `GET /get-catagories`, `GET /locations` |
| Sale | `POST /create-sale`, `GET /sale-invoices` |
| Purchase | `POST /create-purchase`, `GET /purchase-invoices` |

Bulk-upload validation errors are returned as an annotated `.xlsx` file with
status 400 (the frontend reads that ArrayBuffer), matching the existing
custom base-query behavior.

## Response contract

Every success response is `{ data, message? }` (the frontend reads
`response.data`). Entities carry a string `id` (plus `_id`). Items are mapped to
the client's read shape (`itemName`/`serviceName`, `gstRate: { value }`,
`netQuantity`, `code`, `category`). Locations return
`{ data: { states: [{ state }], cities: [{ city, state }] } }`.

## Production hardening

- **Security**: helmet, restricted CORS allowlist, JWT verified once in
  middleware, `userId` always taken from the token (never trusted from the body).
- **Rate limiting**: tight on `/api/auth`, generous global backstop on `/api`.
- **DB efficiency**: per-user + compound indexes (`{ user, createdAt: -1 }`),
  `.lean()` reads, projection on populates, pagination caps on every list
  (`?page` / `?limit`), bulk writes for stock (no N+1).
- **Caching**: global reference data (taxes/units/locations) cached in-memory (1h).
- **Stability**: compression, centralized error handler, `asyncHandler` wrapper,
  graceful SIGTERM/SIGINT shutdown, structured `pino` logging.
- **Validation**: Zod schemas reject bad input before any DB round-trip.

## Project layout

```
src/
  config/      env, db, firebase, cloudinary, logger
  models/      Mongoose schemas (+ indexes)
  middleware/  auth (JWT), error, upload (multer), validate (zod), rateLimit
  utils/       jwt, excel, cache, pagination, respond, serialize, ApiError, asyncHandler
  services/    auth, item, party, sale, purchase, reference, invoice.shared
  controllers/ thin — call services, shape { data }
  routes/      one router per group
  validation/  zod schemas
  app.ts       express app: helmet, cors, compression, logging, routes
  server.ts    boot: connect DB, init firebase, listen, graceful shutdown
  seed.ts      reference data seeder (taxes, units, states+cities)
```
