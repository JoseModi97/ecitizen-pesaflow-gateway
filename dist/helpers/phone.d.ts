/**
 * Normalizes Kenyan MSISDNs to the 2547XXXXXXXX / 2541XXXXXXXX format that
 * eCitizen's sendSTK expects, and validates the result.
 */
export declare class PhoneHelper {
    /**
     * Normalizes Kenyan phone numbers to 254XXXXXXXXX format.
     * Handles formats like:
     * - 0712345678 -> 254712345678
     * - 0112345678 -> 254112345678
     * - +254712345678 -> 254712345678
     * - 712345678 -> 254712345678
     * - 112345678 -> 254112345678
     */
    static normalize(phone: string | number): string;
    /**
     * Matches valid Safaricom/Airtel MSISDNs in STK push format: 2547XXXXXXXX or 2541XXXXXXXX.
     */
    static isValidStkPhone(normalizedPhone: string): boolean;
}
