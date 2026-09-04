import { EcitizenClient } from '../client';
import { VerifyResult } from '../types';
export interface FastifyWebhookOptions {
    onSuccess?: (result: VerifyResult, request: any, reply: any) => Promise<void> | void;
    onFailure?: (result: VerifyResult, request: any, reply: any) => Promise<void> | void;
}
/**
 * Fastify route handler for verifying eCitizen server-to-server IPN notifications.
 *
 * Usage:
 *   fastify.post('/payment/notify', createFastifyWebhookHandler(client, {
 *     onSuccess: async (result, request, reply) => {
 *       // Handle payment settlement
 *     }
 *   }));
 */
export declare function createFastifyWebhookHandler(client: EcitizenClient, options?: FastifyWebhookOptions): (request: any, reply: any) => Promise<any>;
