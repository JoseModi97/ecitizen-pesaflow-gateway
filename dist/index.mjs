import { EcitizenClient } from './client.mjs';
export * from './types.mjs';
export { EcitizenClient } from './client.mjs';
export { EcitizenGateway } from './gateway.mjs';
export { PhoneHelper } from './helpers/phone.mjs';
export { createExpressWebhookHandler } from './adapters/express.mjs';
export { createFastifyWebhookHandler } from './adapters/fastify.mjs';
export { createNextAppRouteHandler, createNextPagesApiHandler } from './adapters/next.mjs';
/**
 * Convenience factory to create an EcitizenClient instance.
 */
export function createEcitizenClient(config) {
    return new EcitizenClient(config);
}
export default EcitizenClient;
