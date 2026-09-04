import * as fs from 'fs';
import * as path from 'path';
export class ProjectScaffolder {
    static detectProjectEnvironment(targetDir) {
        let isTypeScript = false;
        let isEsm = false;
        let detectedFramework;
        const pkgPath = path.join(targetDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                if (pkg.type === 'module') {
                    isEsm = true;
                }
                const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                if (allDeps.typescript)
                    isTypeScript = true;
                if (allDeps.next) {
                    if (fs.existsSync(path.join(targetDir, 'app')) || fs.existsSync(path.join(targetDir, 'src/app'))) {
                        detectedFramework = 'next-app';
                    }
                    else {
                        detectedFramework = 'next-pages';
                    }
                }
                else if (allDeps['@nestjs/core']) {
                    detectedFramework = 'nest';
                }
                else if (allDeps.fastify) {
                    detectedFramework = 'fastify';
                }
                else if (allDeps.express) {
                    detectedFramework = 'express';
                }
            }
            catch { }
        }
        if (fs.existsSync(path.join(targetDir, 'tsconfig.json'))) {
            isTypeScript = true;
        }
        return { isTypeScript, isEsm, detectedFramework };
    }
    static updateEnvFile(targetDir, answers) {
        const envPath = path.join(targetDir, '.env');
        const entries = [
            `ECITIZEN_CLIENT_ID="${answers.apiClientID}"`,
            `ECITIZEN_API_KEY="${answers.apiKey}"`,
            `ECITIZEN_SECRET="${answers.secret}"`,
            `ECITIZEN_SERVICE_ID="${answers.serviceID}"`,
            `ECITIZEN_GATEWAY_URL="${answers.gatewayUrl}"`,
            `ECITIZEN_CURRENCY="${answers.currency}"`,
        ];
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            const keysToUpdate = [
                'ECITIZEN_CLIENT_ID',
                'ECITIZEN_API_KEY',
                'ECITIZEN_SECRET',
                'ECITIZEN_SERVICE_ID',
                'ECITIZEN_GATEWAY_URL',
                'ECITIZEN_CURRENCY',
            ];
            // Remove existing keys if present
            const filteredLines = lines.filter((line) => {
                const key = line.split('=')[0]?.trim();
                return !keysToUpdate.includes(key);
            });
            if (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() !== '') {
                filteredLines.push('');
            }
            filteredLines.push('# eCitizen / PesaFlow Gateway Credentials');
            filteredLines.push(...entries);
            fs.writeFileSync(envPath, filteredLines.join('\n') + '\n', 'utf8');
        }
        else {
            const content = [
                '# eCitizen / PesaFlow Gateway Credentials',
                ...entries,
                '',
            ].join('\n');
            fs.writeFileSync(envPath, content, 'utf8');
        }
        return envPath;
    }
    static createConfigFile(targetDir, answers) {
        const ext = answers.isTypeScript ? 'ts' : (answers.isEsm ? 'mjs' : 'js');
        const fileName = `ecitizen.config.${ext}`;
        const filePath = path.join(targetDir, fileName);
        let code = '';
        if (answers.isTypeScript) {
            code = `import { EcitizenClient } from 'ecitizen-pesaflow-gateway';

export const ecitizen = new EcitizenClient({
  apiClientID: process.env.ECITIZEN_CLIENT_ID || '${answers.apiClientID}',
  apiKey: process.env.ECITIZEN_API_KEY || '${answers.apiKey}',
  secret: process.env.ECITIZEN_SECRET || '${answers.secret}',
  serviceID: process.env.ECITIZEN_SERVICE_ID || '${answers.serviceID}',
  url: process.env.ECITIZEN_GATEWAY_URL || '${answers.gatewayUrl}',
  currency: process.env.ECITIZEN_CURRENCY || '${answers.currency}',
});

export default ecitizen;
`;
        }
        else if (answers.isEsm) {
            code = `import { EcitizenClient } from 'ecitizen-pesaflow-gateway';

export const ecitizen = new EcitizenClient({
  apiClientID: process.env.ECITIZEN_CLIENT_ID || '${answers.apiClientID}',
  apiKey: process.env.ECITIZEN_API_KEY || '${answers.apiKey}',
  secret: process.env.ECITIZEN_SECRET || '${answers.secret}',
  serviceID: process.env.ECITIZEN_SERVICE_ID || '${answers.serviceID}',
  url: process.env.ECITIZEN_GATEWAY_URL || '${answers.gatewayUrl}',
  currency: process.env.ECITIZEN_CURRENCY || '${answers.currency}',
});

export default ecitizen;
`;
        }
        else {
            code = `const { EcitizenClient } = require('ecitizen-pesaflow-gateway');

const ecitizen = new EcitizenClient({
  apiClientID: process.env.ECITIZEN_CLIENT_ID || '${answers.apiClientID}',
  apiKey: process.env.ECITIZEN_API_KEY || '${answers.apiKey}',
  secret: process.env.ECITIZEN_SECRET || '${answers.secret}',
  serviceID: process.env.ECITIZEN_SERVICE_ID || '${answers.serviceID}',
  url: process.env.ECITIZEN_GATEWAY_URL || '${answers.gatewayUrl}',
  currency: process.env.ECITIZEN_CURRENCY || '${answers.currency}',
});

module.exports = ecitizen;
module.exports.ecitizen = ecitizen;
`;
        }
        fs.writeFileSync(filePath, code, 'utf8');
        return filePath;
    }
    static scaffoldController(targetDir, answers) {
        const createdFiles = [];
        switch (answers.framework) {
            case 'express': {
                const ext = answers.isTypeScript ? 'ts' : (answers.isEsm ? 'mjs' : 'js');
                const outDir = path.join(targetDir, 'controllers');
                fs.mkdirSync(outDir, { recursive: true });
                const filePath = path.join(outDir, `paymentController.${ext}`);
                let code = '';
                if (answers.isTypeScript) {
                    code = `import { Request, Response, Router } from 'express';
import { EcitizenClient, PhoneHelper, createExpressWebhookHandler } from 'ecitizen-pesaflow-gateway';

const client = new EcitizenClient();
export const paymentRouter = Router();

/**
 * 1. Checkout & Pay Button View
 * Displays invoice details and one-click payment button.
 */
paymentRouter.get('/pay', (req: Request, res: Response) => {
  const amount = Number(req.query.amount || 500);
  const reference = String(req.query.reference || \`INV-\${Date.now()}\`);
  const description = String(req.query.description || 'Service Fee');
  const name = String(req.query.name || 'Jane Doe');
  const idNumber = String(req.query.idNumber || '12345678');
  const phone = String(req.query.phone || '0712345678');

  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = \`\${protocol}://\${host}\`;

  const payButtonHtml = client.payButton({
    amount,
    reference,
    description,
    name,
    idNumber,
    phone: PhoneHelper.normalize(phone),
    sendStkPush: true,
    callbackUrl: \`\${baseUrl}/payment/success?reference=\${encodeURIComponent(reference)}\`,
    notifyUrl: \`\${baseUrl}/payment/notify\`,
  }, 'Proceed to eCitizen', { class: 'btn btn-success btn-lg' });

  res.send(\`
    <!DOCTYPE html>
    <html>
      <head>
        <title>eCitizen Checkout</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      </head>
      <body class="bg-light py-5">
        <div class="container text-center" style="max-width: 500px;">
          <div class="card p-4 shadow-sm">
            <h3 class="card-title mb-3">Invoice #\${reference}</h3>
            <p class="lead">Amount: <strong>KES \${amount.toFixed(2)}</strong></p>
            <p class="text-muted">\${description}</p>
            <div class="mt-3">
              \${payButtonHtml}
            </div>
          </div>
        </div>
      </body>
    </html>
  \`);
});

/**
 * 2. Server-to-server IPN Webhook Notification
 * Validates HMAC signature and confirms settlement.
 */
paymentRouter.post('/notify', createExpressWebhookHandler(client, {
  onSuccess: async (result, req, res) => {
    console.log('[eCitizen] Payment Confirmed:', result.reference, result.amountPaid);
    // TODO: Update your database record here
    // await Order.update({ status: 'paid' }, { where: { reference: result.reference } });
  },
  onFailure: async (result, req, res) => {
    console.warn('[eCitizen] Payment Verification Failed:', result.reference, result.description);
  }
}));

/**
 * 3. Browser Return Landing Page
 */
paymentRouter.get('/success', (req: Request, res: Response) => {
  const reference = req.query.reference || '';
  res.send(\`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payment Received</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      </head>
      <body class="bg-light py-5 text-center">
        <div class="container" style="max-width: 480px;">
          <div class="card p-4 shadow-sm">
            <div class="text-success display-4 mb-2">✓</div>
            <h2>Payment Complete</h2>
            <p class="text-muted">Your transaction was submitted to eCitizen.</p>
            <p><strong>Reference:</strong> <code>\${reference}</code></p>
          </div>
        </div>
      </body>
    </html>
  \`);
});
`;
                }
                else if (answers.isEsm) {
                    code = `import { Router } from 'express';
import { EcitizenClient, PhoneHelper, createExpressWebhookHandler } from 'ecitizen-pesaflow-gateway';

const client = new EcitizenClient();
export const paymentRouter = Router();

paymentRouter.get('/pay', (req, res) => {
  const amount = Number(req.query.amount || 500);
  const reference = String(req.query.reference || \`INV-\${Date.now()}\`);
  const description = String(req.query.description || 'Service Fee');
  const name = String(req.query.name || 'Jane Doe');
  const idNumber = String(req.query.idNumber || '12345678');
  const phone = String(req.query.phone || '0712345678');

  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = \`\${protocol}://\${host}\`;

  const payButtonHtml = client.payButton({
    amount,
    reference,
    description,
    name,
    idNumber,
    phone: PhoneHelper.normalize(phone),
    sendStkPush: true,
    callbackUrl: \`\${baseUrl}/payment/success?reference=\${encodeURIComponent(reference)}\`,
    notifyUrl: \`\${baseUrl}/payment/notify\`,
  }, 'Proceed to eCitizen', { class: 'btn btn-success btn-lg' });

  res.send(\`
    <!DOCTYPE html>
    <html>
      <head>
        <title>eCitizen Checkout</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      </head>
      <body class="bg-light py-5">
        <div class="container text-center" style="max-width: 500px;">
          <div class="card p-4 shadow-sm">
            <h3 class="card-title mb-3">Invoice #\${reference}</h3>
            <p class="lead">Amount: <strong>KES \${amount.toFixed(2)}</strong></p>
            <div class="mt-3">
              \${payButtonHtml}
            </div>
          </div>
        </div>
      </body>
    </html>
  \`);
});

paymentRouter.post('/notify', createExpressWebhookHandler(client, {
  onSuccess: async (result) => {
    console.log('[eCitizen] Confirmed:', result.reference, result.amountPaid);
  }
}));

paymentRouter.get('/success', (req, res) => {
  res.send('<h3>Payment Submitted! Reference: ' + (req.query.reference || '') + '</h3>');
});
`;
                }
                else {
                    code = `const express = require('express');
const { EcitizenClient, PhoneHelper, createExpressWebhookHandler } = require('ecitizen-pesaflow-gateway');

const client = new EcitizenClient();
const paymentRouter = express.Router();

paymentRouter.get('/pay', (req, res) => {
  const amount = Number(req.query.amount || 500);
  const reference = String(req.query.reference || ('INV-' + Date.now()));
  const description = String(req.query.description || 'Service Fee');
  const name = String(req.query.name || 'Jane Doe');
  const idNumber = String(req.query.idNumber || '12345678');
  const phone = String(req.query.phone || '0712345678');

  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = protocol + '://' + host;

  const payButtonHtml = client.payButton({
    amount: amount,
    reference: reference,
    description: description,
    name: name,
    idNumber: idNumber,
    phone: PhoneHelper.normalize(phone),
    sendStkPush: true,
    callbackUrl: baseUrl + '/payment/success?reference=' + encodeURIComponent(reference),
    notifyUrl: baseUrl + '/payment/notify',
  }, 'Proceed to eCitizen', { class: 'btn btn-success btn-lg' });

  res.send(\`
    <!DOCTYPE html>
    <html>
      <head>
        <title>eCitizen Checkout</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      </head>
      <body class="bg-light py-5">
        <div class="container text-center" style="max-width: 500px;">
          <div class="card p-4 shadow-sm">
            <h3 class="card-title mb-3">Invoice #\${reference}</h3>
            <p class="lead">Amount: <strong>KES \${amount.toFixed(2)}</strong></p>
            <div class="mt-3">
              \${payButtonHtml}
            </div>
          </div>
        </div>
      </body>
    </html>
  \`);
});

paymentRouter.post('/notify', createExpressWebhookHandler(client, {
  onSuccess: async (result) => {
    console.log('[eCitizen] Payment Confirmed:', result.reference, result.amountPaid);
  }
}));

paymentRouter.get('/success', (req, res) => {
  res.send('<h3>Payment Submitted! Reference: ' + (req.query.reference || '') + '</h3>');
});

module.exports = paymentRouter;
`;
                }
                fs.writeFileSync(filePath, code, 'utf8');
                createdFiles.push(filePath);
                break;
            }
            case 'fastify': {
                const ext = answers.isTypeScript ? 'ts' : (answers.isEsm ? 'mjs' : 'js');
                const outDir = path.join(targetDir, 'routes');
                fs.mkdirSync(outDir, { recursive: true });
                const filePath = path.join(outDir, `paymentRoutes.${ext}`);
                const code = `import { EcitizenClient, PhoneHelper, createFastifyWebhookHandler } from 'ecitizen-pesaflow-gateway';

const client = new EcitizenClient();

export default async function paymentRoutes(fastify, options) {
  fastify.get('/payment/pay', async (request, reply) => {
    const { amount = 500, reference = \`INV-\${Date.now()}\`, name = 'Jane Doe', idNumber = '12345678', phone = '0712345678' } = request.query;

    const html = client.payButton({
      amount: Number(amount),
      reference: String(reference),
      description: 'Order Payment',
      name: String(name),
      idNumber: String(idNumber),
      phone: PhoneHelper.normalize(String(phone)),
      sendStkPush: true,
      callbackUrl: 'https://example.com/payment/success',
      notifyUrl: 'https://example.com/payment/notify',
    });

    reply.type('text/html').send(html);
  });

  fastify.post('/payment/notify', createFastifyWebhookHandler(client, {
    onSuccess: async (result) => {
      console.log('[eCitizen] Webhook confirmed:', result.reference, result.amountPaid);
    }
  }));
}
`;
                fs.writeFileSync(filePath, code, 'utf8');
                createdFiles.push(filePath);
                break;
            }
            case 'next-app': {
                const apiDir = path.join(targetDir, 'app/api/ecitizen/notify');
                fs.mkdirSync(apiDir, { recursive: true });
                const routePath = path.join(apiDir, 'route.ts');
                const code = `import { EcitizenClient, createNextAppRouteHandler } from 'ecitizen-pesaflow-gateway';

const client = new EcitizenClient();

export const POST = createNextAppRouteHandler(client, {
  onSuccess: async (result, rawBody) => {
    console.log('[eCitizen] Payment confirmed for invoice:', result.reference, result.amountPaid);
    // TODO: Update database (Prisma, Drizzle, etc.)
  },
  onFailure: async (result) => {
    console.warn('[eCitizen] Webhook signature verification failed:', result.reference);
  }
});
`;
                fs.writeFileSync(routePath, code, 'utf8');
                createdFiles.push(routePath);
                break;
            }
            case 'next-pages': {
                const apiDir = path.join(targetDir, 'pages/api/ecitizen');
                fs.mkdirSync(apiDir, { recursive: true });
                const filePath = path.join(apiDir, 'notify.ts');
                const code = `import { EcitizenClient, createNextPagesApiHandler } from 'ecitizen-pesaflow-gateway';

const client = new EcitizenClient();

export default createNextPagesApiHandler(client, {
  onSuccess: async (result) => {
    console.log('[eCitizen] Payment confirmed for invoice:', result.reference);
  }
});
`;
                fs.writeFileSync(filePath, code, 'utf8');
                createdFiles.push(filePath);
                break;
            }
            default: {
                // Standalone script
                const filePath = path.join(targetDir, 'ecitizen-demo.js');
                const code = `const { EcitizenClient, PhoneHelper } = require('ecitizen-pesaflow-gateway');

const client = new EcitizenClient();

// 1. Build a signed checkout payload
const checkout = client.checkout({
  amount: 1500,
  reference: 'INV-1002',
  description: 'Land Rates Clearance',
  name: 'John Doe',
  idNumber: '28374619',
  phone: PhoneHelper.normalize('0712345678'),
  sendStkPush: true,
  callbackUrl: 'https://example.com/payment/success',
  notifyUrl: 'https://example.com/payment/notify',
});

console.log('--- Checkout Target URL ---');
console.log(checkout.url);
console.log('--- Signed Payload ---');
console.log(checkout.payload);

// 2. Generate a ready-to-render payment button HTML form
const html = client.payButton({
  amount: 1500,
  reference: 'INV-1002',
  description: 'Land Rates Clearance',
  name: 'John Doe',
  idNumber: '28374619',
});
console.log('--- HTML Form ---');
console.log(html);
`;
                fs.writeFileSync(filePath, code, 'utf8');
                createdFiles.push(filePath);
                break;
            }
        }
        return createdFiles;
    }
}
