# n8n CouchDB Nodes

Custom n8n nodes to work with Apache CouchDB (databases and documents) with selector-based operations, bulk updates, optional purging, and a replace mode for full overrides.

## Features
- Database: list (returns `{ name }`), create, delete.
- Document: create, get, find (Mango selector), list (paged `_all_docs` with include_docs), update, delete, purge.
- Filters: JSON Mango selector or Simple Filters (field = value, dot notation) merged automatically; Document ID when no selector.
- Pagination: page/pageSize for find and list documents; include_docs toggle when listing.
- Safety: empty selector `{}` ignored; bodies must be valid objects/JSON; docs normalized to avoid character-spread errors.
- Delete: optional “Purge After Delete” (default on) uses `_bulk_docs` + `_purge`.
- Update: “Replace Document (override)” flag to fully overwrite a doc, keeping only `_id` and `_rev`.

## Parameters (Document resource)
- Database: target DB name.
- Operation: create | get | find | list documents | update | delete | purge.
- Document ID: used when no selector (get/update/delete/purge).
- Filter (Mango selector): JSON selector; overrides Document ID for get/find/update/delete.
- Simple Filters: form-based equals filters (dot notation) merged into the selector.
- Page Size / Page: pagination for find and list documents.
- Include Docs: when listing documents, include full docs.
- Replace Document (override): for update; when true, missing keys are removed (only `_id`/`_rev` retained).
- Purge After Delete: when true, deletes also purge the same docs.
- Body: JSON object payload for create/update.

## Install & Build
1. From this package folder: `npm install`
2. Build: `npm run build`
3. Ensure n8n loads custom nodes, e.g. set `N8N_CUSTOM_EXTENSIONS`
4. Restart n8n (and worker) after changes.

## Usage Notes
- Leave Filter empty/`{}` to use Document ID; use Simple Filters for quick equals, or a full Mango selector for complex queries.
- For bulk update via selector, the node uses `_find` then `_bulk_docs` (with optional replace mode).
- For bulk delete via selector, the node marks `_deleted` via `_bulk_docs` then optionally purges the same revisions.
- Purge operation expects `{ docId: [rev] }`; the node builds this automatically in delete.
- If CouchDB returns invalid docs (e.g., strings), the node raises a clear error instead of producing character-keyed objects.