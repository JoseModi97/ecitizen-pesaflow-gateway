export interface EcitizenConfig {
  apiClientID: string;
  apiKey: string;
  secret: string;
  serviceID: string;
  url?: string;
  statusUrl?: string;
  pictureURL?: string;
  currency?: string;
  sendSTK?: boolean;
  successStatuses?: string[];
}

export interface PaymentInput {
  amount: number | string;
  reference: string;
  description: string;
  name: string;
  idNumber: string;
  phone?: string;
  email?: string;
  currency?: string;
  callbackUrl?: string;
  successUrl?: string; // alias for callbackUrl
  notifyUrl?: string;
  sendStkPush?: boolean;
  pictureURL?: string;
  format?: string;
  [key: string]: any;
}

export interface CheckoutResult {
  url: string;
  payload: Record<string, string>;
}

export interface PaymentSubmissionResult {
  requestUrl: string;
  requestPayload: Record<string, string>;
  httpStatus: number;
  responseBody: string;
}

export interface PaymentStatusResult {
  requestUrl: string;
  httpStatus: number;
  responseBody: string;
}

export interface VerifyResult {
  success: boolean;
  signatureValid: boolean;
  status: string;
  reference: string;
  amountPaid: number;
  raw: Record<string, any>;
  description?: string;
}

export interface PayButtonOptions {
  class?: string;
  id?: string;
  target?: string;
  style?: string;
  [key: string]: any;
}
