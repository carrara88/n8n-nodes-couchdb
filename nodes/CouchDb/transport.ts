import { IExecuteFunctions, IHttpRequestMethods } from "n8n-workflow";

export async function couchDbRequest(this: IExecuteFunctions, method: IHttpRequestMethods, endpoint: string, body?: object) {
	const credentials = await this.getCredentials("couchDbApi");
	const { baseUrl, username, password } = credentials as { baseUrl: string; username: string; password: string };
	return this.helpers.httpRequest({
		method,
		url: `${baseUrl}${endpoint}`,
		auth: { username, password },
		json: true,
		body,
	});
}
