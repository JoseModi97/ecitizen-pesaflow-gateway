export interface HttpResult {
    requestUrl: string;
    httpStatus: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
}
export declare function postForm(url: string, fields: Record<string, string>): Promise<HttpResult>;
export declare function getUrl(url: string, query?: Record<string, string>): Promise<HttpResult>;
