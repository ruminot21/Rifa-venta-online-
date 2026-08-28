# Rifa Online + Mercado Pago

Incluye:
- `public/index.html`: página pública para clientes.
- `public/admin.html`: panel de administración original.
- `server.js`: backend Node.js/Express.
- Mercado Pago Checkout Pro.
- Reserva temporal de números.
- Webhook de pagos.
- Página de resultado.

## Instalación

1. Instalar Node.js.
2. Entrar a esta carpeta.
3. Ejecutar:
   npm install
4. Copiar `.env.example` a `.env`.
5. Poner el Access Token de Mercado Pago en `MP_ACCESS_TOKEN`.
6. Configurar `BASE_URL` con HTTPS en producción.
7. Ejecutar:
   npm start

Abrir:
http://localhost:3000/

## Importante

El backend es obligatorio para proteger el Access Token. Mercado Pago crea la preferencia mediante `/checkout/preferences` y el pago debe confirmarse consultando el pago recibido por webhook. No se debe marcar un número como vendido solo porque el usuario regresó desde la página de Mercado Pago.

Para producción, sustituir las reservas/órdenes en memoria por Firestore o PostgreSQL para evitar pérdida de datos al reiniciar el servidor.

## Sincronización en tiempo real

Admin y clientes usan `rifas/rifa_principal` de Firestore. El backend agrega una compra como `Pendiente` al crear el pago y cambia a `Pagado` cuando Mercado Pago confirma el pago mediante webhook.

Para que el backend pueda escribir en Firestore, configura `FIREBASE_SERVICE_ACCOUNT_JSON` con el JSON completo de una cuenta de servicio del proyecto Firebase. Nunca publiques ese JSON ni lo pongas dentro de `public/`.

El cliente muestra automáticamente las `prizeImages` y `prizeVideo` configuradas desde el panel administrador.
