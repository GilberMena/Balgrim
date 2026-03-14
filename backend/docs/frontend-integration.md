# Integracion frontend para Balgrim

## Opcion A

Mantener el frontend actual del repo mientras el backend nuevo toma control de:

- productos
- variantes
- carrito
- ordenes
- auth admin

### Endpoints clave

- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`
- `POST /api/orders`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/payments/wompi/checkout`
- `POST /api/payments/wompi/webhook`

### Flujo sugerido para el carrito

1. El frontend obtiene productos y variantes desde `/api/products`
2. El usuario elige talla y color
3. Se agrega al carrito usando `productVariantId`
4. El checkout crea la orden desde el carrito
5. La orden pasa a Wompi
6. El webhook confirma el pago

## Opcion B

Migrar el frontend a React o Next.js.

### Recomendado

- Next.js App Router
- Zustand para carrito y UI local
- llamadas al backend Express para datos y pagos

## Nota importante

Para ropa, nunca bases el carrito en `productId` solamente.

Debe ser:

- `productVariantId`

Porque el usuario compra una combinacion concreta de:

- talla
- color
- stock
