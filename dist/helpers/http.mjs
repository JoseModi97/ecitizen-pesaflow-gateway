import * as http from 'http';
import * as https from 'https';
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
export function postForm(url, fields) {
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
export function getUrl(url, query = {}) {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(query)) {
        parsed.searchParams.set(key, value);
    }
    return request(parsed.toString(), { method: 'GET' });
}
