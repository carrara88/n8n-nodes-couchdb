# n8n CouchDB Community Node (`n8n-nodes-couchdb`)

![https://www.npmjs.com/package/@carrara88/n8n-nodes-couchdb](https://img.shields.io/badge/repo-NPM-%23CB3837?logo=npm&logoColor=white)
![https://github.com/carrara88/n8n-nodes-couchdb](https://img.shields.io/badge/repo-github-blue?logo=github)
![https://github.com/apache/couchdb](https://img.shields.io/badge/repo-CouchDB-%23CB3837?logo=apache)

Custom n8n nodes for Apache CouchDB with:

- DB and document full CRUD
- Mango query selectors
- Paging
- **Attachments** management (base64 I/O)
- Bulk updates/deletes
- Purge
- Replace/merge update modes


## Links

- GitHub: 
- npm: https://www.npmjs.com/package/@carrara88/n8n-nodes-couchdb



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

## Installation (n8n)

### Install a community node via the n8n GUI (recommended)

Follow the official guide:
https://docs.n8n.io/integrations/community-nodes/installation/gui-install/#install-a-community-node

When prompted for the package name, install:
- `@carrara88/n8n-nodes-couchdb`

### Install via npm

- `npm i @carrara88/n8n-nodes-couchdb`

Then restart n8n so it loads the newly installed node.


## Usage notes
- Leave Filter empty/`{}` to rely on Document ID; use Simple Filters for quick equals, or a full Mango selector for complex queries.
- Bulk update uses `_find` + `_bulk_docs`; replace mode overwrites everything except `_id`/`_rev`.
- Bulk delete uses `_find` + `_bulk_docs` and, if enabled, `_purge` with the same revision map.
- Purge expects `{ docId: [rev] }`; the delete flow builds this automatically when purge is enabled.
- If CouchDB returns non-object documents, the node raises a clear error instead of emitting character-keyed objects.

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


### Attachments

- CouchDB attachments are stored under the document `_attachments` object.
- Downloading an attachment typically uses `GET /{db}/{docId}/{attachmentName}`.

### Delete vs purge (safety)

- `_bulk_docs` delete marks documents as deleted (tombstones) and keeps history.
- `_purge` is **irreversible** and bypasses normal revisioning/replication semantics.
- In this custom node, **"Purge After Delete" defaults to true** for the Document → Delete operation. If you want safer behavior, disable it and reserve purge for explicit maintenance tasks.

## Examples
- Simple Filters (equals, dot notation): Field `metadata.category`, Value `news`; empty Mango selector ⇒ `{ "metadata.category": { "$eq": "news" } }`.
- Mango selector: Filter `{ "type": "workflow", "active": true }`.
- List documents with paging: Operation `List Documents`, Page Size `25`, Page `2`, Include Docs `true`, Wrap With Metadata `true`.
- Replace update: Operation `Update`, Replace Document `true`, Body `{ "name": "New Name" }` ⇒ keeps only `_id`, `_rev`, `name`.
- Delete with purge: Operation `Delete`, Purge After Delete `true`, Filter `{ "type": "old" }` ⇒ bulk delete + purge matching docs.
- Attachment upload: Operation `Put Attachment`, set Document ID, Attachment Name, base64 data, content type; revision auto-fetched if not provided.

## Development Quickstart
This section is for local development/contributing.

1) Install deps: `npm install`
2) Build: `npm run build` (copies logo.svg into dist)
3) Make n8n load the node (for self-hosted n8n):
  - Option A (recommended): install the package in n8n as a Community Node (GUI)
  - Option B (advanced): use `N8N_CUSTOM_EXTENSIONS` and mount/copy this package into `/home/node/.n8n/custom`
4) Restart n8n/worker and find the node under Custom.

### Install via npm (when published)
- `npm i @carrara88/n8n-nodes-couchdb`
- If you run n8n in Docker and install the package on the host, ensure n8n can access it (e.g., install inside the container image, or mount `node_modules` appropriately).


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
      "type": "@carrara88/n8n-nodes-couchdb.couchDb",
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
