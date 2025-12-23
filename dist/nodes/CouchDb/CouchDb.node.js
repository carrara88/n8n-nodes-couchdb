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
            { displayName: 'Resource', name: 'resource', type: 'options', options: [
                    { name: 'Database', value: 'database' },
                    { name: 'Document', value: 'document' }
                ], default: 'database' },
            { displayName: 'Operation', name: 'operation', type: 'options',
                displayOptions: { show: { resource: ['database'] } },
                options: [
                    { name: 'List Databases', value: 'list' },
                    { name: 'Create Database', value: 'create' },
                    { name: 'Delete Database', value: 'delete' }
                ], default: 'list'
            },
            { displayName: 'Operation', name: 'operation', type: 'options',
                displayOptions: { show: { resource: ['document'] } },
                options: [
                    { name: 'Create', value: 'create' },
                    { name: 'Get', value: 'get' },
                    { name: 'Find', value: 'find' },
                    { name: 'List Documents', value: 'listDocs' },
                    { name: 'Update', value: 'update' },
                    { name: 'Delete', value: 'delete' },
                    { name: 'Purge', value: 'purge' }
                ], default: 'get'
            },
            {
                displayName: 'Database',
                name: 'db',
                type: 'string',
                default: '',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['document', 'database'],
                        operation: ['create', 'delete', 'get', 'update', 'purge']
                    }
                }
            },
            {
                displayName: 'Document ID',
                name: 'docId',
                type: 'string',
                default: '',
                displayOptions: { show: { resource: ['document'], operation: ['get', 'update', 'delete', 'purge'] } }
            },
            {
                displayName: 'Revision',
                name: 'rev',
                type: 'string',
                default: '',
                displayOptions: { show: { resource: ['document'], operation: ['update', 'delete', 'purge'] } }
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
                multipleValues: true,
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
                default: true,
                description: 'Include full documents when listing (otherwise only ids)',
                displayOptions: { show: { resource: ['document'], operation: ['listDocs'] } }
            },
            {
                displayName: 'Body',
                name: 'body',
                type: 'json',
                default: '{}',
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
}
exports.CouchDb = CouchDb;
