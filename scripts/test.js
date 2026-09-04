const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure project is built before testing
if (!fs.existsSync(path.join(__dirname, '../dist/index.cjs'))) {
  require('./build.js');
}

const { EcitizenClient, EcitizenGateway, PhoneHelper, createExpressWebhookHandler } = require('../dist/index.cjs');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    if (err.stack) console.error(err.stack);
    failedTests++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failedTests++;
  }
}

console.log('\n\x1b[1;34m=== Running ecitizen-pesaflow-gateway Test Suite ===\x1b[0m\n');

// 1. PhoneHelper tests
console.log('\x1b[1m1. PhoneHelper Tests\x1b[0m');

test('normalizes 07... numbers to 2547...', () => {
  assert.strictEqual(PhoneHelper.normalize('0712345678'), '254712345678');
});

test('normalizes 01... numbers to 2541...', () => {
  assert.strictEqual(PhoneHelper.normalize('0112345678'), '254112345678');
});

test('normalizes +254... numbers', () => {
  assert.strictEqual(PhoneHelper.normalize('+254712345678'), '254712345678');
});

test('normalizes 9-digit 7... and 1... numbers', () => {
  assert.strictEqual(PhoneHelper.normalize('712345678'), '254712345678');
  assert.strictEqual(PhoneHelper.normalize('112345678'), '254112345678');
});

test('validates Safaricom / Airtel STK push formats', () => {
  assert.strictEqual(PhoneHelper.isValidStkPhone('254712345678'), true);
  assert.strictEqual(PhoneHelper.isValidStkPhone('254112345678'), true);
  assert.strictEqual(PhoneHelper.isValidStkPhone('254812345678'), false);
  assert.strictEqual(PhoneHelper.isValidStkPhone('0712345678'), false); // must be normalized first
});

// 2. EcitizenGateway tests
console.log('\n\x1b[1m2. EcitizenGateway Tests\x1b[0m');

test('throws error on missing required settings', () => {
  assert.throws(() => {
    new EcitizenGateway({ apiClientID: 'CLIENT1' });
  }, /eCitizen gateway 'apiKey' setting is required/);
});

test('allows delayed configuration without throwing in empty constructor', () => {
  const gw = new EcitizenGateway();
  gw.apiClientID = 'CLIENT1';
  gw.apiKey = 'KEY1';
  gw.secret = 'SECRET1';
  gw.serviceID = 'SERVICE1';
  gw.url = 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php';

  const payload = gw.createCheckoutPayload({
    amountExpected: 500,
    billRefNumber: 'INV-0001',
    billDesc: 'School fees',
    clientName: 'Jane Doe',
    clientIDNumber: '12345678',
  });

  assert.strictEqual(payload.apiClientID, 'CLIENT1');
  assert.ok(payload.secureHash);
});

test('delayed configuration throws on use if incomplete', () => {
  const gw = new EcitizenGateway();
  gw.apiClientID = 'CLIENT1';
  assert.throws(() => {
    gw.createCheckoutPayload({
      amountExpected: 500,
      billRefNumber: 'INV-0001',
      billDesc: 'School fees',
      clientName: 'Jane Doe',
      clientIDNumber: '12345678',
    });
  }, /eCitizen gateway 'apiKey' setting is required/);
});

test('createCheckoutPayload produces exact format and HMAC-SHA256 signature', () => {
  const gw = new EcitizenGateway({
    apiClientID: 'CLIENT1',
    apiKey: 'KEY1',
    secret: 'SECRET1',
    serviceID: 'SERVICE1',
    url: 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php',
  });

  const payload = gw.createCheckoutPayload({
    amountExpected: 500,
    billRefNumber: 'INV-0001',
    billDesc: 'School fees',
    clientName: 'Jane Doe',
    clientIDNumber: '12345678',
    sendSTK: true,
  });

  assert.strictEqual(payload.apiClientID, 'CLIENT1');
  assert.strictEqual(payload.serviceID, 'SERVICE1');
  assert.strictEqual(payload.amountExpected, '500.00');
  assert.strictEqual(payload.currency, 'KES');
  assert.strictEqual(payload.billRefNumber, 'INV-0001');
  assert.strictEqual(payload.billDesc, 'School fees');
  assert.strictEqual(payload.clientName, 'Jane Doe');
  assert.strictEqual(payload.clientIDNumber, '12345678');
  assert.strictEqual(payload.sendSTK, 'true');
  assert.ok(payload.secureHash);

  // Cross check hash computation
  const dataString = 'CLIENT1' + '500.00' + 'SERVICE1' + '12345678' + 'KES' + 'INV-0001' + 'School fees' + 'Jane Doe' + 'SECRET1';
  const expected = crypto.createHmac('sha256', 'KEY1').update(dataString, 'utf8').digest('base64');
  assert.strictEqual(payload.secureHash, expected);
});

test('createCheckoutPayload rejects missing fields with clear error', () => {
  const gw = new EcitizenGateway({
    apiClientID: 'CLIENT1',
    apiKey: 'KEY1',
    secret: 'SECRET1',
    serviceID: 'SERVICE1',
  });

  assert.throws(() => {
    gw.createCheckoutPayload({
      amountExpected: 500,
      billRefNumber: 'INV-0001',
      // billDesc missing
      clientName: 'Jane Doe',
      clientIDNumber: '12345678',
    });
  }, /checkout field 'billDesc' is required/);
});

test('verifyNotificationHash validates against test vector', () => {
  const gw = new EcitizenGateway({
    apiClientID: 'CLIENT1',
    apiKey: 'KEY1',
    secret: 'SECRET1',
    serviceID: 'SERVICE1',
  });

  const dataString = 'INV-0001' + '' + '500.00' + '2026-08-17' + 'SECRET1';
  const hash = crypto.createHmac('sha256', 'KEY1').update(dataString, 'utf8').digest('base64');

  const valid = gw.verifyNotificationHash({
    client_invoice_ref: 'INV-0001',
    amount_paid: '500.00',
    payment_date: '2026-08-17',
    status: 'Settled',
    secure_hash: hash,
  });

  assert.strictEqual(valid, true);
  assert.strictEqual(gw.isSuccessStatus('Settled'), true);
  assert.strictEqual(gw.isSuccessStatus('settled'), true);
  assert.strictEqual(gw.isSuccessStatus('PAID'), true);
  assert.strictEqual(gw.isSuccessStatus('failed'), false);
});

test('verifyNotificationHash rejects tampered and missing hash', () => {
  const gw = new EcitizenGateway({
    apiClientID: 'CLIENT1',
    apiKey: 'KEY1',
    secret: 'SECRET1',
    serviceID: 'SERVICE1',
  });

  assert.strictEqual(gw.verifyNotificationHash({
    client_invoice_ref: 'INV-0001',
    amount_paid: '500.00',
    payment_date: '2026-08-17',
    status: 'Settled',
    secure_hash: 'tampered-hash',
  }), false);

  assert.strictEqual(gw.verifyNotificationHash({
    client_invoice_ref: 'INV-0001',
    amount_paid: '500.00',
    status: 'Settled',
  }), false);
});

// 3. EcitizenClient tests
console.log('\n\x1b[1m3. EcitizenClient Tests\x1b[0m');

const CREDENTIALS = {
  apiClientID: 'CLIENT1',
  apiKey: 'KEY1',
  secret: 'SECRET1',
  serviceID: 'SERVICE1',
};

test('gives friendly message when credentials missing', () => {
  assert.throws(() => {
    new EcitizenClient({ apiClientID: 'CLIENT1' });
  }, /missing the required 'apiKey'/);
});

test('defaults URL and Currency when omitted', () => {
  const client = new EcitizenClient(CREDENTIALS);
  assert.strictEqual(client.getGateway().url, 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php');
  assert.strictEqual(client.getGateway().currency, 'KES');
});

test('checkout accepts friendly field names and normalizes phone', () => {
  const client = new EcitizenClient(CREDENTIALS);
  const result = client.checkout({
    amount: 500,
    reference: 'INV-0001',
    description: 'School fees',
    name: 'Jane Doe',
    idNumber: '12345678',
    phone: '0712345678',
  });

  assert.ok(result.url);
  assert.strictEqual(result.payload.billRefNumber, 'INV-0001');
  assert.strictEqual(result.payload.clientMSISDN, '254712345678');
  assert.strictEqual(result.payload.amountExpected, '500.00');
  assert.ok(result.payload.secureHash);
});

test('callbackUrl and successUrl aliases map correctly', () => {
  const client = new EcitizenClient(CREDENTIALS);
  const result = client.checkout({
    amount: 500,
    reference: 'INV-0001',
    description: 'School fees',
    name: 'Jane Doe',
    idNumber: '12345678',
    callbackUrl: 'https://example.com/payment/success',
    notifyUrl: 'https://example.com/payment/notify',
  });

  assert.strictEqual(result.payload.callBackURLOnSuccess, 'https://example.com/payment/success');
  assert.strictEqual(result.payload.notificationURL, 'https://example.com/payment/notify');
});

test('payButton generates form with hidden fields and escaped text', () => {
  const client = new EcitizenClient(CREDENTIALS);
  const html = client.payButton({
    amount: 500,
    reference: 'INV-0001',
    description: 'School fees & books',
    name: 'Jane "Doe"',
    idNumber: '12345678',
  }, 'Pay via eCitizen');

  assert.ok(html.includes('<form action="https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php"'));
  assert.ok(html.includes('name="billRefNumber" value="INV-0001"'));
  assert.ok(html.includes('name="billDesc" value="School fees &amp; books"'));
  assert.ok(html.includes('name="clientName" value="Jane &quot;Doe&quot;"'));
  assert.ok(html.includes('>Pay via eCitizen</button>'));
});

test('verify returns success for valid signed payload', () => {
  const client = new EcitizenClient(CREDENTIALS);

  const dataString = 'INV-0001' + '' + '500.00' + '2026-08-17' + 'SECRET1';
  const hash = crypto.createHmac('sha256', 'KEY1').update(dataString, 'utf8').digest('base64');

  const result = client.verify({
    client_invoice_ref: 'INV-0001',
    amount_paid: '500.00',
    payment_date: '2026-08-17',
    status: 'Settled',
    secure_hash: hash,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.signatureValid, true);
  assert.strictEqual(result.reference, 'INV-0001');
  assert.strictEqual(result.amountPaid, 500);
  assert.strictEqual(client.isPaid({
    client_invoice_ref: 'INV-0001',
    amount_paid: '500.00',
    payment_date: '2026-08-17',
    status: 'Settled',
    secure_hash: hash,
  }), true);
});

test('verify rejects forged payload', () => {
  const client = new EcitizenClient(CREDENTIALS);

  const result = client.verify({
    client_invoice_ref: 'INV-0001',
    amount_paid: '500.00',
    status: 'Settled',
    secure_hash: 'forged_signature',
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.signatureValid, false);
  assert.strictEqual(client.isPaid({
    client_invoice_ref: 'INV-0001',
    secure_hash: 'forged_signature',
  }), false);
});

// 4. Adapters tests
console.log('\n\x1b[1m4. Adapters Tests\x1b[0m');

testAsync('Express webhook handler calls onSuccess and returns 200 json', async () => {
  const client = new EcitizenClient(CREDENTIALS);

  const dataString = 'INV-0001' + '' + '500.00' + '2026-08-17' + 'SECRET1';
  const hash = crypto.createHmac('sha256', 'KEY1').update(dataString, 'utf8').digest('base64');

  let successCalled = false;
  const handler = createExpressWebhookHandler(client, {
    onSuccess: (res) => {
      successCalled = true;
      assert.strictEqual(res.reference, 'INV-0001');
    }
  });

  const req = {
    body: {
      client_invoice_ref: 'INV-0001',
      amount_paid: '500.00',
      payment_date: '2026-08-17',
      status: 'Settled',
      secure_hash: hash,
    }
  };

  let statusCode = 0;
  let responseData = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  await handler(req, res);
  assert.strictEqual(successCalled, true);
  assert.strictEqual(statusCode, 200);
  assert.deepStrictEqual(responseData, { status: 'ok' });
});

// 5. Scaffolder & CLI Tests
console.log('\n\x1b[1m5. ProjectScaffolder Tests\x1b[0m');

test('scaffolder creates .env, config, and express controller in scratch directory', () => {
  const tempDir = path.join(__dirname, '../dist/test_scaffold');
  fs.mkdirSync(tempDir, { recursive: true });

  const { ProjectScaffolder } = require('../dist/cli/scaffolder.cjs');

  const answers = {
    apiClientID: 'TEST_ID',
    apiKey: 'TEST_KEY',
    secret: 'TEST_SECRET',
    serviceID: 'TEST_SVC',
    gatewayUrl: 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php',
    currency: 'KES',
    framework: 'express',
    targetDir: tempDir,
    isTypeScript: false,
    isEsm: false,
  };

  const envFile = ProjectScaffolder.updateEnvFile(tempDir, answers);
  assert.ok(fs.existsSync(envFile));
  const envContent = fs.readFileSync(envFile, 'utf8');
  assert.ok(envContent.includes('ECITIZEN_CLIENT_ID="TEST_ID"'));

  const configFile = ProjectScaffolder.createConfigFile(tempDir, answers);
  assert.ok(fs.existsSync(configFile));
  const configContent = fs.readFileSync(configFile, 'utf8');
  assert.ok(configContent.includes('new EcitizenClient'));

  const controllerFiles = ProjectScaffolder.scaffoldController(tempDir, answers);
  assert.strictEqual(controllerFiles.length, 1);
  assert.ok(fs.existsSync(controllerFiles[0]));
  const controllerContent = fs.readFileSync(controllerFiles[0], 'utf8');
  assert.ok(controllerContent.includes('paymentRouter.get(\'/pay\''));
  assert.ok(controllerContent.includes('createExpressWebhookHandler'));

  // Clean up temp dir
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// 6. ESM compatibility test
console.log('\n\x1b[1m6. ESM Module Compatibility Tests\x1b[0m');

testAsync('loads successfully via ESM import()', async () => {
  const esmModule = await import('../dist/index.mjs');
  assert.ok(esmModule.EcitizenClient, 'EcitizenClient should be exported in ESM');
  assert.ok(esmModule.EcitizenGateway, 'EcitizenGateway should be exported in ESM');
  assert.ok(esmModule.PhoneHelper, 'PhoneHelper should be exported in ESM');
  assert.ok(esmModule.default, 'default export should be present in ESM');
  assert.strictEqual(PhoneHelper.normalize('0722000000'), '254722000000');
});

console.log(`\n\x1b[1mTest Results: \x1b[32m${passedTests} passed\x1b[0m, \x1b[31m${failedTests} failed\x1b[0m\n`);

if (failedTests > 0) {
  process.exit(1);
}
