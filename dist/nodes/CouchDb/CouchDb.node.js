"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouchDb = void 0;
const database_operations_1 = require("./database.operations");
const document_operations_1 = require("./document.operations");
class CouchDb {
    description = {
        displayName: 'CouchDB',
        icon: 'file:logo.svg',
        name: 'couchDb',
        group: ['transform'],
        version: 1,
        description: 'Interact with Apache CouchDB',
        defaults: { name: 'CouchDB' },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [{ name: 'couchDbApi', required: true }],
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                options: [
                    { name: 'Database', value: 'database' },
                    { name: 'Document', value: 'document' }
                ],
                default: 'database'
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                displayOptions: { show: { resource: ['database'] } },
                options: [
                    { name: 'List Databases', value: 'list' },
                    { name: 'Create Database', value: 'create' },
                    { name: 'Delete Database', value: 'delete' }
                ],
                default: 'list'
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                displayOptions: { show: { resource: ['document'] } },
                options: [
                    { name: 'Create', value: 'create' },
                    { name: 'Get', value: 'get' },
                    { name: 'Find', value: 'find' },
                    { name: 'List Documents', value: 'listDocs' },
                    { name: 'Get Attachment', value: 'getAttachment' },
                    { name: 'Put Attachment', value: 'putAttachment' },
                    { name: 'Delete Attachment', value: 'deleteAttachment' },
                    { name: 'Update', value: 'update' },
                    { name: 'Delete', value: 'delete' },
                    { name: 'Purge', value: 'purge' }
                ],
                default: 'get'
            },
            {
                displayName: 'Database',
                name: 'db',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getDatabases'
                },
                default: '',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['document', 'database'],
                        operation: ['create', 'delete', 'get', 'update', 'purge', 'find', 'listDocs', 'getAttachment', 'putAttachment', 'deleteAttachment']
                    }
                }
            },
            {
                displayName: 'Document ID',
                name: 'docId',
                type: 'string',
                default: '',
                displayOptions: { show: { resource: ['document'], operation: ['get', 'update', 'delete', 'purge', 'getAttachment', 'putAttachment', 'deleteAttachment'] } }
            },
            {
                displayName: 'Attachment Name',
                name: 'attachmentName',
                type: 'string',
                default: '',
                description: 'Attachment file name',
                displayOptions: { show: { resource: ['document'], operation: ['getAttachment', 'putAttachment', 'deleteAttachment'] } }
            },
            {
                displayName: 'Attachment Data (base64)',
                name: 'attachmentData',
                type: 'string',
                default: '',
                description: 'Base64-encoded content to upload',
                displayOptions: { show: { resource: ['document'], operation: ['putAttachment'] } }
            },
            {
                displayName: 'Attachment Content Type',
                name: 'attachmentContentType',
                type: 'string',
                default: 'application/octet-stream',
                description: 'MIME type for the attachment',
                displayOptions: { show: { resource: ['document'], operation: ['putAttachment'] } }
            },
            {
                displayName: 'Return Full Document',
                name: 'returnFullDocument',
                type: 'boolean',
                default: true,
                description: 'If false, return only _id and _rev for get',
                displayOptions: { show: { resource: ['document'], operation: ['get'] } }
            },
            {
                displayName: 'Revision',
                name: 'rev',
                type: 'string',
                default: '',
                displayOptions: { show: { resource: ['document'], operation: ['purge'] } },
                description: 'Required only for purge; update/delete fetch revision automatically'
            },
            {
                displayName: 'Revision',
                name: 'getRev',
                type: 'string',
                default: '',
                description: 'If set, fetches a specific document revision',
                displayOptions: { show: { resource: ['document'], operation: ['get'] } }
            },
            {
                displayName: 'Filter (Mango selector)',
                name: 'filter',
                type: 'json',
                default: '{}',
                description: 'When set, applies a CouchDB Mango selector. Overrides Document ID for get/update/delete/find.',
                displayOptions: { show: { resource: ['document'], operation: ['get', 'update', 'delete', 'find'] } }
            },
            {
                displayName: 'Simple Filters',
                name: 'simpleFilters',
                type: 'fixedCollection',
                typeOptions: { multipleValues: true },
                default: {},
                placeholder: 'Add filter',
                description: 'Quick equals filters (dot notation) merged into the selector',
                options: [
                    {
                        name: 'rule',
                        displayName: 'Rule',
                        values: [
                            { displayName: 'Field (dot notation)', name: 'field', type: 'string', default: '' },
                            { displayName: 'Value', name: 'value', type: 'string', default: '' }
                        ]
                    }
                ],
                displayOptions: { show: { resource: ['document'], operation: ['get', 'find', 'update', 'delete'] } }
            },
            {
                displayName: 'Include Attachments',
                name: 'attachments',
                type: 'boolean',
                default: false,
                description: 'Include attachment data (base64) when fetching a document',
                displayOptions: { show: { resource: ['document'], operation: ['get'] } }
            },
            {
                displayName: 'Attachment Encoding Info',
                name: 'attEncodingInfo',
                type: 'boolean',
                default: false,
                description: 'Include compressed size/codec info for attachments',
                displayOptions: { show: { resource: ['document'], operation: ['get'] } }
            },
            {
                displayName: 'Attachments Since (revs array)',
                name: 'attsSince',
                type: 'json',
                default: '[]',
                description: 'Array of revision strings; attachments newer than these will be included',
                displayOptions: { show: { resource: ['document'], operation: ['get'] } }
            },
            {
                displayName: 'Include Revisions Tree',
                name: 'revs',
                type: 'boolean',
                default: false,
                description: 'If true, include _revisions in the document',
                displayOptions: { show: { resource: ['document'], operation: ['get'] } }
            },
            {
                displayName: 'Include Revisions Info',
                name: 'revsInfo',
                type: 'boolean',
                default: false,
                description: 'If true, include _revs_info in the document',
                displayOptions: { show: { resource: ['document'], operation: ['get'] } }
            },
            {
                displayName: 'Replace Document (override)',
                name: 'replace',
                type: 'boolean',
                default: false,
                description: 'When true, update replaces the entire document (missing keys are removed). _id and _rev are preserved',
                displayOptions: { show: { resource: ['document'], operation: ['update'] } }
            },
            {
                displayName: 'Purge After Delete',
                name: 'purgeAfterDelete',
                type: 'boolean',
                default: true,
                description: 'Also purge deleted documents when using delete',
                displayOptions: { show: { resource: ['document'], operation: ['delete'] } }
            },
            {
                displayName: 'Page Size',
                name: 'pageSize',
                type: 'number',
                typeOptions: { minValue: 1 },
                default: 50,
                description: 'Number of docs per page for find/list documents',
                displayOptions: { show: { resource: ['document'], operation: ['find', 'listDocs'] } }
            },
            {
                displayName: 'Page',
                name: 'page',
                type: 'number',
                typeOptions: { minValue: 1 },
                default: 1,
                description: 'Page number for find/list documents',
                displayOptions: { show: { resource: ['document'], operation: ['find', 'listDocs'] } }
            },
            {
                displayName: 'Include Docs',
                name: 'includeDocs',
                type: 'boolean',
                default: false,
                description: 'Include full documents when listing (otherwise only ids)',
                displayOptions: { show: { resource: ['document'], operation: ['listDocs', 'find'] } }
            },
            {
                displayName: 'Sort Field',
                name: 'sortField',
                type: 'string',
                default: '_id',
                description: 'Field to sort by (dot notation). Defaults to document id',
                displayOptions: { show: { resource: ['document'], operation: ['listDocs', 'find'] } }
            },
            {
                displayName: 'Sort Direction',
                name: 'sortDirection',
                type: 'options',
                options: [
                    { name: 'Ascending', value: 'asc' },
                    { name: 'Descending', value: 'desc' }
                ],
                default: 'asc',
                displayOptions: { show: { resource: ['document'], operation: ['listDocs', 'find'] } }
            },
            {
                displayName: 'Extra Fields (dot notation)',
                name: 'extraFields',
                type: 'string',
                typeOptions: { multipleValues: true },
                default: [],
                description: 'Fields to include when not returning full documents',
                displayOptions: { show: { resource: ['document'], operation: ['listDocs', 'find'], includeDocs: [false] } }
            },
            {
                displayName: 'Wrap Response With Metadata',
                name: 'wrapWithMetadata',
                type: 'boolean',
                default: true,
                description: 'When true, return { docs, count, total }; when false, return only the docs array',
                displayOptions: { show: { resource: ['document'], operation: ['listDocs', 'find'] } }
            },
            {
                displayName: 'Body',
                name: 'body',
                type: 'json',
                default: '{}',
                displayOptions: { show: { resource: ['document'], operation: ['create', 'update'] } }
            },
            {
                displayName: 'Body Fields',
                name: 'bodyFields',
                type: 'fixedCollection',
                typeOptions: { multipleValues: true },
                default: {},
                placeholder: 'Add field',
                description: 'Set individual fields using dot notation; merged into Body',
                options: [
                    {
                        name: 'field',
                        displayName: 'Field',
                        values: [
                            { displayName: 'Path (dot notation)', name: 'path', type: 'string', default: '' },
                            { displayName: 'Value', name: 'value', type: 'string', default: '' }
                        ]
                    }
                ],
                displayOptions: { show: { resource: ['document'], operation: ['create', 'update'] } }
            }
        ]
    };
    async execute() {
        const resource = this.getNodeParameter('resource', 0);
        if (resource === 'database')
            return [await database_operations_1.databaseOperations.call(this)];
        if (resource === 'document')
            return [await document_operations_1.documentOperations.call(this)];
        throw new Error('Unknown resource');
    }
    methods = {
        loadOptions: {
            async getDatabases() {
                const credentials = await this.getCredentials('couchDbApi');
                const { baseUrl, username, password } = credentials;
                const res = await this.helpers.httpRequest({
                    method: 'GET',
                    url: `${baseUrl}/_all_dbs`,
                    auth: { username, password },
                    json: true
                });
                return res.map((name) => ({ name, value: name }));
            }
        }
    };
}
exports.CouchDb = CouchDb;
