import { EcitizenGateway } from './gateway';
import { PhoneHelper } from './helpers/phone';
import {
  EcitizenConfig,
  PaymentInput,
  CheckoutResult,
  VerifyResult,
  PayButtonOptions,
} from './types';

/**
 * Friendly field mapping from plain-English to underlying eCitizen fields.
 */
const FIELD_MAP: Record<string, string> = {
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
const FIELD_LABELS: Record<string, string> = {
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
  private gateway: EcitizenGateway;

  constructor(settings?: Partial<EcitizenConfig>) {
    const config: Record<string, any> = {
      apiClientID: settings?.apiClientID ?? process.env.ECITIZEN_CLIENT_ID,
      apiKey: settings?.apiKey ?? process.env.ECITIZEN_API_KEY,
      secret: settings?.secret ?? process.env.ECITIZEN_SECRET,
      serviceID: settings?.serviceID ?? process.env.ECITIZEN_SERVICE_ID,
      url: settings?.url ?? process.env.ECITIZEN_GATEWAY_URL ?? 'https://payments.ecitizen.go.ke/PaymentAPI/iframev2.1.php',
      currency: settings?.currency ?? process.env.ECITIZEN_CURRENCY ?? 'KES',
      pictureURL: settings?.pictureURL ?? '',
      sendSTK: settings?.sendSTK ?? false,
      successStatuses: settings?.successStatuses,
    };

    this.assertRequiredSettings(config);

    this.gateway = new EcitizenGateway(config as EcitizenConfig);
  }

  /**
   * Builds and signs a checkout payload.
   * Returns { url, payload } - post payload to url or use payButton() directly.
   */
  public checkout(payment: PaymentInput): CheckoutResult {
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
  public payButton(
    payment: PaymentInput,
    buttonLabel: string = 'Pay with eCitizen',
    buttonOptions: PayButtonOptions = {}
  ): string {
    const checkout = this.checkout(payment);

    const options: PayButtonOptions = {
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
   * Checks a callback/notification payload from eCitizen.
   * Hand the POST body / webhook payload straight to verify(body).
   */
  public verify(callbackData: Record<string, any>): VerifyResult {
    const status = String(callbackData.status ?? '').trim();
    const signatureValid = this.gateway.verifyNotificationHash(callbackData);
    const success = signatureValid && this.gateway.isSuccessStatus(status);

    const reference = String(
      callbackData.client_invoice_ref ?? callbackData.billRefNumber ?? ''
    ).trim();

    const amountPaid = Number(
      callbackData.amount_paid ?? callbackData.amount ?? 0
    );

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
  public isPaid(callbackData: Record<string, any>): boolean {
    return this.verify(callbackData).success;
  }

  /**
   * Access underlying gateway instance.
   */
  public getGateway(): EcitizenGateway {
    return this.gateway;
  }

  private assertRequiredSettings(settings: Record<string, any>): void {
    const required = ['apiClientID', 'apiKey', 'secret', 'serviceID'];
    for (const field of required) {
      const val = settings[field];
      if (val === null || val === undefined || String(val).trim() === '') {
        throw new Error(
          `eCitizen client is missing the required '${field}' setting. ` +
          `Pass it to new EcitizenClient({ ${field}: '...' }) or set process.env.ECITIZEN_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}.`
        );
      }
    }
  }

  private assertRequiredPaymentFields(payment: Record<string, any>): void {
    const required = ['amount', 'reference', 'description', 'name', 'idNumber'];
    for (const field of required) {
      const val = payment[field];
      if (val === null || val === undefined || String(val).trim() === '') {
        const label = FIELD_LABELS[field] || field;
        throw new Error(
          `eCitizen payment is missing: ${label}. Provide it in the checkout/payButton payment object.`
        );
      }
    }
  }

  private translateFields(payment: PaymentInput): Record<string, any> {
    const invoice: Record<string, any> = {};

    for (const [key, val] of Object.entries(payment)) {
      const target = FIELD_MAP[key] || key;
      invoice[target] = val;
    }

    return invoice;
  }

  private escapeAttribute(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeText(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private renderAttributes(attributes: Record<string, any>): string {
    let out = '';
    for (const [key, val] of Object.entries(attributes)) {
      if (val === null || val === undefined || val === false) continue;
      if (val === true) {
        out += ` ${this.escapeAttribute(key)}`;
      } else {
        out += ` ${this.escapeAttribute(key)}="${this.escapeAttribute(String(val))}"`;
      }
    }
    return out;
  }
}
