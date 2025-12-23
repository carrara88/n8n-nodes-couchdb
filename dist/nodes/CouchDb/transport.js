"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couchDbRequest = couchDbRequest;
async function couchDbRequest(method, endpoint, body) {
    const credentials = await this.getCredentials("couchDbApi");
    const { baseUrl, username, password } = credentials;
    return this.helpers.httpRequest({
        method,
        url: `${baseUrl}${endpoint}`,
        auth: { username, password },
        json: true,
        body,
    });
}
