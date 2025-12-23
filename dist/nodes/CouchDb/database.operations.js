"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseOperations = databaseOperations;
const transport_1 = require("./transport");
async function databaseOperations() {
    const operation = this.getNodeParameter('operation', 0);
    const db = this.getNodeParameter('db', 0, '');
    if (operation === 'list') {
        const res = await transport_1.couchDbRequest.call(this, 'GET', '/_all_dbs');
        return this.helpers.returnJsonArray(res.map((name) => ({ name })));
    }
    if (operation === 'create') {
        await transport_1.couchDbRequest.call(this, 'PUT', `/${db}`);
        return [{ json: { success: true, db } }];
    }
    if (operation === 'delete') {
        await transport_1.couchDbRequest.call(this, 'DELETE', `/${db}`);
        return [{ json: { success: true, db } }];
    }
    throw new Error('Unsupported database operation');
}
