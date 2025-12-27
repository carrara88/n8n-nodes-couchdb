import { couchDbRequest } from './transport';

export async function documentOperations(this: any) {
  const items = this.getInputData();
  const returnData: any[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const operation = this.getNodeParameter('operation', itemIndex);
    const db = this.getNodeParameter('db', itemIndex) as string;
    const docId = this.getNodeParameter('docId', itemIndex, '') as string;
    const rawBody = this.getNodeParameter('body', itemIndex, {}) as unknown;
    const bodyFields = this.getNodeParameter('bodyFields.field', itemIndex, []) as Array<{ path: string; value: string }>;
    const rev = this.getNodeParameter('rev', itemIndex, '') as string;
    const rawFilter = this.getNodeParameter('filter', itemIndex, {}) as unknown;
    const purgeAfterDelete = this.getNodeParameter('purgeAfterDelete', itemIndex, true) as boolean;
    const replace = this.getNodeParameter('replace', itemIndex, false) as boolean;
    const simpleFilters = this.getNodeParameter('simpleFilters.rule', itemIndex, []) as Array<{ field: string; value: string }>;
    const pageSize = this.getNodeParameter('pageSize', itemIndex, 50) as number;
    const page = this.getNodeParameter('page', itemIndex, 1) as number;
    const includeDocs = this.getNodeParameter('includeDocs', itemIndex, true) as boolean;
    const sortField = (this.getNodeParameter('sortField', itemIndex, '_id') as string) || '_id';
    const sortDirection = this.getNodeParameter('sortDirection', itemIndex, 'asc') as 'asc' | 'desc';
    const extraFields = this.getNodeParameter('extraFields', itemIndex, []) as string[];
    const wrapWithMetadata = this.getNodeParameter('wrapWithMetadata', itemIndex, true) as boolean;
    const attachments = this.getNodeParameter('attachments', itemIndex, false) as boolean;
    const attEncodingInfo = this.getNodeParameter('attEncodingInfo', itemIndex, false) as boolean;
    const attsSinceRaw = this.getNodeParameter('attsSince', itemIndex, '[]') as unknown;
    const revs = this.getNodeParameter('revs', itemIndex, false) as boolean;
    const revsInfo = this.getNodeParameter('revsInfo', itemIndex, false) as boolean;
    const getRev = this.getNodeParameter('getRev', itemIndex, '') as string;
    const attachmentName = this.getNodeParameter('attachmentName', itemIndex, '') as string;
    const attachmentData = this.getNodeParameter('attachmentData', itemIndex, '') as string;
    const attachmentContentType = this.getNodeParameter('attachmentContentType', itemIndex, 'application/octet-stream') as string;
    const returnFullDocument = this.getNodeParameter('returnFullDocument', itemIndex, true) as boolean;

    const baseBody = normalizeObject(rawBody, 'Body must be an object or valid JSON object string');
    const body = applyBodyFields(baseBody, bodyFields);
    const selector = mergeSelectors(normalizeSelector(rawFilter), buildSimpleSelector(simpleFilters));
    const attsSince = normalizeArray(attsSinceRaw);
    const hasFilter = selector && Object.keys(selector).length > 0;

    if (operation === 'create') {
      const created = await couchDbRequest.call(this, 'POST', `/${db}`, body);
      returnData.push({ json: created });
      continue;
    }

    if (operation === 'get') {
      if (hasFilter) {
        const res = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
        const docs = ((res as any)?.docs ?? []).map(normalizeDocumentObject);
        if (returnFullDocument) {
          returnData.push(...this.helpers.returnJsonArray(docs));
        } else {
          returnData.push(...this.helpers.returnJsonArray(docs.map((d: any) => ({ _id: d._id, _rev: d._rev }))));
        }
        continue;
      }
      if (!docId) throw new Error('Document ID is required when no filter is provided');
      const query = buildQuery({ attachments, att_encoding_info: attEncodingInfo, atts_since: attsSince, rev: getRev || undefined, revs, revs_info: revsInfo });
      const doc = await couchDbRequest.call(this, 'GET', `/${db}/${docId}${query}`);
      if (returnFullDocument) {
        returnData.push({ json: doc });
      } else {
        returnData.push({ json: { _id: (doc as any)?._id ?? docId, _rev: (doc as any)?._rev } });
      }
      continue;
    }

    if (operation === 'find') {
      const skip = Math.max(0, (page - 1) * pageSize);
      if (!hasFilter) {
        // Fallback to _all_docs when no selector/filters are provided
        const needDocs = includeDocs || (Array.isArray(extraFields) && extraFields.length > 0);
        const res = await couchDbRequest.call(this, 'GET', `/${db}/_all_docs?include_docs=${needDocs}&limit=${pageSize}&skip=${skip}`);
        const totalRows = (res as any)?.total_rows ?? 0;
        if (includeDocs) {
          const docs = ((res as any)?.rows ?? [])
            .map((row: any) => (row.doc ? normalizeDocumentObject(row.doc) : undefined))
            .filter((d: any) => d !== undefined);
          if (!wrapWithMetadata) returnData.push(...this.helpers.returnJsonArray(docs as any[]));
          else returnData.push({ json: { docs, count: docs.length, total: totalRows } });
          continue;
        }
        const idsOnly = ((res as any)?.rows ?? []).map((row: any) => {
          const base: Record<string, unknown> = { id: row.id, key: row.key, value: row.value };
          if (needDocs && row.doc && Array.isArray(extraFields) && extraFields.length > 0) {
            Object.assign(base, pickFields(row.doc, extraFields));
          }
          return base;
        });
        if (!wrapWithMetadata) returnData.push(...this.helpers.returnJsonArray(idsOnly as any[]));
        else returnData.push({ json: { docs: idsOnly, count: idsOnly.length, total: totalRows } });
        continue;
      }
      const allowServerSort = selectorHasField(selector, sortField);
      const sortSpec = allowServerSort ? buildSort(sortField, sortDirection) : undefined;
      const res = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector, limit: pageSize, skip, ...(sortSpec ? { sort: sortSpec } : {}) });
      const docs = ((res as any)?.docs ?? []).map(normalizeDocumentObject);
      if (!allowServerSort) sortInPlace(docs, sortField, sortDirection);
      const totalDocs = (res as any)?.total_docs ?? (res as any)?.execution_stats?.total_docs_examined ?? docs.length + skip;
      if (includeDocs) {
        if (!wrapWithMetadata) returnData.push(...this.helpers.returnJsonArray(docs as any[]));
        else returnData.push({ json: { docs, count: docs.length, total: totalDocs } });
      } else {
        const metaOnly = docs.map((d: any) => ({
          _id: d._id,
          _rev: d._rev,
          ...(Array.isArray(extraFields) && extraFields.length > 0 ? pickFields(d, extraFields) : {})
        }));
        if (!wrapWithMetadata) returnData.push(...this.helpers.returnJsonArray(metaOnly as any[]));
        else returnData.push({ json: { docs: metaOnly, count: metaOnly.length, total: totalDocs } });
      }
      continue;
    }

    if (operation === 'getAttachment') {
      if (!docId) throw new Error('Document ID is required for attachment operations');
      if (!attachmentName) throw new Error('Attachment name is required');
      const credentials = await this.getCredentials('couchDbApi');
      const { baseUrl, username, password } = credentials as { baseUrl: string; username: string; password: string };
      const response = await this.helpers.httpRequest({
        method: 'GET',
        url: `${baseUrl}/${encodeURIComponent(db)}/${encodeURIComponent(docId)}/${encodeURIComponent(attachmentName)}`,
        qs: getRev ? { rev: getRev } : undefined,
        auth: { username, password },
        encoding: 'arraybuffer',
        json: false,
        resolveWithFullResponse: true
      });
      const resObj = response as any;
      const data = Buffer.from(resObj?.body ?? []).toString('base64');
      const contentType = resObj?.headers?.['content-type'];
      returnData.push({ json: { _id: docId, attachment: attachmentName, contentType, data } });
      continue;
    }

    if (operation === 'putAttachment') {
      if (!docId) throw new Error('Document ID is required for attachment operations');
      if (!attachmentName) throw new Error('Attachment name is required');
      if (!attachmentData) throw new Error('Attachment data (base64) is required');
      const credentials = await this.getCredentials('couchDbApi');
      const { baseUrl, username, password } = credentials as { baseUrl: string; username: string; password: string };
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
      returnData.push({ json: res as any });
      continue;
    }

    if (operation === 'deleteAttachment') {
      if (!docId) throw new Error('Document ID is required for attachment operations');
      if (!attachmentName) throw new Error('Attachment name is required');
      const credentials = await this.getCredentials('couchDbApi');
      const { baseUrl, username, password } = credentials as { baseUrl: string; username: string; password: string };
      const currentRev = rev || (await fetchRevision.call(this, db, docId));
      const res = await this.helpers.httpRequest({
        method: 'DELETE',
        url: `${baseUrl}/${encodeURIComponent(db)}/${encodeURIComponent(docId)}/${encodeURIComponent(attachmentName)}`,
        qs: currentRev ? { rev: currentRev } : undefined,
        auth: { username, password },
        json: true
      });
      returnData.push({ json: res as any });
      continue;
    }

    if (operation === 'update') {
      if (hasFilter) {
        const found = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
        const docs = ((found as any)?.docs ?? []).map(normalizeDocumentObject).map((doc: any) => {
          if (replace) return { ...body, _id: doc._id, _rev: doc._rev };
          return { ...doc, ...body };
        });
        if (docs.length === 0) continue;
        const bulkRes = await couchDbRequest.call(this, 'POST', `/${db}/_bulk_docs`, { docs });
        returnData.push(...this.helpers.returnJsonArray(bulkRes as any[]));
        continue;
      }
      if (!docId) throw new Error('Document ID is required when no filter is provided');
      let current: any | undefined;
      try {
        current = await couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
      } catch (error: any) {
        if (!isNotFound(error)) throw error;
      }
      if (!current) {
        const toCreate = { ...body, _id: docId };
        returnData.push({ json: await couchDbRequest.call(this, 'PUT', `/${db}/${docId}`, toCreate) });
        continue;
      }
      const currentRev = (current as any)?._rev || rev;
      if (!currentRev) throw new Error('Revision not found for update');
      const updated = replace ? { ...body, _id: docId, _rev: currentRev } : { ...(current as any), ...body };
      returnData.push({ json: await couchDbRequest.call(this, 'PUT', `/${db}/${docId}`, updated) });
      continue;
    }

    if (operation === 'delete') {
      if (hasFilter) {
        const found = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
        const docs = ((found as any)?.docs ?? []).map(normalizeDocumentObject) as any[];
        if (docs.length === 0) continue;
        const purgePayload = docs.reduce((acc: Record<string, string[]>, doc: any) => {
          if (doc._id && doc._rev) acc[doc._id] = [doc._rev];
          return acc;
        }, {});
        const toDelete = docs.map((doc: any) => ({ _id: doc._id, _rev: doc._rev, _deleted: true }));
        const bulkRes = await couchDbRequest.call(this, 'POST', `/${db}/_bulk_docs`, { docs: toDelete });
        if (purgeAfterDelete && Object.keys(purgePayload).length > 0) {
          await couchDbRequest.call(this, 'POST', `/${db}/_purge`, purgePayload);
        }
        returnData.push(...this.helpers.returnJsonArray(bulkRes as any[]));
        continue;
      }
      if (!docId) throw new Error('Document ID is required when no filter is provided');
      const existing = await couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
      const currentRev = (existing as any)?._rev || rev;
      if (!currentRev) throw new Error('Revision not found for delete');
      const delRes = await couchDbRequest.call(this, 'DELETE', `/${db}/${docId}?rev=${currentRev}`);
      if (purgeAfterDelete) {
        await couchDbRequest.call(this, 'POST', `/${db}/_purge`, { [docId]: [currentRev] });
      }
      returnData.push({ json: delRes });
      continue;
    }

    if (operation === 'purge') {
      returnData.push({ json: await couchDbRequest.call(this, 'POST', `/${db}/_purge`, { [docId]: [rev] }) });
      continue;
    }

    if (operation === 'listDocs') {
      const skip = Math.max(0, (page - 1) * pageSize);
      const needDocs = includeDocs || (Array.isArray(extraFields) && extraFields.length > 0);
      const res = await couchDbRequest.call(this, 'GET', `/${db}/_all_docs?include_docs=${needDocs}&limit=${pageSize}&skip=${skip}`);
      if (includeDocs) {
        const docs = ((res as any)?.rows ?? [])
          .map((row: any) => (row.doc ? normalizeDocumentObject(row.doc) : undefined))
          .filter((d: any) => d !== undefined);
        sortInPlace(docs, sortField, sortDirection);
        const totalRows = (res as any)?.total_rows ?? docs.length + skip;
        if (!wrapWithMetadata) returnData.push(...this.helpers.returnJsonArray(docs as any[]));
        else returnData.push({ json: { docs, count: docs.length, total: totalRows } });
        continue;
      }
      const idsOnly = ((res as any)?.rows ?? []).map((row: any) => ({ id: row.id, key: row.key, value: row.value }));
      const totalRows = (res as any)?.total_rows ?? idsOnly.length + skip;
      if (needDocs && Array.isArray(extraFields) && extraFields.length > 0) {
        for (let i = 0; i < idsOnly.length; i++) {
          const row: any = (res as any)?.rows?.[i];
          if (row?.doc) Object.assign(idsOnly[i], pickFields(row.doc, extraFields));
        }
      }
      sortInPlace(idsOnly, sortField, sortDirection);
      if (!wrapWithMetadata) returnData.push(...this.helpers.returnJsonArray(idsOnly as any[]));
      else returnData.push({ json: { docs: idsOnly, count: idsOnly.length, total: totalRows } });
      continue;
    }

    throw new Error('Unsupported document operation');
  }

  return returnData;
}

function normalizeSelector(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '{}') return {};
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeObject(value: unknown, errMsg: string): Record<string, unknown> {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* fallthrough */
    }
    throw new Error(errMsg);
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) throw new Error(errMsg);
    return value as Record<string, unknown>;
  }
  throw new Error(errMsg);
}

function normalizeDocumentObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* fallthrough */
    }
    throw new Error('Document returned by CouchDB is not a valid object');
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error('Document returned by CouchDB is not a valid object');
}

function buildSimpleSelector(rules: Array<{ field: string; value: string }>): Record<string, unknown> {
  if (!Array.isArray(rules) || rules.length === 0) return {};
  const parts = rules
    .filter((r) => r && r.field)
    .map((r) => ({ [r.field]: { $eq: parseSimpleValue(r.value) } }));
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts } as Record<string, unknown>;
}

function mergeSelectors(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const hasA = a && Object.keys(a).length > 0;
  const hasB = b && Object.keys(b).length > 0;
  if (hasA && hasB) return { $and: [a, b] } as Record<string, unknown>;
  if (hasA) return a;
  if (hasB) return b;
  return {};
}

function parseSimpleValue(value: string): unknown {
  if (value === undefined || value === null) return '';
  const trimmed = `${value}`.trim();
  if (trimmed === '') return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string') as string[];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string') as string[];
    } catch {
      return [];
    }
  }
  return [];
}

function buildQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(query)) {
    if (val === undefined || val === null || val === false) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      params.set(key, JSON.stringify(val));
      continue;
    }
    params.set(key, String(val));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function fetchRevision(this: any, db: string, docId: string): Promise<string> {
  const doc = await couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
  return (doc as any)?._rev || '';
}

function buildSort(field: string, direction: 'asc' | 'desc'): Array<Record<string, 'asc' | 'desc'>> | undefined {
  const trimmed = (field || '').trim();
  if (!trimmed) return undefined;
  return [{ [trimmed]: direction }];
}

function selectorHasField(selector: Record<string, unknown>, field: string): boolean {
  const key = (field || '').trim();
  if (!key) return false;
  if (!selector || typeof selector !== 'object') return false;
  // Shallow check: presence of the sort field at top-level or inside $and/$or clauses.
  if (key in selector) return true;
  const clauses = (selector as any).$and || (selector as any).$or;
  if (Array.isArray(clauses)) {
    return clauses.some((c) => c && typeof c === 'object' && key in c);
  }
  return false;
}

function getValueByPath(obj: any, path: string): unknown {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let current: any = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function sortInPlace(items: Array<Record<string, unknown>>, field: string, direction: 'asc' | 'desc') {
  const path = (field || '').trim() || '_id';
  const dir = direction === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    const va = getValueByPath(a, path);
    const vb = getValueByPath(b, path);
    if (va === vb) return 0;
    if (va === undefined || va === null) return 1;
    if (vb === undefined || vb === null) return -1;
    if (va > vb) return dir;
    if (va < vb) return -dir;
    return 0;
  });
}

function pickFields(source: any, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!source || typeof source !== 'object' || !Array.isArray(fields)) return out;
  for (const path of fields) {
    if (!path) continue;
    const parts = `${path}`.split('.').filter(Boolean);
    let current: any = source;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined) out[path] = current;
  }
  return out;
}

function isNotFound(error: any): boolean {
  const status = (error as any)?.statusCode || (error as any)?.status || (error as any)?.response?.statusCode;
  return status === 404;
}

function applyBodyFields(base: Record<string, unknown>, fields: Array<{ path: string; value: string }>): Record<string, unknown> {
  const out = { ...(base || {}) } as Record<string, unknown>;
  if (!Array.isArray(fields)) return out;
  for (const entry of fields) {
    const path = (entry?.path || '').trim();
    if (!path) continue;
    const val = parseSimpleValue(entry?.value as any);
    setValueByPath(out, path, val);
  }
  return out;
}

function setValueByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let current: any = target;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (i === parts.length - 1) {
      current[key] = value;
      return;
    }
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
}
