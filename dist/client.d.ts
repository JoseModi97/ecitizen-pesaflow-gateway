import { EcitizenGateway } from './gateway';
import { EcitizenConfig, PaymentInput, CheckoutResult, VerifyResult, PayButtonOptions } from './types';
/**
 * The easy, beginner-friendly way to use eCitizen payments in Node.js.
 * Plain TypeScript / JavaScript — no framework required.
 */
export declare class EcitizenClient {
    private gateway;
    constructor(settings?: Partial<EcitizenConfig>);
    /**
     * Builds and signs a checkout payload.
     * Returns { url, payload } - post payload to url or use payButton() directly.
     */
    checkout(payment: PaymentInput): CheckoutResult;
    /**
     * Returns a ready-to-render HTML form with a submit button that sends
     * the payer to eCitizen. No frontend JavaScript or iframe wiring required.
     */
    payButton(payment: PaymentInput, buttonLabel?: string, buttonOptions?: PayButtonOptions): string;
    /**
     * Checks a callback/notification payload from eCitizen.
     * Hand the POST body / webhook payload straight to verify(body).
     */
    verify(callbackData: Record<string, any>): VerifyResult;
    /**
     * Shorthand for verify(callbackData).success.
     */
    isPaid(callbackData: Record<string, any>): boolean;
    /**
     * Access underlying gateway instance.
     */
    getGateway(): EcitizenGateway;
    private assertRequiredSettings;
    private assertRequiredPaymentFields;
    private translateFields;
    private escapeAttribute;
    private escapeText;
    private renderAttributes;
}
