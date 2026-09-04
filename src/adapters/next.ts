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
export function createNextAppRouteHandler(client: EcitizenClient, options: NextWebhookOptions = {}) {
  return async (request: any) => {
    try {
      let body: any;
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        body = Object.fromEntries(formData.entries());
      } else {
        const text = await request.text();
        try {
          body = JSON.parse(text);
        } catch {
          body = Object.fromEntries(new URLSearchParams(text).entries());
        }
      }

      const result = client.verify(body);

      if (result.success) {
        if (options.onSuccess) {
          await options.onSuccess(result, body);
        }
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (options.onFailure) {
        await options.onFailure(result, body);
      }

      return new Response(
        JSON.stringify({
          status: 'error',
          message: result.description || 'Invalid signature or unconfirmed payment status',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ status: 'error', message: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * Next.js Pages Router API handler helper (e.g. pages/api/payment/notify.ts).
 */
export function createNextPagesApiHandler(client: EcitizenClient, options: NextWebhookOptions = {}) {
  return async (req: any, res: any) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    }

    try {
      const payload = req.body || {};
      const result = client.verify(payload);

      if (result.success) {
        if (options.onSuccess) {
          await options.onSuccess(result, payload);
        }
        return res.status(200).json({ status: 'ok' });
      }

      if (options.onFailure) {
        await options.onFailure(result, payload);
      }

      return res.status(400).json({
        status: 'error',
        message: result.description || 'Invalid signature or unconfirmed payment status',
      });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  };
}
