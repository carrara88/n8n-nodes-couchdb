import { couchDbRequest } from './transport';

export async function databaseOperations(this: any) {
  const operation = this.getNodeParameter('operation', 0);
  const db = this.getNodeParameter('db', 0, '') as string;

  if (operation === 'list') {
    const res = await couchDbRequest.call(this, 'GET', '/_all_dbs');
    return this.helpers.returnJsonArray((res as string[]).map((name) => ({ name })));
  }
  if (operation === 'create') {
    await couchDbRequest.call(this, 'PUT', `/${db}`);
    return [{ json: { success: true, db } }];
  }
  if (operation === 'delete') {
    await couchDbRequest.call(this, 'DELETE', `/${db}`);
    return [{ json: { success: true, db } }];
  }
  throw new Error('Unsupported database operation');
}
