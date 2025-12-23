import { couchDbRequest } from './transport';

export async function documentOperations(this: any) {
  const operation = this.getNodeParameter('operation', 0);
  const db = this.getNodeParameter('db', 0) as string;
  const docId = this.getNodeParameter('docId', 0, '') as string;
  const rawBody = this.getNodeParameter('body', 0, {}) as unknown;
  const rev = this.getNodeParameter('rev', 0, '') as string;
  const rawFilter = this.getNodeParameter('filter', 0, {}) as unknown;
  const purgeAfterDelete = this.getNodeParameter('purgeAfterDelete', 0, true) as boolean;
  const replace = this.getNodeParameter('replace', 0, false) as boolean;
  const simpleFilters = this.getNodeParameter('simpleFilters.rule', 0, []) as Array<{ field: string; value: string }>;
  const pageSize = this.getNodeParameter('pageSize', 0, 50) as number;
  const page = this.getNodeParameter('page', 0, 1) as number;
  const includeDocs = this.getNodeParameter('includeDocs', 0, true) as boolean;

  const body = normalizeObject(rawBody, 'Body must be an object or valid JSON object string');
  const selector = mergeSelectors(normalizeSelector(rawFilter), buildSimpleSelector(simpleFilters));

  const hasFilter = selector && Object.keys(selector).length > 0;

  if (operation === 'create') return [{ json: await couchDbRequest.call(this, 'POST', `/${db}`, body) }];

  if (operation === 'get') {
    if (hasFilter) {
      const res = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
      const docs = ((res as any)?.docs ?? []).map(normalizeDocumentObject);
      return this.helpers.returnJsonArray(docs);
    }
    if (!docId) throw new Error('Document ID is required when no filter is provided');
    return [{ json: await couchDbRequest.call(this, 'GET', `/${db}/${docId}`) }];
  }

  if (operation === 'find') {
    if (!hasFilter) throw new Error('Filter selector is required for find');
    const skip = Math.max(0, (page - 1) * pageSize);
    const res = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector, limit: pageSize, skip });
    const docs = ((res as any)?.docs ?? []).map(normalizeDocumentObject);
    return this.helpers.returnJsonArray(docs);
  }

  if (operation === 'update') {
    if (hasFilter) {
      const found = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
      const docs = ((found as any)?.docs ?? []).map(normalizeDocumentObject).map((doc: any) => {
        if (replace) return { ...body, _id: doc._id, _rev: doc._rev };
        return { ...doc, ...body };
      });
      if (docs.length === 0) return [];
      const bulkRes = await couchDbRequest.call(this, 'POST', `/${db}/_bulk_docs`, { docs });
      return this.helpers.returnJsonArray(bulkRes as any[]);
    }
    if (!docId) throw new Error('Document ID is required when no filter is provided');
    const current = await couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
    const currentRev = (current as any)?._rev || rev;
    if (!currentRev) throw new Error('Revision not found for update');
    const updated = replace ? { ...body, _id: docId, _rev: currentRev } : { ...(current as any), ...body };
    return [{ json: await couchDbRequest.call(this, 'PUT', `/${db}/${docId}`, updated) }];
  }

  if (operation === 'delete') {
    if (hasFilter) {
      const found = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
      const docs = ((found as any)?.docs ?? []).map(normalizeDocumentObject) as any[];
      if (docs.length === 0) return [];
      const purgePayload = docs.reduce((acc: Record<string, string[]>, doc: any) => {
        if (doc._id && doc._rev) acc[doc._id] = [doc._rev];
        return acc;
      }, {});
      const toDelete = docs.map((doc: any) => ({ _id: doc._id, _rev: doc._rev, _deleted: true }));
      const bulkRes = await couchDbRequest.call(this, 'POST', `/${db}/_bulk_docs`, { docs: toDelete });
      if (purgeAfterDelete && Object.keys(purgePayload).length > 0) {
        await couchDbRequest.call(this, 'POST', `/${db}/_purge`, purgePayload);
      }
      return this.helpers.returnJsonArray(bulkRes as any[]);
    }
    if (!docId) throw new Error('Document ID is required when no filter is provided');
    const existing = await couchDbRequest.call(this, 'GET', `/${db}/${docId}`);
    const currentRev = (existing as any)?._rev || rev;
    if (!currentRev) throw new Error('Revision not found for delete');
    const delRes = await couchDbRequest.call(this, 'DELETE', `/${db}/${docId}?rev=${currentRev}`);
    if (purgeAfterDelete) {
      await couchDbRequest.call(this, 'POST', `/${db}/_purge`, { [docId]: [currentRev] });
    }
    return [{ json: delRes }];
  }
  if (operation === 'purge') {
    return [{ json: await couchDbRequest.call(this, 'POST', `/${db}/_purge`, { [docId]: [rev] }) }];
  }

  if (operation === 'listDocs') {
    const skip = Math.max(0, (page - 1) * pageSize);
    const res = await couchDbRequest.call(this, 'GET', `/${db}/_all_docs?include_docs=${includeDocs}&limit=${pageSize}&skip=${skip}`);
    // Keep the structure closer to CouchDB response while normalizing docs if included
    if (includeDocs) {
      const rows = ((res as any)?.rows ?? []).map((row: any) => ({
        id: row.id,
        key: row.key,
        value: row.value,
        doc: row.doc ? normalizeDocumentObject(row.doc) : undefined,
      }));
      return this.helpers.returnJsonArray(rows as any[]);
    }
    return this.helpers.returnJsonArray(((res as any)?.rows ?? []).map((row: any) => ({ id: row.id, key: row.key, value: row.value })) as any[]);
  }
  throw new Error('Unsupported document operation');
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
