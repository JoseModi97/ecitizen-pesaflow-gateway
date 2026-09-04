# ecitizen-pesaflow-gateway

[![npm version](https://img.shields.io/npm/v/ecitizen-pesaflow-gateway.svg?style=flat-square)](https://www.npmjs.com/package/ecitizen-pesaflow-gateway)
[![CI](https://github.com/JoseModi97/ecitizen-pesaflow-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/JoseModi97/ecitizen-pesaflow-gateway/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/ecitizen-pesaflow-gateway.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)

A beginner-friendly Kenya eCitizen / PesaFlow payment gateway extension and SDK for **Node.js**, **Express**, **Fastify**, **Next.js**, **NestJS**, and **Vanilla JavaScript / TypeScript**. Build signed checkout payloads, render instant payment buttons, and verify webhook callbacks with plain-English fields.

- **Forward & Backward Compatible**: Dual-distributed in CommonJS (`require`) and ES Modules (`import`) with full TypeScript declarations (`.d.ts`). Fully compatible across **Node.js 16, 18, 20, 22, and 24+**.
- **Interactive CLI Setup (Gii Replacement)**: Forget browser-based Gii web tools! Run `npx ecitizen-pesaflow init` to interactively configure your credentials, create `.env` entries, and scaffold framework-specific payment routes in seconds.
- **Zero Runtime Dependencies**: The core cryptographic signing and verification uses Node.js's native `node:crypto` module — lightning-fast, ultra-secure, with zero third-party supply-chain bloat.
- **Instant Payment Button**: Render ready-to-use, HMAC-signed payment forms in one line of code (`payButton()`) or retrieve raw payloads (`checkout()`) for custom React/Vue/mobile UIs.
- **Safaricom M-Pesa STK Push**: Built-in Kenyan phone normalization (`PhoneHelper`) to trigger instant PIN prompts on customer phones (`07...`, `01...`, `+254...` -> `2547...`).
- **Timing-Safe Cryptographic Verification**: Validate server-to-server IPN notifications with timing-safe HMAC-SHA256 (`verify()`, `isPaid()`).
- **Pre-Built Adapters**: Out-of-the-box webhook handlers and middlewares for Express, Fastify, Next.js (App Router & Pages Router), and native HTTP.

---

## Compatibility

- **Node.js**: >= 16.0.0 (fully tested on Node 16, 18, 20, 22, and 24+).
- **Module Systems**:
  - CommonJS: `const { EcitizenClient } = require('ecitizen-pesaflow-gateway');`
  - ES Modules: `import { EcitizenClient } from 'ecitizen-pesaflow-gateway';`
  - TypeScript: Full IntelliSense and type checking included.
- **Web Frameworks**: Express, Fastify, Next.js (App & Pages Router), NestJS, Koa, Hono, and Vanilla Node.js `http`.

---

## Installation

```bash
npm install ecitizen-pesaflow-gateway
# or
yarn add ecitizen-pesaflow-gateway
# or
pnpm add ecitizen-pesaflow-gateway
```

---

## Interactive CLI Setup (Gii Alternative)

Instead of navigating web forms in Yii2's Gii, set up your project seamlessly directly from your terminal:

```bash
npx ecitizen-pesaflow init
```

The interactive wizard will:
1. Prompt for your eCitizen credentials (**API Client ID**, **API Key**, **Merchant Secret**, **Service ID**).
2. Ask for your target framework (**Express**, **Fastify**, **Next.js App Router**, **Next.js Pages Router**, **NestJS**, or **Standalone**).
3. Automatically write or update your `.env` file.
4. Generate a typed configuration file (`ecitizen.config.js` or `ecitizen.config.ts`).
5. Scaffold a complete, ready-to-run Payment & Webhook controller for your selected framework!

### Non-Interactive / CI Flags
For CI/CD pipelines or headless scripts:
```bash
npx ecitizen-pesaflow init --client-id "MY_ID" --api-key "MY_KEY" --secret "MY_SEC" --service-id "MY_SVC" --framework express --yes
```

### Cryptographic Verification Test
Verify your environment and HMAC algorithms against official test vectors:
```bash
npx ecitizen-pesaflow test
```

---

## Quickstart: Express.js

### 1. Configure Environment Variables (`.env`)

```env
ECITIZEN_CLIENT_ID=your_api_client_id
ECITIZEN_API_KEY=your_api_key
ECITIZEN_SECRET=your_merchant_secret
ECITIZEN_SERVICE_ID=your_service_id
ECITIZEN_GATEWAY_URL=https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php
ECITIZEN_CURRENCY=KES
```

### 2. Create Payment Controller (`controllers/paymentController.js`)

```javascript
const express = require('express');
const { EcitizenClient, PhoneHelper, createExpressWebhookHandler } = require('ecitizen-pesaflow-gateway');

// Automatically reads from process.env if no parameters are passed
const client = new EcitizenClient();
const paymentRouter = express.Router();

/**
 * 1. Checkout & Pay Button View
 */
paymentRouter.get('/pay', (req, res) => {
  const amount = Number(req.query.amount || 1500);
  const reference = String(req.query.reference || ('INV-' + Date.now()));

  const payButtonHtml = client.payButton({
    amount: amount,
    reference: reference,
    description: 'Land Rates Clearance',
    name: 'John Doe',
    idNumber: '28374619',
    phone: PhoneHelper.normalize('0712345678'), // Triggers Safaricom M-Pesa STK push
    sendStkPush: true,
    callbackUrl: `${req.protocol}://${req.get('host')}/payment/success?reference=${reference}`,
    notifyUrl: `${req.protocol}://${req.get('host')}/payment/notify`,
  }, 'Proceed to eCitizen', { class: 'btn btn-success btn-lg' });

  res.send(`
    <div style="max-width: 480px; margin: 50px auto; text-align: center; font-family: sans-serif;">
      <h2>Invoice #${reference}</h2>
      <p>Amount: <strong>KES ${amount.toFixed(2)}</strong></p>
      <div style="margin-top: 20px;">
        ${payButtonHtml}
      </div>
    </div>
  `);
});

/**
 * 2. Server-to-Server IPN Notification Webhook
 * Cryptographically verifies HMAC signature and confirms settlement.
 */
paymentRouter.post('/notify', createExpressWebhookHandler(client, {
  onSuccess: async (result, req, res) => {
    console.log(`Payment confirmed for reference: ${result.reference}, amount: ${result.amountPaid}`);
    // Example: update database record
    // await Order.updateOne({ reference: result.reference }, { status: 'paid' });
  },
  onFailure: async (result, req, res) => {
    console.warn(`Payment verification failed: ${result.description}`);
  }
}));

/**
 * 3. Browser Return Landing Page
 */
paymentRouter.get('/success', (req, res) => {
  res.send(`<h3>Payment Submitted! Reference: ${req.query.reference}</h3>`);
});

module.exports = paymentRouter;
```

### 3. Mount in your Express App (`server.js`)

Make sure URL-encoded body parser is enabled for webhooks:
```javascript
const express = require('express');
const paymentRouter = require('./controllers/paymentController');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/payment', paymentRouter);

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## Quickstart: Next.js (App Router)

### 1. Webhook Route Handler (`app/api/ecitizen/notify/route.ts`)

```typescript
import { EcitizenClient, createNextAppRouteHandler } from 'ecitizen-pesaflow-gateway';

const client = new EcitizenClient();

export const POST = createNextAppRouteHandler(client, {
  onSuccess: async (result, rawBody) => {
    console.log('[eCitizen] Confirmed payment:', result.reference, result.amountPaid);
    // await prisma.order.update({ where: { ref: result.reference }, data: { paid: true } });
  },
  onFailure: async (result) => {
    console.warn('[eCitizen] Verification failed:', result.reference);
  }
});
```

### 2. Initiate Payment from Next.js Server Component or Route

```typescript
import { EcitizenClient, PhoneHelper } from 'ecitizen-pesaflow-gateway';

const client = new EcitizenClient();

export async function createCheckout(order: { id: string; amount: number; user: any }) {
  const checkout = client.checkout({
    amount: order.amount,
    reference: order.id,
    description: 'Order Payment',
    name: order.user.name,
    idNumber: order.user.nationalId,
    phone: PhoneHelper.normalize(order.user.phone),
    sendStkPush: true,
    callbackUrl: 'https://yourdomain.com/payment/success',
    notifyUrl: 'https://yourdomain.com/api/ecitizen/notify',
  });

  return checkout; // { url: 'https://payments.ecitizen...', payload: { ... } }
}
```

---

## Standalone Usage (Pure JavaScript / TypeScript)

```typescript
import { EcitizenClient, PhoneHelper } from 'ecitizen-pesaflow-gateway';

const ecitizen = new EcitizenClient({
  apiClientID: 'YOUR_API_CLIENT_ID',
  apiKey: 'YOUR_API_KEY',
  secret: 'YOUR_SECRET',
  serviceID: 'YOUR_SERVICE_ID',
});

// 1. Generate a signed checkout payload
const { url, payload } = ecitizen.checkout({
  amount: 500,
  reference: 'INV-0001',
  description: 'School fees',
  name: 'Jane Doe',
  idNumber: '12345678',
  phone: '0712345678', // Automatically normalized to 254712345678
});

// 2. Verify an inbound webhook notification
const result = ecitizen.verify(webhookPayload);
if (result.success) {
  console.log(`Payment confirmed for ${result.reference} (${result.amountPaid} KES)`);
} else {
  console.error(`Verification failed: ${result.description}`);
}
```

---

## Migration from `yii2-ecitizen-gateway` / Laravel

If you are migrating or integrating with existing backend systems from [`yii2-ecitizen-gateway`](https://github.com/josemodi97/yii2-ecitizen-gateway), the field names and cryptographic algorithms are 100% identical:

| PHP (Yii2 / Laravel) | Node.js (`ecitizen-pesaflow-gateway`) | Description |
|---|---|---|
| `$client->checkout(...)` | `client.checkout(...)` | Generates signed checkout payload |
| `$client->payButton(...)` | `client.payButton(...)` | Generates self-contained HTML form |
| `$client->verify($_POST)` | `client.verify(req.body)` | Verifies IPN webhook HMAC signature |
| `$client->isPaid($_POST)` | `client.isPaid(req.body)` | Returns boolean verification result |
| `PhoneHelper::normalize($p)` | `PhoneHelper.normalize(p)` | Normalizes Kenyan phone numbers |
| Gii Web Generator | `npx ecitizen-pesaflow init` | Interactive setup wizard |

---

## Security & Best Practices

1. **Keep Secrets Private**: Store your API key and Merchant secret in `.env`. Never commit secrets to git repositories.
2. **CSRF Exemption**: eCitizen servers POST webhook notifications from outside your application domain. If using CSRF protection (e.g. `csurf` in Express), exempt the notification webhook route (`/payment/notify`).
3. **Timing-Safe Comparison**: Webhook signatures are checked using `node:crypto`'s `timingSafeEqual` to prevent side-channel timing attacks.
4. **Phone Formatting**: Always use `PhoneHelper.normalize()` to ensure phone numbers match Safaricom / Airtel STK push formats (`2547XXXXXXXX` or `2541XXXXXXXX`).

---

## License

MIT License. See [LICENSE](LICENSE) for details.
