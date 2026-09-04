import { EcitizenGateway } from './gateway.mjs';
import { PhoneHelper } from './helpers/phone.mjs';
import { postForm, getUrl } from './helpers/http.mjs';
/**
 * Friendly field mapping from plain-English to underlying eCitizen fields.
 */
const FIELD_MAP = {
    amount: 'amountExpected',
    reference: 'billRefNumber',
    description: 'billDesc',
    name: 'clientName',
    idNumber: 'clientIDNumber',
    phone: 'clientMSISDN',
    email: 'clientEmail',
    currency: 'currency',
    callbackUrl: 'callBackURLOnSuccess',
    successUrl: 'callBackURLOnSuccess',
    notifyUrl: 'notificationURL',
    sendStkPush: 'sendSTK',
    pictureURL: 'pictureURL',
    format: 'format',
};
/**
 * Friendly labels used in error messages.
 */
const FIELD_LABELS = {
    amount: 'amount (how much to charge, e.g. 500)',
    reference: "reference (a unique ID for this payment, e.g. 'INV-0001')",
    description: "description (what the payment is for, e.g. 'School fees')",
    name: "name (the payer's full name)",
    idNumber: "idNumber (the payer's National ID or Passport number)",
};
/**
 * The easy, beginner-friendly way to use eCitizen payments in Node.js.
 * Plain TypeScript / JavaScript — no framework required.
 */
export class EcitizenClient {
    gateway;
    constructor(settings) {
        const config = {
            apiClientID: settings?.apiClientID ?? process.env.ECITIZEN_CLIENT_ID,
            apiKey: settings?.apiKey ?? process.env.ECITIZEN_API_KEY,
            secret: settings?.secret ?? process.env.ECITIZEN_SECRET,
            serviceID: settings?.serviceID ?? process.env.ECITIZEN_SERVICE_ID,
            url: settings?.url ?? process.env.ECITIZEN_GATEWAY_URL ?? 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php',
            statusUrl: settings?.statusUrl ?? process.env.ECITIZEN_STATUS_URL ?? '',
            currency: settings?.currency ?? process.env.ECITIZEN_CURRENCY ?? 'KES',
            pictureURL: settings?.pictureURL ?? '',
            sendSTK: settings?.sendSTK ?? false,
            successStatuses: settings?.successStatuses,
        };
        this.assertRequiredSettings(config);
        this.gateway = new EcitizenGateway(config);
    }
    /**
     * Builds and signs a checkout payload.
     * Returns { url, payload } - post payload to url or use payButton() directly.
     */
    checkout(payment) {
        this.assertRequiredPaymentFields(payment);
        const invoice = this.translateFields(payment);
        if (invoice.clientMSISDN) {
            invoice.clientMSISDN = PhoneHelper.normalize(invoice.clientMSISDN);
        }
        const payload = this.gateway.createCheckoutPayload(invoice);
        return {
            url: this.gateway.url,
            payload,
        };
    }
    /**
     * Returns a ready-to-render HTML form with a submit button that sends
     * the payer to eCitizen. No frontend JavaScript or iframe wiring required.
     */
    payButton(payment, buttonLabel = 'Pay with eCitizen', buttonOptions = {}) {
        const checkout = this.checkout(payment);
        const options = {
            class: 'btn btn-primary',
            ...buttonOptions,
        };
        let html = `<form action="${this.escapeAttribute(checkout.url)}" method="post" target="${this.escapeAttribute(options.target || '_blank')}">`;
        for (const [field, value] of Object.entries(checkout.payload)) {
            html += `<input type="hidden" name="${this.escapeAttribute(field)}" value="${this.escapeAttribute(String(value))}">`;
        }
        // Remove target from button attributes if present
        const btnOpts = { ...options };
        delete btnOpts.target;
        html += `<button type="submit"${this.renderAttributes(btnOpts)}>${this.escapeText(buttonLabel)}</button>`;
        html += '</form>';
        return html;
    }
    /**
     * Signs a checkout payload and submits it directly to the eCitizen
     * PaymentAPI from the server - no browser, no HTML form. Use this to
     * prompt/initiate a payment (e.g. trigger an M-Pesa STK push) from a
     * plain Node.js script, API route, or CLI, with no user interface at all.
     *
     * Returns the raw HTTP response so callers can inspect exactly what
     * eCitizen sent back.
     */
    async initiatePayment(payment) {
        const { url, payload } = this.checkout(payment);
        const response = await postForm(url, payload);
        return {
            requestUrl: url,
            requestPayload: payload,
            httpStatus: response.httpStatus,
            responseBody: response.body,
        };
    }
    /**
     * Polls the configured status endpoint (ECITIZEN_STATUS_URL /
     * `statusUrl` config option) for the settlement status of a previously
     * submitted invoice reference.
     */
    async checkPaymentStatus(reference, extraParams = {}) {
        const statusUrl = this.gateway.statusUrl;
        if (!statusUrl) {
            throw new Error('checkPaymentStatus() requires a status URL. Pass { statusUrl: "..." } to new EcitizenClient(...) ' +
                'or set process.env.ECITIZEN_STATUS_URL.');
        }
        const response = await getUrl(statusUrl, {
            apiClientID: this.gateway.apiClientID,
            serviceID: this.gateway.serviceID,
            billRefNumber: reference,
            ...extraParams,
        });
        return {
            requestUrl: response.requestUrl,
            httpStatus: response.httpStatus,
            responseBody: response.body,
        };
    }
    /**
     * Checks a callback/notification payload from eCitizen.
     * Hand the POST body / webhook payload straight to verify(body).
     */
    verify(callbackData) {
        const status = String(callbackData.status ?? '').trim();
        const signatureValid = this.gateway.verifyNotificationHash(callbackData);
        const success = signatureValid && this.gateway.isSuccessStatus(status);
        const reference = String(callbackData.client_invoice_ref ?? callbackData.billRefNumber ?? '').trim();
        const amountPaid = Number(callbackData.amount_paid ?? callbackData.amount ?? 0);
        return {
            success,
            signatureValid,
            status,
            reference,
            amountPaid: isNaN(amountPaid) ? 0 : amountPaid,
            raw: callbackData,
            description: callbackData.description ?? callbackData.billDesc ?? (success ? 'Payment verified successfully' : 'Payment verification failed'),
        };
    }
    /**
     * Shorthand for verify(callbackData).success.
     */
    isPaid(callbackData) {
        return this.verify(callbackData).success;
    }
    /**
     * Access underlying gateway instance.
     */
    getGateway() {
        return this.gateway;
    }
    assertRequiredSettings(settings) {
        const required = ['apiClientID', 'apiKey', 'secret', 'serviceID'];
        for (const field of required) {
            const val = settings[field];
            if (val === null || val === undefined || String(val).trim() === '') {
                throw new Error(`eCitizen client is missing the required '${field}' setting. ` +
                    `Pass it to new EcitizenClient({ ${field}: '...' }) or set process.env.ECITIZEN_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}.`);
            }
        }
    }
    assertRequiredPaymentFields(payment) {
        const required = ['amount', 'reference', 'description', 'name', 'idNumber'];
        for (const field of required) {
            const val = payment[field];
            if (val === null || val === undefined || String(val).trim() === '') {
                const label = FIELD_LABELS[field] || field;
                throw new Error(`eCitizen payment is missing: ${label}. Provide it in the checkout/payButton payment object.`);
            }
        }
    }
    translateFields(payment) {
        const invoice = {};
        for (const [key, val] of Object.entries(payment)) {
            const target = FIELD_MAP[key] || key;
            invoice[target] = val;
        }
        return invoice;
    }
    escapeAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    escapeText(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    renderAttributes(attributes) {
        let out = '';
        for (const [key, val] of Object.entries(attributes)) {
            if (val === null || val === undefined || val === false)
                continue;
            if (val === true) {
                out += ` ${this.escapeAttribute(key)}`;
            }
            else {
                out += ` ${this.escapeAttribute(key)}="${this.escapeAttribute(String(val))}"`;
            }
        }
        return out;
    }
}
