"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFastifyWebhookHandler = createFastifyWebhookHandler;
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
function createFastifyWebhookHandler(client, options = {}) {
    return async (request, reply) => {
        try {
            const payload = request.body || {};
            const result = client.verify(payload);
            if (result.success) {
                if (options.onSuccess) {
                    await options.onSuccess(result, request, reply);
                }
                if (!reply.sent) {
                    return reply.code(200).send({ status: 'ok' });
                }
                return;
            }
            if (options.onFailure) {
                await options.onFailure(result, request, reply);
            }
            if (!reply.sent) {
                return reply.code(400).send({
                    status: 'error',
                    message: result.description || 'Invalid signature or unconfirmed payment status',
                });
            }
        }
        catch (err) {
            if (!reply.sent) {
                return reply.code(500).send({ status: 'error', message: err.message });
            }
        }
    };
}
