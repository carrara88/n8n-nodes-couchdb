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
  const attachments = this.getNodeParameter('attachments', 0, false) as boolean;
  const attEncodingInfo = this.getNodeParameter('attEncodingInfo', 0, false) as boolean;
  const attsSinceRaw = this.getNodeParameter('attsSince', 0, '[]') as unknown;
  const revs = this.getNodeParameter('revs', 0, false) as boolean;
  const revsInfo = this.getNodeParameter('revsInfo', 0, false) as boolean;
  const getRev = this.getNodeParameter('getRev', 0, '') as string;
  const attachmentName = this.getNodeParameter('attachmentName', 0, '') as string;
  const attachmentData = this.getNodeParameter('attachmentData', 0, '') as string;
  const attachmentContentType = this.getNodeParameter('attachmentContentType', 0, 'application/octet-stream') as string;
  const returnFullDocument = this.getNodeParameter('returnFullDocument', 0, true) as boolean;

  const body = normalizeObject(rawBody, 'Body must be an object or valid JSON object string');
  const selector = mergeSelectors(normalizeSelector(rawFilter), buildSimpleSelector(simpleFilters));
  const attsSince = normalizeArray(attsSinceRaw);

  const hasFilter = selector && Object.keys(selector).length > 0;

  if (operation === 'create') return [{ json: await couchDbRequest.call(this, 'POST', `/${db}`, body) }];

  if (operation === 'get') {
    if (hasFilter) {
      const res = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector });
      const docs = ((res as any)?.docs ?? []).map(normalizeDocumentObject);
      if (returnFullDocument) return this.helpers.returnJsonArray(docs);
      return this.helpers.returnJsonArray(docs.map((d: any) => ({ _id: d._id, _rev: d._rev })));
    }
    if (!docId) throw new Error('Document ID is required when no filter is provided');
    const query = buildQuery({ attachments, att_encoding_info: attEncodingInfo, atts_since: attsSince, rev: getRev || undefined, revs, revs_info: revsInfo });
    const doc = await couchDbRequest.call(this, 'GET', `/${db}/${docId}${query}`);
    if (returnFullDocument) return [{ json: doc }];
    return [{ json: { _id: (doc as any)?._id ?? docId, _rev: (doc as any)?._rev } }];
  }

  if (operation === 'find') {
    const skip = Math.max(0, (page - 1) * pageSize);
    if (!hasFilter) {
      // Fallback to _all_docs when no selector/filters are provided
      const res = await couchDbRequest.call(this, 'GET', `/${db}/_all_docs?include_docs=${includeDocs}&limit=${pageSize}&skip=${skip}`);
      if (includeDocs) {
        const docs = ((res as any)?.rows ?? [])
          .map((row: any) => (row.doc ? normalizeDocumentObject(row.doc) : undefined))
          .filter((d: any) => d !== undefined);
        return this.helpers.returnJsonArray(docs as any[]);
      }
      return this.helpers.returnJsonArray(((res as any)?.rows ?? []).map((row: any) => ({ id: row.id, key: row.key, value: row.value })) as any[]);
    }
    const res = await couchDbRequest.call(this, 'POST', `/${db}/_find`, { selector, limit: pageSize, skip });
    const docs = ((res as any)?.docs ?? []).map(normalizeDocumentObject);
    if (includeDocs) return this.helpers.returnJsonArray(docs);
    return this.helpers.returnJsonArray(docs.map((d: any) => ({ _id: d._id, _rev: d._rev })));
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
    return [{ json: { _id: docId, attachment: attachmentName, contentType, data } }];
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
    return [{ json: res as any }];
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
    return [{ json: res as any }];
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
    if (includeDocs) {
      const docs = ((res as any)?.rows ?? [])
        .map((row: any) => (row.doc ? normalizeDocumentObject(row.doc) : undefined))
        .filter((d: any) => d !== undefined);
      return this.helpers.returnJsonArray(docs as any[]);
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
