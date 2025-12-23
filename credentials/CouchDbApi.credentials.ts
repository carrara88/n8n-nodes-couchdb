import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class CouchDbApi implements ICredentialType {
  name = 'couchDbApi';
  displayName = 'CouchDB API';

  properties: INodeProperties[] = [
    { displayName: 'Base URL', name: 'baseUrl', type: 'string', default: 'http://localhost:5984', required: true },
    { displayName: 'Username', name: 'username', type: 'string', default: '' },
    { displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '' }
  ];
}
