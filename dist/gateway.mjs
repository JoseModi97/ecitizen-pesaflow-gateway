import * as crypto from 'crypto';
/**
 * Builds and signs eCitizen PaymentAPI checkout payloads, and verifies
 * inbound callback/notification signatures against the same secret.
 *
 * Core engine with zero third-party dependencies using native Node.js crypto.
 */
export class EcitizenGateway {
    apiClientID = '';
    apiKey = '';
    secret = '';
    serviceID = '';
    url = 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php';
    statusUrl = '';
    pictureURL = '';
    currency = 'KES';
    sendSTK = false;
    successStatuses = ['paid', 'settled', 'success', 'successful', 'completed', 'complete'];
    constructor(config) {
        if (config && Object.keys(config).length > 0) {
            if (config.apiClientID !== undefined)
                this.apiClientID = String(config.apiClientID);
            if (config.apiKey !== undefined)
                this.apiKey = String(config.apiKey);
            if (config.secret !== undefined)
                this.secret = String(config.secret);
            if (config.serviceID !== undefined)
                this.serviceID = String(config.serviceID);
            if (config.url !== undefined)
                this.url = String(config.url);
            if (config.statusUrl !== undefined)
                this.statusUrl = String(config.statusUrl);
            if (config.pictureURL !== undefined)
                this.pictureURL = String(config.pictureURL);
            if (config.currency !== undefined)
                this.currency = String(config.currency);
            if (config.sendSTK !== undefined)
                this.sendSTK = Boolean(config.sendSTK);
            if (config.successStatuses !== undefined && Array.isArray(config.successStatuses)) {
                this.successStatuses = config.successStatuses.map((s) => s.toLowerCase());
            }
            this.assertConfigured();
        }
    }
    /**
     * Asserts that all required settings have been configured.
     * @throws Error
     */
    assertConfigured() {
        const required = [
            'apiClientID',
            'apiKey',
            'secret',
            'serviceID',
            'url',
        ];
        for (const attribute of required) {
            const val = this[attribute];
            if (val === null || val === undefined || String(val).trim() === '') {
                throw new Error(`The eCitizen gateway '${attribute}' setting is required.`);
            }
        }
    }
    /**
     * Builds a signed checkout payload ready to post/auto-submit to the
     * eCitizen PaymentAPI iframe endpoint.
     */
    createCheckoutPayload(invoice) {
        this.assertConfigured();
        const amount = this.normalizeAmount(invoice.amountExpected ?? invoice.amount ?? null);
        const billRefNumber = String(invoice.billRefNumber ?? '').trim();
        const billDesc = String(invoice.billDesc ?? '').trim();
        const clientName = String(invoice.clientName ?? '').trim();
        const clientIDNumber = String(invoice.clientIDNumber ?? '').trim();
        const sendSTK = invoice.sendSTK !== undefined ? invoice.sendSTK : this.sendSTK;
        const requiredFields = {
            amountExpected: amount,
            billRefNumber,
            billDesc,
            clientName,
            clientIDNumber,
        };
        for (const [field, value] of Object.entries(requiredFields)) {
            if (value === '') {
                throw new Error(`The eCitizen checkout field '${field}' is required.`);
            }
        }
        const payload = {
            apiClientID: String(this.apiClientID),
            serviceID: String(this.serviceID),
            billDesc,
            currency: String(invoice.currency ?? this.currency),
            billRefNumber,
            clientMSISDN: String(invoice.clientMSISDN ?? '').trim(),
            clientName,
            clientIDNumber,
            clientEmail: String(invoice.clientEmail ?? '').trim(),
            callBackURLOnSuccess: String(invoice.callBackURLOnSuccess ?? ''),
            amountExpected: amount,
            notificationURL: String(invoice.notificationURL ?? ''),
            pictureURL: String(invoice.pictureURL ?? this.pictureURL),
            format: String(invoice.format ?? 'iframe'),
        };
        if (this.isTruthy(sendSTK)) {
            payload.sendSTK = 'true';
        }
        payload.secureHash = this.generateCheckoutHash(payload);
        return payload;
    }
    /**
     * Signature order matches the eCitizen PaymentAPI checkout spec.
     * Concat: apiClientID + amountExpected + serviceID + clientIDNumber + currency + billRefNumber + billDesc + clientName + secret
     * HMAC-SHA256 with key apiKey, Base64-encoded.
     */
    generateCheckoutHash(payload) {
        this.assertConfigured();
        const dataString = String(this.apiClientID) +
            String(payload.amountExpected ?? '') +
            String(this.serviceID) +
            String(payload.clientIDNumber ?? '') +
            String(payload.currency ?? '') +
            String(payload.billRefNumber ?? '') +
            String(payload.billDesc ?? '') +
            String(payload.clientName ?? '') +
            String(this.secret);
        return this.hmacSha256HexThenBase64(dataString);
    }
    /**
     * Verifies the secure_hash/secureHash on an inbound callback or
     * notification payload against the configured secret.
     */
    verifyNotificationHash(payload) {
        this.assertConfigured();
        const providedHash = String(payload.secure_hash ?? payload.secureHash ?? '').trim();
        if (providedHash === '') {
            return false;
        }
        const dataString = String(payload.client_invoice_ref ?? payload.billRefNumber ?? '') +
            String(payload.invoice_number ?? '') +
            String(payload.amount_paid ?? payload.amount ?? '') +
            String(payload.payment_date ?? '') +
            String(this.secret);
        const expectedHash = this.hmacSha256HexThenBase64(dataString);
        const expectedBuffer = Buffer.from(expectedHash, 'utf8');
        const providedBuffer = Buffer.from(providedHash, 'utf8');
        if (expectedBuffer.length !== providedBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    }
    /**
     * True when the payload's status field is one of successStatuses.
     */
    isSuccessStatus(status) {
        if (status === null || status === undefined) {
            return false;
        }
        const cleanStatus = String(status).trim().toLowerCase();
        return this.successStatuses.includes(cleanStatus);
    }
    normalizeAmount(amount) {
        if (amount === null || amount === undefined || amount === '') {
            return '';
        }
        const num = Number(amount);
        if (isNaN(num)) {
            return '';
        }
        return num.toFixed(2);
    }
    /**
     * eCitizen's secureHash is base64(hex(hmac_sha256(...))) - PHP's
     * hash_hmac() returns a hex string by default, and the reference
     * implementation base64-encodes that hex string directly rather than the
     * raw digest bytes. Node's Hmac#digest('base64') would base64-encode the
     * raw bytes instead, producing a different (shorter, incompatible) hash -
     * so this reproduces PHP's two-step encoding explicitly.
     */
    hmacSha256HexThenBase64(dataString) {
        const hex = crypto.createHmac('sha256', String(this.apiKey)).update(dataString, 'utf8').digest('hex');
        return Buffer.from(hex, 'utf8').toString('base64');
    }
    isTruthy(value) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'number')
            return value === 1;
        if (typeof value === 'string') {
            const s = value.trim().toLowerCase();
            return s === 'true' || s === '1' || s === 'yes' || s === 'on';
        }
        return false;
    }
}
