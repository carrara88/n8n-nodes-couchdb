"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouchDbApi = void 0;
class CouchDbApi {
    name = 'couchDbApi';
    displayName = 'CouchDB API';
    properties = [
        { displayName: 'Base URL', name: 'baseUrl', type: 'string', default: 'http://localhost:5984', required: true },
        { displayName: 'Username', name: 'username', type: 'string', default: '' },
        { displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '' }
    ];
}
exports.CouchDbApi = CouchDbApi;
