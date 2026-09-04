import { EcitizenClient } from './client';
import { EcitizenGateway } from './gateway';
import { PhoneHelper } from './helpers/phone';
import { EcitizenConfig } from './types';

export * from './types';
export { EcitizenClient } from './client';
export { EcitizenGateway } from './gateway';
export { PhoneHelper } from './helpers/phone';
export { createExpressWebhookHandler, ExpressWebhookOptions } from './adapters/express';
export { createFastifyWebhookHandler, FastifyWebhookOptions } from './adapters/fastify';
export { createNextAppRouteHandler, createNextPagesApiHandler, NextWebhookOptions } from './adapters/next';

/**
 * Convenience factory to create an EcitizenClient instance.
 */
export function createEcitizenClient(config?: Partial<EcitizenConfig>): EcitizenClient {
  return new EcitizenClient(config);
}

export default EcitizenClient;
