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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.postForm = postForm;
exports.getUrl = getUrl;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
/**
 * Minimal zero-dependency HTTP client (node:http / node:https only) used to
 * talk to the eCitizen PaymentAPI directly from the server - no browser,
 * no HTML form submission required.
 */
function request(url, options) {
    return new Promise((resolve, reject) => {
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch (err) {
            reject(new Error(`Invalid URL: ${url}`));
            return;
        }
        const transport = parsed.protocol === 'http:' ? http : https;
        const req = transport.request(parsed, {
            method: options.method,
            headers: options.headers,
        }, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                resolve({
                    requestUrl: url,
                    httpStatus: res.statusCode || 0,
                    headers: res.headers,
                    body: data,
                });
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}
function postForm(url, fields) {
    const body = Object.entries(fields)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    return request(url, {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': String(Buffer.byteLength(body)),
        },
    });
}
function getUrl(url, query = {}) {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(query)) {
        parsed.searchParams.set(key, value);
    }
    return request(parsed.toString(), { method: 'GET' });
}
