# Balgrim Migration Roadmap

## Estado actual

El repo ahora tiene tres capas:

1. `frontend actual` en HTML/CSS/JS
2. `backend/` profesional con Express + Prisma + PostgreSQL + Wompi-ready
3. `frontend-next/` como base de migracion a React/Next + Zustand

## Orden recomendado

### Paso 1

Levantar PostgreSQL y backend:

```bash
cd backend
docker compose up -d
copy .env.example .env
npm run prisma:generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

### Paso 2

Conectar el frontend actual a `http://localhost:4000/api`

La base de `store.js` ya fue preparada para eso.

### Paso 3

Migrar vistas una por una a `frontend-next/`

Orden recomendado:

1. Home y catalogo
2. PDP o detalle de producto
3. Carrito
4. Checkout
5. Admin

## Decisiones ya aplicadas

- carrito invitado primero
- auth solo para admin al inicio
- productos con variantes
- ordenes separadas de items
- pagos por webhook

## Arquitectura objetivo

- Frontend: Next.js + Zustand
- Backend: Express
- DB: PostgreSQL
- ORM: Prisma
- Pagos: Wompi
- Auth: JWT/cookies para admin
