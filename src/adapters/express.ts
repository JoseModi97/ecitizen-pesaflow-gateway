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
export function createExpressWebhookHandler(client: EcitizenClient, options: ExpressWebhookOptions = {}) {
  return async (req: any, res: any, next?: any) => {
    try {
      const payload = req.body || {};
      const result = client.verify(payload);

      if (result.success) {
        if (options.onSuccess) {
          await options.onSuccess(result, req, res);
        }
        if (!res.headersSent) {
          return res.status(200).json({ status: 'ok' });
        }
        return;
      }

      if (options.onFailure) {
        await options.onFailure(result, req, res);
      }

      if (!res.headersSent) {
        return res.status(400).json({
          status: 'error',
          message: result.description || 'Invalid signature or unconfirmed payment status',
        });
      }
    } catch (err: any) {
      if (next) {
        return next(err);
      }
      if (!res.headersSent) {
        return res.status(500).json({ status: 'error', message: err.message });
      }
    }
  };
}
