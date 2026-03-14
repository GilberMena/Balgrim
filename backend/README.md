# Balgrim Backend

Base recomendada para Balgrim usando:

- Express
- Prisma
- PostgreSQL
- JWT para admin
- Wompi ready

## Estructura

```txt
backend/
  prisma/
  src/
    config/
    lib/
    middlewares/
    modules/
    routes/
    utils/
```

## Primeros pasos

1. Instala dependencias:

```bash
npm install
```

2. Copia `.env.example` a `.env`

3. Configura `DATABASE_URL`

4. Genera Prisma:

```bash
npm run prisma:generate
```

5. Corre migraciones:

```bash
npm run prisma:migrate
```

6. Si quieres sembrar datos base:

```bash
npm run prisma:seed
```

7. Levanta el servidor:

```bash
npm run dev
```

## Credenciales iniciales sugeridas

- admin email: `admin@balgrim.co`
- password: `Balgrim123!`

Estas credenciales se crean desde `prisma/seed.js`.

## Notas

- El frontend actual del repo puede seguir funcionando mientras migras gradualmente a React o Next.js.
- Para ropa, la compra debe ir contra `product_variants`, no contra `products` directos.
- Wompi debe confirmar pagos por webhook antes de marcar una orden como pagada.
