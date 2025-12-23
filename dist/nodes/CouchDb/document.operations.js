"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentOperations = documentOperations;
const transport_1 = require("./transport");
async function documentOperations() {
    const operation = this.getNodeParameter('operation', 0);
    const db = this.getNodeParameter('db', 0);
    const docId = this.getNodeParameter('docId', 0, '');
    const rawBody = this.getNodeParameter('body', 0, {});
    const rev = this.getNodeParameter('rev', 0, '');
    const rawFilter = this.getNodeParameter('filter', 0, {});
    const purgeAfterDelete = this.getNodeParameter('purgeAfterDelete', 0, true);
    const replace = this.getNodeParameter('replace', 0, false);
    const simpleFilters = this.getNodeParameter('simpleFilters.rule', 0, []);
    const pageSize = this.getNodeParameter('pageSize', 0, 50);
    const page = this.getNodeParameter('page', 0, 1);
    const includeDocs = this.getNodeParameter('includeDocs', 0, true);
    const body = normalizeObject(rawBody, 'Body must be an object or valid JSON object string');
    const selector = mergeSelectors(normalizeSelector(rawFilter), buildSimpleSelector(simpleFilters));
    const hasFilter = selector && Object.keys(selector).length > 0;
    if (operation === 'create')
        return [{ json: await transport_1.couchDbRequest.call(this, 'POST', `/${db}`, body) }];
    if (operation === 'get') {
        if (hasFilter) {
            const res = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
            const docs = (res?.docs ?? []).map(normalizeDocumentObject);
            return this.helpers.returnJsonArray(docs);
        }
        if (!docId)
            throw new Error('Document ID is required when no filter is provided');
        return [{ json: await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`) }];
    }
    if (operation === 'find') {
        if (!hasFilter)
            throw new Error('Filter selector is required for find');
        const skip = Math.max(0, (page - 1) * pageSize);
        const res = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector, limit: pageSize, skip });
        const docs = (res?.docs ?? []).map(normalizeDocumentObject);
        return this.helpers.returnJsonArray(docs);
    }
    if (operation === 'update') {
        if (hasFilter) {
            const found = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
            const docs = (found?.docs ?? []).map(normalizeDocumentObject).map((doc) => {
                if (replace)
                    return { ...body, _id: doc._id, _rev: doc._rev };
                return { ...doc, ...body };
            });
            if (docs.length === 0)
                return [];
            const bulkRes = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_bulk_docs`, { docs });
            return this.helpers.returnJsonArray(bulkRes);
        }
        if (!docId)
            throw new Error('Document ID is required when no filter is provided');
        const current = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
        const currentRev = current?._rev || rev;
        if (!currentRev)
            throw new Error('Revision not found for update');
        const updated = replace ? { ...body, _id: docId, _rev: currentRev } : { ...current, ...body };
        return [{ json: await transport_1.couchDbRequest.call(this, 'PUT', `/${db}/${docId}`, updated) }];
    }
    if (operation === 'delete') {
        if (hasFilter) {
            const found = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
            const docs = (found?.docs ?? []).map(normalizeDocumentObject);
            if (docs.length === 0)
                return [];
            const purgePayload = docs.reduce((acc, doc) => {
                if (doc._id && doc._rev)
                    acc[doc._id] = [doc._rev];
                return acc;
            }, {});
            const toDelete = docs.map((doc) => ({ _id: doc._id, _rev: doc._rev, _deleted: true }));
            const bulkRes = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_bulk_docs`, { docs: toDelete });
            if (purgeAfterDelete && Object.keys(purgePayload).length > 0) {
                await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_purge`, purgePayload);
            }
            return this.helpers.returnJsonArray(bulkRes);
        }
        if (!docId)
            throw new Error('Document ID is required when no filter is provided');
        const existing = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
        const currentRev = existing?._rev || rev;
        if (!currentRev)
            throw new Error('Revision not found for delete');
        const delRes = await transport_1.couchDbRequest.call(this, 'DELETE', `/${db}/${docId}?rev=${currentRev}`);
        if (purgeAfterDelete) {
            await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_purge`, { [docId]: [currentRev] });
        }
        return [{ json: delRes }];
    }
    if (operation === 'purge') {
        return [{ json: await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_purge`, { [docId]: [rev] }) }];
    }
    if (operation === 'listDocs') {
        const skip = Math.max(0, (page - 1) * pageSize);
        const res = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/_all_docs?include_docs=${includeDocs}&limit=${pageSize}&skip=${skip}`);
        // Keep the structure closer to CouchDB response while normalizing docs if included
        if (includeDocs) {
            const rows = (res?.rows ?? []).map((row) => ({
                id: row.id,
                key: row.key,
                value: row.value,
                doc: row.doc ? normalizeDocumentObject(row.doc) : undefined,
            }));
            return this.helpers.returnJsonArray(rows);
        }
        return this.helpers.returnJsonArray((res?.rows ?? []).map((row) => ({ id: row.id, key: row.key, value: row.value })));
    }
    throw new Error('Unsupported document operation');
}
function normalizeSelector(value) {
    if (value === undefined || value === null || value === '')
        return {};
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === '{}')
            return {};
        try {
            const parsed = JSON.parse(trimmed);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch {
            return {};
        }
    }
    if (typeof value === 'object') {
        if (Array.isArray(value))
            return {};
        return value;
    }
    return {};
}
function normalizeObject(value, errMsg) {
    if (value === undefined || value === null || value === '')
        return {};
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '')
            return {};
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
                return parsed;
        }
        catch {
            /* fallthrough */
        }
        throw new Error(errMsg);
    }
    if (typeof value === 'object') {
        if (Array.isArray(value))
            throw new Error(errMsg);
        return value;
    }
    throw new Error(errMsg);
}
function normalizeDocumentObject(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '')
            return {};
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
                return parsed;
        }
        catch {
            /* fallthrough */
        }
        throw new Error('Document returned by CouchDB is not a valid object');
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value))
        return value;
    throw new Error('Document returned by CouchDB is not a valid object');
}
function buildSimpleSelector(rules) {
    if (!Array.isArray(rules) || rules.length === 0)
        return {};
    const parts = rules
        .filter((r) => r && r.field)
        .map((r) => ({ [r.field]: { $eq: parseSimpleValue(r.value) } }));
    if (parts.length === 0)
        return {};
    if (parts.length === 1)
        return parts[0];
    return { $and: parts };
}
function mergeSelectors(a, b) {
    const hasA = a && Object.keys(a).length > 0;
    const hasB = b && Object.keys(b).length > 0;
    if (hasA && hasB)
        return { $and: [a, b] };
    if (hasA)
        return a;
    if (hasB)
        return b;
    return {};
}
function parseSimpleValue(value) {
    if (value === undefined || value === null)
        return '';
    const trimmed = `${value}`.trim();
    if (trimmed === '')
        return '';
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return value;
    }
}
