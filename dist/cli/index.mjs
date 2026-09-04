import * as path from 'path';
import * as fs from 'fs';
import { CliPrompter } from './prompt.mjs';
import { ProjectScaffolder } from './scaffolder.mjs';
import { EcitizenClient } from '../client.mjs';
import { EcitizenGateway } from '../gateway.mjs';
const BANNER = `
\x1b[32m=========================================================\x1b[0m
\x1b[1;32m      eCitizen / PesaFlow Gateway Setup Wizard (CLI)     \x1b[0m
\x1b[32m=========================================================\x1b[0m
Interactive configurator for Node.js, Express, Fastify & Next.js
`;
export async function runCli(argv = process.argv.slice(2)) {
    const command = argv[0] || 'init';
    if (command === '--help' || command === '-h' || command === 'help') {
        printHelp();
        return;
    }
    if (command === '--version' || command === '-v' || command === 'version') {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
        console.log(`ecitizen-pesaflow-gateway v${pkg.version}`);
        return;
    }
    if (command === 'test') {
        await runTestCommand();
        return;
    }
    if (command === 'init') {
        await runInitWizard(argv.slice(1));
        return;
    }
    if (command === 'pay') {
        await runPayCommand(argv.slice(1));
        return;
    }
    if (command === 'status') {
        await runStatusCommand(argv.slice(1));
        return;
    }
    console.log(`\x1b[31mUnknown command: ${command}\x1b[0m\n`);
    printHelp();
    process.exit(1);
}
function printHelp() {
    console.log(`
Usage:
  npx ecitizen-pesaflow [command] [options]
  ecitizen-pesaflow init [options]

Commands:
  init            Interactive setup wizard to configure credentials and controllers (Default)
  pay             Sign and submit a payment prompt directly to eCitizen - no browser/UI required
  status          Poll ECITIZEN_STATUS_URL for the settlement status of a reference
  test            Run cryptographic verification check against test vectors
  help, --help    Show this help message
  --version, -v   Show version

Options for 'init':
  --client-id <id>       eCitizen API Client ID
  --api-key <key>        eCitizen API Key
  --secret <secret>      eCitizen Merchant Secret
  --service-id <id>      eCitizen Service ID
  --url <url>            Payment API endpoint (default: live eCitizen URL)
  --currency <curr>      Default currency code (default: KES)
  --framework <name>     Target: express | fastify | next-app | next-pages | nest | standalone
  --yes, -y              Skip prompts and use defaults or provided flags

Options for 'pay' (credentials read from ECITIZEN_* env vars / .env):
  --amount <n>            Amount to charge (required)
  --reference <ref>       Unique invoice reference (default: auto-generated)
  --description <text>    What the payment is for (required)
  --name <name>           Payer's full name (required)
  --id-number <id>        Payer's National ID / Passport number (required)
  --phone <msisdn>        Payer's phone number, normalized automatically for STK push
  --email <email>         Payer's email
  --currency <curr>       Overrides the configured default currency
  --callback-url <url>    Browser return URL after payment
  --notify-url <url>      Server-to-server webhook URL for settlement confirmation
  --no-send-stk           Do not request an M-Pesa STK push
  --dry-run               Build and print the signed payload without sending it
  --yes, -y               Skip the confirmation prompt before submitting

Options for 'status':
  --reference <ref>       Invoice reference to check (required)
  --status-url <url>      Overrides ECITIZEN_STATUS_URL for this call
`);
}
async function runInitWizard(args) {
    console.log(BANNER);
    const targetDir = process.cwd();
    const envInfo = ProjectScaffolder.detectProjectEnvironment(targetDir);
    // Parse any passed flags
    const flags = {};
    let autoYes = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--yes' || arg === '-y') {
            autoYes = true;
        }
        else if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                flags[key] = next;
                i++;
            }
        }
    }
    const prompter = new CliPrompter();
    try {
        let apiClientID = flags['client-id'] || process.env.ECITIZEN_CLIENT_ID || '';
        let apiKey = flags['api-key'] || process.env.ECITIZEN_API_KEY || '';
        let secret = flags['secret'] || process.env.ECITIZEN_SECRET || '';
        let serviceID = flags['service-id'] || process.env.ECITIZEN_SERVICE_ID || '';
        let gatewayUrl = flags['url'] || process.env.ECITIZEN_GATEWAY_URL || 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php';
        let currency = flags['currency'] || process.env.ECITIZEN_CURRENCY || 'KES';
        let framework = flags['framework'] || envInfo.detectedFramework || 'express';
        if (!autoYes) {
            console.log('\x1b[1mStep 1: Enter your eCitizen / PesaFlow Merchant Credentials\x1b[0m\n');
            apiClientID = await prompter.ask({
                name: 'apiClientID',
                message: 'eCitizen API Client ID',
                default: apiClientID || undefined,
                validate: (val) => val.trim() !== '' ? true : 'API Client ID cannot be empty.',
            });
            apiKey = await prompter.askSecret({
                name: 'apiKey',
                message: 'eCitizen API Key',
                default: apiKey || undefined,
                validate: (val) => val.trim() !== '' ? true : 'API Key cannot be empty.',
            });
            secret = await prompter.askSecret({
                name: 'secret',
                message: 'eCitizen Merchant Secret',
                default: secret || undefined,
                validate: (val) => val.trim() !== '' ? true : 'Merchant Secret cannot be empty.',
            });
            serviceID = await prompter.ask({
                name: 'serviceID',
                message: 'eCitizen Service ID',
                default: serviceID || undefined,
                validate: (val) => val.trim() !== '' ? true : 'Service ID cannot be empty.',
            });
            console.log('\n\x1b[1mStep 2: Endpoint & Currency Configuration\x1b[0m');
            gatewayUrl = await prompter.ask({
                name: 'gatewayUrl',
                message: 'Gateway URL',
                default: gatewayUrl,
            });
            currency = await prompter.ask({
                name: 'currency',
                message: 'Default Currency Code',
                default: currency,
            });
            console.log('\n\x1b[1mStep 3: Target Framework\x1b[0m');
            const frameworkChoices = [
                { label: 'Express.js (creates controllers/paymentController)', value: 'express' },
                { label: 'Fastify (creates routes/paymentRoutes)', value: 'fastify' },
                { label: 'Next.js App Router (app/api/ecitizen/notify/route.ts)', value: 'next-app' },
                { label: 'Next.js Pages Router (pages/api/ecitizen/notify.ts)', value: 'next-pages' },
                { label: 'NestJS controller & service', value: 'nest' },
                { label: 'Standalone / Vanilla Node.js script', value: 'standalone' },
            ];
            const defaultIndex = frameworkChoices.findIndex((c) => c.value === envInfo.detectedFramework);
            framework = (await prompter.select({
                name: 'framework',
                message: 'Select your web framework:',
                choices: frameworkChoices,
                defaultIndex: defaultIndex >= 0 ? defaultIndex : 0,
            }));
            const proceed = await prompter.confirm('\nApply configuration and scaffold files now?', true);
            if (!proceed) {
                console.log('\nSetup aborted by user.');
                prompter.close();
                return;
            }
        }
        prompter.close();
        console.log('\n\x1b[36mGenerating configuration...\x1b[0m');
        const answers = {
            apiClientID,
            apiKey,
            secret,
            serviceID,
            gatewayUrl,
            currency,
            framework,
            targetDir,
            isTypeScript: envInfo.isTypeScript,
            isEsm: envInfo.isEsm,
        };
        // 1. Update .env
        const envFile = ProjectScaffolder.updateEnvFile(targetDir, answers);
        console.log(`  \x1b[32m✔\x1b[0m Configured environment: \x1b[1m${path.basename(envFile)}\x1b[0m`);
        // 2. Create config file
        const configFile = ProjectScaffolder.createConfigFile(targetDir, answers);
        console.log(`  \x1b[32m✔\x1b[0m Created client config: \x1b[1m${path.basename(configFile)}\x1b[0m`);
        // 3. Scaffold controller
        const controllerFiles = ProjectScaffolder.scaffoldController(targetDir, answers);
        controllerFiles.forEach((file) => {
            console.log(`  \x1b[32m✔\x1b[0m Generated payment controller: \x1b[1m${path.relative(targetDir, file)}\x1b[0m`);
        });
        console.log('\n\x1b[32m=========================================================\x1b[0m');
        console.log('\x1b[1;32m  ✔ Setup completed successfully!\x1b[0m');
        console.log('\x1b[32m=========================================================\x1b[0m\n');
        console.log('Next Steps:');
        console.log('1. Review your credentials in .env');
        console.log('2. Make sure your server parses POST body data (e.g. express.urlencoded({ extended: true }))');
        console.log('3. Remember that eCitizen webhooks must be exempt from CSRF validation');
        console.log('4. Run \x1b[36mnpx ecitizen-pesaflow test\x1b[0m anytime to verify HMAC signatures\n');
    }
    catch (err) {
        prompter.close();
        console.error('\n\x1b[31mError during setup:\x1b[0m', err.message);
        process.exit(1);
    }
}
function parseFlags(args) {
    const flags = {};
    const booleans = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--'))
            continue;
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
            flags[key] = next;
            i++;
        }
        else {
            booleans.add(key);
        }
    }
    return { flags, booleans };
}
async function runPayCommand(args) {
    console.log(BANNER);
    console.log('\x1b[1mPrompting a payment directly via the eCitizen PaymentAPI (no browser required)\x1b[0m\n');
    const { flags, booleans } = parseFlags(args);
    const autoYes = booleans.has('yes') || booleans.has('y');
    const dryRun = booleans.has('dry-run');
    const client = new EcitizenClient();
    const prompter = new CliPrompter();
    try {
        const amount = flags['amount'] || (await prompter.ask({
            name: 'amount',
            message: 'Amount to charge',
            validate: (val) => (val.trim() !== '' && !isNaN(Number(val))) ? true : 'Enter a valid amount.',
        }));
        const reference = flags['reference'] || `CLI-${Date.now()}`;
        const description = flags['description'] || (await prompter.ask({
            name: 'description',
            message: 'Description (what is this payment for?)',
            validate: (val) => val.trim() !== '' ? true : 'Description cannot be empty.',
        }));
        const name = flags['name'] || (await prompter.ask({
            name: 'name',
            message: "Payer's full name",
            validate: (val) => val.trim() !== '' ? true : 'Name cannot be empty.',
        }));
        const idNumber = flags['id-number'] || (await prompter.ask({
            name: 'idNumber',
            message: "Payer's National ID / Passport number",
            validate: (val) => val.trim() !== '' ? true : 'ID number cannot be empty.',
        }));
        const phone = flags['phone'] || (await prompter.ask({
            name: 'phone',
            message: "Payer's phone number (for M-Pesa STK push)",
            default: '',
        }));
        prompter.close();
        const payment = {
            amount,
            reference,
            description,
            name,
            idNumber,
            sendStkPush: !booleans.has('no-send-stk'),
        };
        if (phone)
            payment.phone = phone;
        if (flags['email'])
            payment.email = flags['email'];
        if (flags['currency'])
            payment.currency = flags['currency'];
        if (flags['callback-url'])
            payment.callbackUrl = flags['callback-url'];
        if (flags['notify-url'])
            payment.notifyUrl = flags['notify-url'];
        const { url, payload } = client.checkout(payment);
        console.log('\n\x1b[1mSigned checkout payload:\x1b[0m');
        console.log(`  Target URL: \x1b[36m${url}\x1b[0m`);
        for (const [key, value] of Object.entries(payload)) {
            console.log(`  ${key}: ${value}`);
        }
        if (dryRun) {
            console.log('\n\x1b[33m--dry-run set - payload was not sent.\x1b[0m\n');
            return;
        }
        if (!autoYes) {
            const confirmPrompter = new CliPrompter();
            const proceed = await confirmPrompter.confirm('\nSubmit this payment to the LIVE eCitizen PaymentAPI now?', false);
            confirmPrompter.close();
            if (!proceed) {
                console.log('\nAborted. No request was sent.');
                return;
            }
        }
        console.log('\n\x1b[36mSubmitting to eCitizen...\x1b[0m');
        const result = await client.initiatePayment(payment);
        console.log(`\n\x1b[1mHTTP ${result.httpStatus}\x1b[0m`);
        console.log(result.responseBody);
    }
    catch (err) {
        prompter.close();
        console.error('\n\x1b[31mError:\x1b[0m', err.message);
        process.exit(1);
    }
}
async function runStatusCommand(args) {
    console.log(BANNER);
    const { flags } = parseFlags(args);
    const reference = flags['reference'];
    if (!reference) {
        console.error('\x1b[31mMissing required --reference <ref>\x1b[0m\n');
        printHelp();
        process.exit(1);
    }
    const client = new EcitizenClient({
        statusUrl: flags['status-url'] || process.env.ECITIZEN_STATUS_URL || undefined,
    });
    try {
        console.log(`\x1b[36mChecking status for reference:\x1b[0m ${reference}\n`);
        const result = await client.checkPaymentStatus(reference);
        console.log(`\x1b[1mHTTP ${result.httpStatus}\x1b[0m`);
        console.log(result.responseBody);
    }
    catch (err) {
        console.error('\n\x1b[31mError:\x1b[0m', err.message);
        process.exit(1);
    }
}
async function runTestCommand() {
    console.log('\n\x1b[34m--- Running eCitizen / PesaFlow Test Suite ---\x1b[0m\n');
    try {
        const gateway = new EcitizenGateway({
            apiClientID: 'CLIENT1',
            apiKey: 'KEY1',
            secret: 'SECRET1',
            serviceID: 'SERVICE1',
            url: 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php',
        });
        // 1. Test checkout signature calculation
        const payload = gateway.createCheckoutPayload({
            amountExpected: 500,
            billRefNumber: 'INV-0001',
            billDesc: 'School fees',
            clientName: 'Jane Doe',
            clientIDNumber: '12345678',
        });
        if (!payload.secureHash) {
            throw new Error('Checkout payload did not contain secureHash');
        }
        console.log('  \x1b[32m✔\x1b[0m Checkout hash generated successfully: ' + payload.secureHash);
        // 2. Test notification signature verification
        const dataString = 'INV-0001' + '' + '500.00' + '2026-08-17' + 'SECRET1';
        const crypto = await import('crypto');
        const hexDigest = crypto.createHmac('sha256', 'KEY1').update(dataString, 'utf8').digest('hex');
        const expectedHash = Buffer.from(hexDigest, 'utf8').toString('base64');
        const valid = gateway.verifyNotificationHash({
            client_invoice_ref: 'INV-0001',
            amount_paid: '500.00',
            payment_date: '2026-08-17',
            status: 'Settled',
            secure_hash: expectedHash,
        });
        if (!valid) {
            throw new Error('Notification hash verification failed for valid signature');
        }
        console.log('  \x1b[32m✔\x1b[0m Notification IPN hash verification verified against test vector');
        // 3. Test tampered rejection
        const invalid = gateway.verifyNotificationHash({
            client_invoice_ref: 'INV-0001',
            amount_paid: '500.00',
            payment_date: '2026-08-17',
            status: 'Settled',
            secure_hash: 'tampered-hash-123',
        });
        if (invalid) {
            throw new Error('Notification hash verification falsely accepted a tampered signature');
        }
        console.log('  \x1b[32m✔\x1b[0m Tampered signature correctly rejected');
        console.log('\n\x1b[32mAll cryptographic tests passed with 100% vector parity!\x1b[0m\n');
    }
    catch (err) {
        console.error('\n\x1b[31mTest failure:\x1b[0m', err.message);
        process.exit(1);
    }
}
