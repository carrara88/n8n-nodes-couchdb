"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentOperations = documentOperations;
const transport_1 = require("./transport");
async function documentOperations() {
    const items = this.getInputData();
    const returnData = [];
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const operation = this.getNodeParameter('operation', itemIndex);
        const db = this.getNodeParameter('db', itemIndex);
        const docId = this.getNodeParameter('docId', itemIndex, '');
        const rawBody = this.getNodeParameter('body', itemIndex, {});
        const bodyFields = this.getNodeParameter('bodyFields.field', itemIndex, []);
        const rev = this.getNodeParameter('rev', itemIndex, '');
        const rawFilter = this.getNodeParameter('filter', itemIndex, {});
        const purgeAfterDelete = this.getNodeParameter('purgeAfterDelete', itemIndex, true);
        const replace = this.getNodeParameter('replace', itemIndex, false);
        const simpleFilters = this.getNodeParameter('simpleFilters.rule', itemIndex, []);
        const pageSize = this.getNodeParameter('pageSize', itemIndex, 50);
        const page = this.getNodeParameter('page', itemIndex, 1);
        const includeDocs = this.getNodeParameter('includeDocs', itemIndex, true);
        const sortField = this.getNodeParameter('sortField', itemIndex, '_id') || '_id';
        const sortDirection = this.getNodeParameter('sortDirection', itemIndex, 'asc');
        const extraFields = this.getNodeParameter('extraFields', itemIndex, []);
        const wrapWithMetadata = this.getNodeParameter('wrapWithMetadata', itemIndex, true);
        const attachments = this.getNodeParameter('attachments', itemIndex, false);
        const attEncodingInfo = this.getNodeParameter('attEncodingInfo', itemIndex, false);
        const attsSinceRaw = this.getNodeParameter('attsSince', itemIndex, '[]');
        const revs = this.getNodeParameter('revs', itemIndex, false);
        const revsInfo = this.getNodeParameter('revsInfo', itemIndex, false);
        const getRev = this.getNodeParameter('getRev', itemIndex, '');
        const attachmentName = this.getNodeParameter('attachmentName', itemIndex, '');
        const attachmentData = this.getNodeParameter('attachmentData', itemIndex, '');
        const attachmentContentType = this.getNodeParameter('attachmentContentType', itemIndex, 'application/octet-stream');
        const returnFullDocument = this.getNodeParameter('returnFullDocument', itemIndex, true);
        const returnUpdatedDocument = this.getNodeParameter('returnUpdatedDocument', itemIndex, false);
        const returnAttachmentAsBase64 = this.getNodeParameter('returnAttachmentAsBase64', itemIndex, false);
        const baseBody = normalizeObject(rawBody, 'Body must be an object or valid JSON object string');
        // Only use bodyFields for create/replace payloads; for patching we re-apply bodyFields on top of the fetched document to avoid collapsing the document to the minimal dot-path structure.
        const bodyWithFields = applyBodyFields(baseBody, bodyFields);
        const selector = mergeSelectors(normalizeSelector(rawFilter), buildSimpleSelector(simpleFilters));
        const attsSince = normalizeArray(attsSinceRaw);
        const hasFilter = selector && Object.keys(selector).length > 0;
        if (operation === 'create') {
            const created = await transport_1.couchDbRequest.call(this, 'POST', `/${db}`, bodyWithFields);
            if (returnUpdatedDocument) {
                const createdId = created?.id || docId;
                if (createdId) {
                    const fullDoc = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${createdId}`);
                    returnData.push({ json: normalizeDocumentObject(fullDoc) });
                }
                else {
                    returnData.push({ json: created });
                }
            }
            else {
                returnData.push({ json: created });
            }
            continue;
        }
        if (operation === 'get') {
            if (hasFilter) {
                const res = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
                const docs = (res?.docs ?? []).map(normalizeDocumentObject);
                if (returnFullDocument) {
                    returnData.push(...this.helpers.returnJsonArray(docs));
                }
                else {
                    returnData.push(...this.helpers.returnJsonArray(docs.map((d) => ({ _id: d._id, _rev: d._rev }))));
                }
                continue;
            }
            if (!docId)
                throw new Error('Document ID is required when no filter is provided');
            const query = buildQuery({ attachments, att_encoding_info: attEncodingInfo, atts_since: attsSince, rev: getRev || undefined, revs, revs_info: revsInfo });
            const doc = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}${query}`);
            if (returnFullDocument) {
                returnData.push({ json: doc });
            }
            else {
                returnData.push({ json: { _id: doc?._id ?? docId, _rev: doc?._rev } });
            }
            continue;
        }
        if (operation === 'exists') {
            if (!docId)
                throw new Error('Document ID is required');
            try {
                const doc = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
                returnData.push({ json: { exists: true, _id: doc?._id ?? docId, _rev: doc?._rev } });
            }
            catch (error) {
                if (isNotFound(error)) {
                    returnData.push({ json: { exists: false, _id: docId } });
                    continue;
                }
                throw error;
            }
            continue;
        }
        if (operation === 'find') {
            const skip = Math.max(0, (page - 1) * pageSize);
            if (!hasFilter) {
                // Fallback to _all_docs when no selector/filters are provided
                const needDocs = includeDocs || (Array.isArray(extraFields) && extraFields.length > 0);
                const res = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/_all_docs?include_docs=${needDocs}&limit=${pageSize}&skip=${skip}`);
                const totalRows = res?.total_rows ?? 0;
                if (includeDocs) {
                    const docs = (res?.rows ?? [])
                        .map((row) => (row.doc ? normalizeDocumentObject(row.doc) : undefined))
                        .filter((d) => d !== undefined);
                    if (!wrapWithMetadata)
                        returnData.push(...this.helpers.returnJsonArray(docs));
                    else
                        returnData.push({ json: { docs, count: docs.length, total: totalRows } });
                    continue;
                }
                const idsOnly = (res?.rows ?? []).map((row) => {
                    const base = { id: row.id, key: row.key, value: row.value };
                    if (needDocs && row.doc && Array.isArray(extraFields) && extraFields.length > 0) {
                        Object.assign(base, pickFields(row.doc, extraFields));
                    }
                    return base;
                });
                if (!wrapWithMetadata)
                    returnData.push(...this.helpers.returnJsonArray(idsOnly));
                else
                    returnData.push({ json: { docs: idsOnly, count: idsOnly.length, total: totalRows } });
                continue;
            }
            const allowServerSort = selectorHasField(selector, sortField);
            const sortSpec = allowServerSort ? buildSort(sortField, sortDirection) : undefined;
            const res = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector, limit: pageSize, skip, ...(sortSpec ? { sort: sortSpec } : {}) });
            const docs = (res?.docs ?? []).map(normalizeDocumentObject);
            if (!allowServerSort)
                sortInPlace(docs, sortField, sortDirection);
            const totalDocs = res?.total_docs ?? res?.execution_stats?.total_docs_examined ?? docs.length + skip;
            if (includeDocs) {
                if (!wrapWithMetadata)
                    returnData.push(...this.helpers.returnJsonArray(docs));
                else
                    returnData.push({ json: { docs, count: docs.length, total: totalDocs } });
            }
            else {
                const metaOnly = docs.map((d) => ({
                    _id: d._id,
                    _rev: d._rev,
                    ...(Array.isArray(extraFields) && extraFields.length > 0 ? pickFields(d, extraFields) : {})
                }));
                if (!wrapWithMetadata)
                    returnData.push(...this.helpers.returnJsonArray(metaOnly));
                else
                    returnData.push({ json: { docs: metaOnly, count: metaOnly.length, total: totalDocs } });
            }
            continue;
        }
        if (operation === 'getAttachment') {
            if (!docId)
                throw new Error('Document ID is required for attachment operations');
            if (!attachmentName)
                throw new Error('Attachment name is required');
            const credentials = await this.getCredentials('couchDbApi');
            const { baseUrl, username, password } = credentials;
            const response = await this.helpers.httpRequest({
                method: 'GET',
                url: `${baseUrl}/${encodeURIComponent(db)}/${encodeURIComponent(docId)}/${encodeURIComponent(attachmentName)}`,
                qs: getRev ? { rev: getRev } : undefined,
                auth: { username, password },
                encoding: 'arraybuffer',
                json: false,
                returnFullResponse: true
            });
            const resObj = response;
            const rawBody = resObj?.data !== undefined ? resObj.data : resObj?.body ?? resObj?.rawBody ?? resObj;
            const buffer = toBuffer(rawBody);
            const data = ensurePaddedBase64(buffer.toString('base64'));
            const contentType = resObj?.headers?.['content-type'] ?? resObj?.headers?.get?.('content-type');
            if (returnAttachmentAsBase64) {
                const dataUrl = buildDataUrl(data, contentType);
                returnData.push({ json: { _id: docId, attachment: attachmentName, contentType, data, dataUrl } });
            }
            else {
                const item = {
                    json: { _id: docId, attachment: attachmentName, contentType }
                };
                item.binary = item.binary || {};
                item.binary.data = await this.helpers.prepareBinaryData(buffer, attachmentName, contentType);
                returnData.push(item);
            }
            continue;
        }
        if (operation === 'putAttachment') {
            if (!docId)
                throw new Error('Document ID is required for attachment operations');
            if (!attachmentName)
                throw new Error('Attachment name is required');
            if (!attachmentData)
                throw new Error('Attachment data (base64) is required');
            const credentials = await this.getCredentials('couchDbApi');
            const { baseUrl, username, password } = credentials;
            const currentRev = rev || (await fetchRevision.call(this, db, docId));
            const buffer = Buffer.from(attachmentData, 'base64');
            const res = await this.helpers.httpRequest({
                method: 'PUT',
                url: `${baseUrl}/${encodeURIComponent(db)}/${encodeURIComponent(docId)}/${encodeURIComponent(attachmentName)}`,
                qs: currentRev ? { rev: currentRev } : undefined,
                auth: { username, password },
                body: buffer,
                encoding: null,
                json: false,
                headers: { 'Content-Type': attachmentContentType }
            });
            returnData.push({ json: res });
            continue;
        }
        if (operation === 'deleteAttachment') {
            if (!docId)
                throw new Error('Document ID is required for attachment operations');
            if (!attachmentName)
                throw new Error('Attachment name is required');
            const credentials = await this.getCredentials('couchDbApi');
            const { baseUrl, username, password } = credentials;
            const currentRev = rev || (await fetchRevision.call(this, db, docId));
            const res = await this.helpers.httpRequest({
                method: 'DELETE',
                url: `${baseUrl}/${encodeURIComponent(db)}/${encodeURIComponent(docId)}/${encodeURIComponent(attachmentName)}`,
                qs: currentRev ? { rev: currentRev } : undefined,
                auth: { username, password },
                json: true
            });
            returnData.push({ json: res });
            continue;
        }
        if (operation === 'update') {
            // Consider "replace" only when a full base body is provided and no bodyFields are used.
            const shouldReplace = replace && Object.keys(baseBody || {}).length > 0 && (!Array.isArray(bodyFields) || bodyFields.length === 0);
            if (hasFilter) {
                const found = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
                const docs = (found?.docs ?? []).map(normalizeDocumentObject).map((doc) => {
                    if (shouldReplace)
                        return { ...bodyWithFields, _id: doc._id, _rev: doc._rev };
                    const merged = applyPatchToDocument(doc, baseBody, bodyFields);
                    return { ...merged, _id: doc._id, _rev: doc._rev };
                });
                if (docs.length === 0)
                    continue;
                const bulkRes = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_bulk_docs`, { docs });
                if (returnUpdatedDocument) {
                    for (const res of bulkRes) {
                        if (res?.ok && res.id) {
                            const fullDoc = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${res.id}`);
                            returnData.push({ json: normalizeDocumentObject(fullDoc) });
                        }
                        else {
                            returnData.push({ json: res });
                        }
                    }
                }
                else {
                    returnData.push(...this.helpers.returnJsonArray(bulkRes));
                }
                continue;
            }
            if (!docId)
                throw new Error('Document ID is required when no filter is provided');
            let current;
            try {
                current = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
            }
            catch (error) {
                if (!isNotFound(error))
                    throw error;
            }
            if (!current) {
                const toCreate = { ...bodyWithFields, _id: docId };
                const created = await transport_1.couchDbRequest.call(this, 'PUT', `/${db}/${docId}`, toCreate);
                if (returnUpdatedDocument) {
                    const fullDoc = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
                    returnData.push({ json: normalizeDocumentObject(fullDoc) });
                }
                else {
                    returnData.push({ json: created });
                }
                continue;
            }
            const currentRev = current?._rev || rev;
            if (!currentRev)
                throw new Error('Revision not found for update');
            const updated = shouldReplace
                ? { ...bodyWithFields, _id: docId, _rev: currentRev }
                : { ...applyPatchToDocument(current, baseBody, bodyFields), _id: docId, _rev: currentRev };
            const writeRes = await transport_1.couchDbRequest.call(this, 'PUT', `/${db}/${docId}`, updated);
            if (returnUpdatedDocument) {
                const fullDoc = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
                returnData.push({ json: normalizeDocumentObject(fullDoc) });
            }
            else {
                returnData.push({ json: writeRes });
            }
            continue;
        }
        if (operation === 'delete') {
            if (hasFilter) {
                const found = await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
                const docs = (found?.docs ?? []).map(normalizeDocumentObject);
                if (docs.length === 0)
                    continue;
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
                returnData.push(...this.helpers.returnJsonArray(bulkRes));
                continue;
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
            returnData.push({ json: delRes });
            continue;
        }
        if (operation === 'purge') {
            returnData.push({ json: await transport_1.couchDbRequest.call(this, 'POST', `/${db}/_purge`, { [docId]: [rev] }) });
            continue;
        }
        if (operation === 'listDocs') {
            const skip = Math.max(0, (page - 1) * pageSize);
            const needDocs = includeDocs || (Array.isArray(extraFields) && extraFields.length > 0);
            const res = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/_all_docs?include_docs=${needDocs}&limit=${pageSize}&skip=${skip}`);
            if (includeDocs) {
                const docs = (res?.rows ?? [])
                    .map((row) => (row.doc ? normalizeDocumentObject(row.doc) : undefined))
                    .filter((d) => d !== undefined);
                sortInPlace(docs, sortField, sortDirection);
                const totalRows = res?.total_rows ?? docs.length + skip;
                if (!wrapWithMetadata)
                    returnData.push(...this.helpers.returnJsonArray(docs));
                else
                    returnData.push({ json: { docs, count: docs.length, total: totalRows } });
                continue;
            }
            const idsOnly = (res?.rows ?? []).map((row) => ({ id: row.id, key: row.key, value: row.value }));
            const totalRows = res?.total_rows ?? idsOnly.length + skip;
            if (needDocs && Array.isArray(extraFields) && extraFields.length > 0) {
                for (let i = 0; i < idsOnly.length; i++) {
                    const row = res?.rows?.[i];
                    if (row?.doc)
                        Object.assign(idsOnly[i], pickFields(row.doc, extraFields));
                }
            }
            sortInPlace(idsOnly, sortField, sortDirection);
            if (!wrapWithMetadata)
                returnData.push(...this.helpers.returnJsonArray(idsOnly));
            else
                returnData.push({ json: { docs: idsOnly, count: idsOnly.length, total: totalRows } });
            continue;
        }
        throw new Error('Unsupported document operation');
    }
    return returnData;
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
function normalizeArray(value) {
    if (Array.isArray(value))
        return value.filter((v) => typeof v === 'string');
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed))
                return parsed.filter((v) => typeof v === 'string');
        }
        catch {
            return [];
        }
    }
    return [];
}
function buildQuery(query) {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(query)) {
        if (val === undefined || val === null || val === false)
            continue;
        if (Array.isArray(val)) {
            if (val.length === 0)
                continue;
            params.set(key, JSON.stringify(val));
            continue;
        }
        params.set(key, String(val));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}
async function fetchRevision(db, docId) {
    const doc = await transport_1.couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
    return doc?._rev || '';
}
function buildSort(field, direction) {
    const trimmed = (field || '').trim();
    if (!trimmed)
        return undefined;
    return [{ [trimmed]: direction }];
}
function selectorHasField(selector, field) {
    const key = (field || '').trim();
    if (!key)
        return false;
    if (!selector || typeof selector !== 'object')
        return false;
    // Shallow check: presence of the sort field at top-level or inside $and/$or clauses.
    if (key in selector)
        return true;
    const clauses = selector.$and || selector.$or;
    if (Array.isArray(clauses)) {
        return clauses.some((c) => c && typeof c === 'object' && key in c);
    }
    return false;
}
function getValueByPath(obj, path) {
    if (!obj || typeof obj !== 'object' || !path)
        return undefined;
    const segments = parsePath(path);
    if (segments.length === 0)
        return undefined;
    let current = obj;
    for (const segment of segments) {
        if (segment.type === 'prop') {
            if (current && typeof current === 'object' && segment.key in current) {
                current = current[segment.key];
            }
            else {
                return undefined;
            }
            continue;
        }
        if (Array.isArray(current)) {
            current = current[segment.index];
        }
        else {
            return undefined;
        }
    }
    return current;
}
function sortInPlace(items, field, direction) {
    const path = (field || '').trim() || '_id';
    const dir = direction === 'desc' ? -1 : 1;
    items.sort((a, b) => {
        const va = getValueByPath(a, path);
        const vb = getValueByPath(b, path);
        if (va === vb)
            return 0;
        if (va === undefined || va === null)
            return 1;
        if (vb === undefined || vb === null)
            return -1;
        if (va > vb)
            return dir;
        if (va < vb)
            return -dir;
        return 0;
    });
}
function pickFields(source, fields) {
    const out = {};
    if (!source || typeof source !== 'object' || !Array.isArray(fields))
        return out;
    for (const path of fields) {
        if (!path)
            continue;
        const val = getValueByPath(source, path);
        if (val !== undefined)
            out[path] = val;
    }
    return out;
}
function isNotFound(error) {
    const status = error?.statusCode || error?.status || error?.response?.statusCode;
    return status === 404;
}
function applyBodyFields(base, fields) {
    const out = { ...(base || {}) };
    if (!Array.isArray(fields))
        return out;
    for (const entry of fields) {
        const path = (entry?.path || '').trim();
        if (!path)
            continue;
        const val = parseSimpleValue(entry?.value);
        setValueByPath(out, path, val);
    }
    return out;
}
function setValueByPath(target, path, value) {
    const segments = parsePath(path);
    if (segments.length === 0)
        return;
    let current = target;
    let parent = null;
    let parentKey = null;
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLast = i === segments.length - 1;
        if (segment.type === 'prop') {
            if (isLast) {
                const existing = current[segment.key];
                current[segment.key] = shouldMerge(existing, value) ? { ...existing, ...value } : value;
                return;
            }
            if (!(segment.key in current) || current[segment.key] === null || typeof current[segment.key] !== 'object') {
                current[segment.key] = segments[i + 1]?.type === 'index' ? [] : {};
            }
            parent = current;
            parentKey = segment.key;
            current = current[segment.key];
            continue;
        }
        if (!Array.isArray(current)) {
            const newArr = [];
            if (parent !== null && parentKey !== null)
                parent[parentKey] = newArr;
            current = newArr;
        }
        if (isLast) {
            const existing = current[segment.index];
            current[segment.index] = shouldMerge(existing, value) ? { ...existing, ...value } : value;
            return;
        }
        if (current[segment.index] === undefined || current[segment.index] === null || typeof current[segment.index] !== 'object') {
            current[segment.index] = segments[i + 1]?.type === 'index' ? [] : {};
        }
        parent = current;
        parentKey = segment.index;
        current = current[segment.index];
    }
}
function shouldMerge(existing, incoming) {
    return isPlainObject(existing) && isPlainObject(incoming);
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parsePath(path) {
    // Fail fast on empty/undefined paths so we do not partially patch a document
    const input = (path || '').trim();
    if (!input)
        return [];
    const segments = [];
    let i = 0;
    while (i < input.length) {
        // Skip dot separators
        if (input[i] === '.') {
            i++;
            continue;
        }
        // Array index in brackets, allow surrounding whitespace
        if (input[i] === '[') {
            const end = input.indexOf(']', i);
            if (end === -1)
                return [];
            const content = input.slice(i + 1, end).trim();
            if (!/^\d+$/.test(content))
                return [];
            segments.push({ type: 'index', index: Number(content) });
            i = end + 1;
            continue;
        }
        // Property segment until next '.' or '['
        const start = i;
        while (i < input.length && input[i] !== '.' && input[i] !== '[' && input[i] !== ']')
            i++;
        if (start === i)
            return [];
        segments.push({ type: 'prop', key: input.slice(start, i) });
    }
    return segments;
}
function deepMerge(target, source) {
    if (isPlainObject(target) && isPlainObject(source)) {
        const out = { ...target };
        for (const [key, val] of Object.entries(source)) {
            out[key] = key in target ? deepMerge(target[key], val) : val;
        }
        return out;
    }
    if (Array.isArray(target) && Array.isArray(source)) {
        const out = target.slice();
        for (let i = 0; i < source.length; i++) {
            const val = source[i];
            if (val === undefined)
                continue;
            out[i] = i in target ? deepMerge(target[i], val) : val;
        }
        return out;
    }
    return source;
}
function toBuffer(raw) {
    if (Buffer.isBuffer(raw))
        return raw;
    if (raw instanceof ArrayBuffer)
        return Buffer.from(raw);
    if (ArrayBuffer.isView(raw))
        return Buffer.from(raw.buffer);
    if (Array.isArray(raw))
        return Buffer.from(raw);
    if (typeof raw === 'string') {
        if (isProbablyBase64(raw)) {
            try {
                return Buffer.from(ensurePaddedBase64(raw), 'base64');
            }
            catch {
                /* fallthrough */
            }
        }
        return Buffer.from(raw, 'binary');
    }
    return Buffer.from([]);
}
function isProbablyBase64(value) {
    const trimmed = (value || '').trim();
    if (!trimmed)
        return false;
    if (trimmed.length % 4 !== 0)
        return false;
    return /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed);
}
function ensurePaddedBase64(value) {
    const clean = (value || '').replace(/\s+/g, '');
    const pad = clean.length % 4;
    if (pad === 0)
        return clean;
    return clean + '='.repeat(4 - pad);
}
function buildDataUrl(base64, contentType) {
    const mime = contentType || 'application/octet-stream';
    return `data:${mime};base64,${base64}`;
}
function applyPatchToDocument(current, body, bodyFields) {
    const base = cloneJson(current || {});
    const merged = deepMerge(base, body);
    if (!Array.isArray(bodyFields))
        return merged;
    for (const entry of bodyFields) {
        const path = (entry?.path || '').trim();
        if (!path)
            continue;
        setValueByPath(merged, path, parseSimpleValue(entry?.value));
    }
    return merged;
}
function cloneJson(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return value;
    }
}
