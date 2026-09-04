"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNextPagesApiHandler = exports.createNextAppRouteHandler = exports.createFastifyWebhookHandler = exports.createExpressWebhookHandler = exports.PhoneHelper = exports.EcitizenGateway = exports.EcitizenClient = void 0;
exports.createEcitizenClient = createEcitizenClient;
const client_1 = require("./client");
__exportStar(require("./types"), exports);
var client_2 = require("./client");
Object.defineProperty(exports, "EcitizenClient", { enumerable: true, get: function () { return client_2.EcitizenClient; } });
var gateway_1 = require("./gateway");
Object.defineProperty(exports, "EcitizenGateway", { enumerable: true, get: function () { return gateway_1.EcitizenGateway; } });
var phone_1 = require("./helpers/phone");
Object.defineProperty(exports, "PhoneHelper", { enumerable: true, get: function () { return phone_1.PhoneHelper; } });
var express_1 = require("./adapters/express");
Object.defineProperty(exports, "createExpressWebhookHandler", { enumerable: true, get: function () { return express_1.createExpressWebhookHandler; } });
var fastify_1 = require("./adapters/fastify");
Object.defineProperty(exports, "createFastifyWebhookHandler", { enumerable: true, get: function () { return fastify_1.createFastifyWebhookHandler; } });
var next_1 = require("./adapters/next");
Object.defineProperty(exports, "createNextAppRouteHandler", { enumerable: true, get: function () { return next_1.createNextAppRouteHandler; } });
Object.defineProperty(exports, "createNextPagesApiHandler", { enumerable: true, get: function () { return next_1.createNextPagesApiHandler; } });
/**
 * Convenience factory to create an EcitizenClient instance.
 */
function createEcitizenClient(config) {
    return new client_1.EcitizenClient(config);
}
exports.default = client_1.EcitizenClient;
