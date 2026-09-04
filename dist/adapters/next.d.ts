import { EcitizenClient } from '../client';
import { VerifyResult } from '../types';
export interface NextWebhookOptions {
    onSuccess?: (result: VerifyResult, rawBody: any) => Promise<void> | void;
    onFailure?: (result: VerifyResult, rawBody: any) => Promise<void> | void;
}
/**
 * Next.js App Router route handler helper (e.g. app/api/payment/notify/route.ts).
 *
 * Usage:
 *   export const POST = createNextAppRouteHandler(client, {
 *     onSuccess: async (result) => {
 *       // update database
 *     }
 *   });
 */
export declare function createNextAppRouteHandler(client: EcitizenClient, options?: NextWebhookOptions): (request: any) => Promise<Response>;
/**
 * Next.js Pages Router API handler helper (e.g. pages/api/payment/notify.ts).
 */
export declare function createNextPagesApiHandler(client: EcitizenClient, options?: NextWebhookOptions): (req: any, res: any) => Promise<any>;
