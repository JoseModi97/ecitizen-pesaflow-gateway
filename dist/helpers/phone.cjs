"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneHelper = void 0;
/**
 * Normalizes Kenyan MSISDNs to the 2547XXXXXXXX / 2541XXXXXXXX format that
 * eCitizen's sendSTK expects, and validates the result.
 */
class PhoneHelper {
    /**
     * Normalizes Kenyan phone numbers to 254XXXXXXXXX format.
     * Handles formats like:
     * - 0712345678 -> 254712345678
     * - 0112345678 -> 254112345678
     * - +254712345678 -> 254712345678
     * - 712345678 -> 254712345678
     * - 112345678 -> 254112345678
     */
    static normalize(phone) {
        if (phone === null || phone === undefined) {
            return '';
        }
        const raw = String(phone);
        const digits = raw.replace(/\D+/g, '');
        if (digits.startsWith('254')) {
            return digits;
        }
        if (digits.startsWith('0')) {
            return '254' + digits.slice(1);
        }
        if (/^[17]\d{8}$/.test(digits)) {
            return '254' + digits;
        }
        return digits;
    }
    /**
     * Matches valid Safaricom/Airtel MSISDNs in STK push format: 2547XXXXXXXX or 2541XXXXXXXX.
     */
    static isValidStkPhone(normalizedPhone) {
        return /^254[17]\d{8}$/.test(normalizedPhone);
    }
}
exports.PhoneHelper = PhoneHelper;
