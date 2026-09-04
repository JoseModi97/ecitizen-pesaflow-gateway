import { EcitizenClient } from '../client';
import { VerifyResult } from '../types';
export interface ExpressWebhookOptions {
    onSuccess?: (result: VerifyResult, req: any, res: any) => Promise<void> | void;
    onFailure?: (result: VerifyResult, req: any, res: any) => Promise<void> | void;
}
/**
 * Express middleware for verifying eCitizen server-to-server IPN notifications.
 *
 * Usage:
 *   app.post('/payment/notify', createExpressWebhookHandler(client, {
 *     onSuccess: async (result, req, res) => {
 *       console.log('Payment confirmed:', result.reference, result.amountPaid);
 *       // await Order.update({ status: 'paid' }, { where: { id: result.reference } });
 *     }
 *   }));
 */
export declare function createExpressWebhookHandler(client: EcitizenClient, options?: ExpressWebhookOptions): (req: any, res: any, next?: any) => Promise<any>;
