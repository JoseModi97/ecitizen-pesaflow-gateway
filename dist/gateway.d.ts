import { EcitizenConfig } from './types';
/**
 * Builds and signs eCitizen PaymentAPI checkout payloads, and verifies
 * inbound callback/notification signatures against the same secret.
 *
 * Core engine with zero third-party dependencies using native Node.js crypto.
 */
export declare class EcitizenGateway {
    apiClientID: string;
    apiKey: string;
    secret: string;
    serviceID: string;
    url: string;
    statusUrl: string;
    pictureURL: string;
    currency: string;
    sendSTK: boolean;
    successStatuses: string[];
    constructor(config?: Partial<EcitizenConfig>);
    /**
     * Asserts that all required settings have been configured.
     * @throws Error
     */
    assertConfigured(): void;
    /**
     * Builds a signed checkout payload ready to post/auto-submit to the
     * eCitizen PaymentAPI iframe endpoint.
     */
    createCheckoutPayload(invoice: Record<string, any>): Record<string, string>;
    /**
     * Signature order matches the eCitizen PaymentAPI checkout spec.
     * Concat: apiClientID + amountExpected + serviceID + clientIDNumber + currency + billRefNumber + billDesc + clientName + secret
     * HMAC-SHA256 with key apiKey, Base64-encoded.
     */
    generateCheckoutHash(payload: Record<string, any>): string;
    /**
     * Verifies the secure_hash/secureHash on an inbound callback or
     * notification payload against the configured secret.
     */
    verifyNotificationHash(payload: Record<string, any>): boolean;
    /**
     * True when the payload's status field is one of successStatuses.
     */
    isSuccessStatus(status: any): boolean;
    normalizeAmount(amount: any): string;
    /**
     * eCitizen's secureHash is base64(hex(hmac_sha256(...))) - PHP's
     * hash_hmac() returns a hex string by default, and the reference
     * implementation base64-encodes that hex string directly rather than the
     * raw digest bytes. Node's Hmac#digest('base64') would base64-encode the
     * raw bytes instead, producing a different (shorter, incompatible) hash -
     * so this reproduces PHP's two-step encoding explicitly.
     */
    private hmacSha256HexThenBase64;
    private isTruthy;
}
