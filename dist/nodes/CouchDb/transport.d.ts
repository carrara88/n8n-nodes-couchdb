import { IExecuteFunctions, IHttpRequestMethods } from "n8n-workflow";
export declare function couchDbRequest(this: IExecuteFunctions, method: IHttpRequestMethods, endpoint: string, body?: object): Promise<any>;
