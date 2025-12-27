# n8n CouchDB Nodes

Custom n8n nodes for Apache CouchDB with Mango selectors, paging, attachments, bulk updates/deletes, optional purge, and replace/merge update modes.

## What’s included
- Database: list (`{ name }`), create, delete.
- Document operations: create, get, find (Mango), list (_all_docs with paging), update, delete, purge.
- Attachments: get, put (base64), delete with automatic revision handling.
- Filters: Mango selector plus Simple Filters (field = value, dot notation) merged automatically; when no selector is provided, Document ID is required for get/update/delete.
- Pagination & sorting: page/pageSize, includeDocs toggle, optional metadata wrapper `{ docs, count, total }`, sort field/direction (server-side when selector allows, in-memory otherwise), extraFields when not returning full docs.
- Safety & normalization: empty selectors ignored; bodies must be valid JSON objects; returned docs are normalized to avoid character-spread errors; invalid docs raise clear errors.
- Update modes: merge by default; “Replace Document (override)” fully overwrites doc keeping `_id`/`_rev`.
- Delete modes: `_bulk_docs` delete with optional `_purge` of the same revisions (`Purge After Delete` on by default); standalone `purge` operation available.
- Get options: return only `_id`/`_rev` if desired; fetch specific revisions; include attachments, encoding info, `atts_since`, `_revisions`, `_revs_info`.

## Quickstart
1) Install deps: `npm install`
2) Build: `npm run build` (copies logo.svg into dist)
3) Mount in n8n (`N8N_CUSTOM_EXTENSIONS` + volume to `/home/node/.n8n/custom`)
4) Restart n8n/worker and find the node under Custom.

### Install via npm (when published)
- `npm install n8n-nodes-couchdb`
- Ensure `N8N_CUSTOM_EXTENSIONS` points to the installed path or mount the package into `/home/node/.n8n/custom` in Docker.

## Operations & key parameters (Document)
- Operation: create | get | find | list documents | update | delete | purge | get attachment | put attachment | delete attachment.
- Database: target DB name (loadOptions lists DBs via `_all_dbs`).
- Document ID: required when no selector is provided for get/update/delete/purge/attachments.
- Filter (Mango selector): JSON selector; overrides Document ID for get/find/update/delete.
- Simple Filters: quick equals filters (dot notation) merged into the selector.
- Pagination: Page Size + Page for find/list; includeDocs toggle; Wrap Response With Metadata (docs/count/total) or raw array.
- Sorting: sortField + sortDirection (server-side when the selector includes the field; otherwise sorted client-side); extraFields when returning metadata-only rows.
- Get options: returnFullDocument toggle; getRev to fetch a specific revision; attachments/attEncodingInfo/attsSince/revs/revsInfo flags.
- Update: Body JSON + Body Fields (dot notation merge); Replace Document (override) to fully overwrite.
- Delete: Purge After Delete to also `_purge` the deleted revisions.
- Purge (standalone): expects docId + rev.
- Attachments: get/put/delete with automatic revision fetch when not provided; put requires base64 data and content type.

## Examples
- Simple Filters (equals, dot notation): Field `metadata.category`, Value `news`; empty Mango selector ⇒ `{ "metadata.category": { "$eq": "news" } }`.
- Mango selector: Filter `{ "type": "workflow", "active": true }`.
- List documents with paging: Operation `List Documents`, Page Size `25`, Page `2`, Include Docs `true`, Wrap With Metadata `true`.
- Replace update: Operation `Update`, Replace Document `true`, Body `{ "name": "New Name" }` ⇒ keeps only `_id`, `_rev`, `name`.
- Delete with purge: Operation `Delete`, Purge After Delete `true`, Filter `{ "type": "old" }` ⇒ bulk delete + purge matching docs.
- Attachment upload: Operation `Put Attachment`, set Document ID, Attachment Name, base64 data, content type; revision auto-fetched if not provided.

### Workflow snippet (list paginated)
```json
{
  "nodes": [
    {
      "parameters": {
        "resource": "document",
        "operation": "listDocs",
        "db": "n8n_workflows",
        "pageSize": 25,
        "page": 2,
        "includeDocs": true
      },
      "name": "CouchDB List",
      "type": "n8n-nodes-couchdb.couchDb",
      "typeVersion": 1,
      "credentials": {
        "couchDbApi": {
          "id": "YOUR-CREDENTIAL-ID"
        }
      }
    }
  ]
}
```

## Credentials
- Type: `couchDbApi`
- Fields: Base URL (default `http://localhost:5984`), Username, Password

## Usage notes
- Leave Filter empty/`{}` to rely on Document ID; use Simple Filters for quick equals, or a full Mango selector for complex queries.
- Bulk update uses `_find` + `_bulk_docs`; replace mode overwrites everything except `_id`/`_rev`.
- Bulk delete uses `_find` + `_bulk_docs` and, if enabled, `_purge` with the same revision map.
- Purge expects `{ docId: [rev] }`; the delete flow builds this automatically when purge is enabled.
- If CouchDB returns non-object documents, the node raises a clear error instead of emitting character-keyed objects.