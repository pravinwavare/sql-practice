export type RequestId = number;
export type SqlValue = string | number | null | Uint8Array;

export interface QueryResultSet {
  columns: string[];
  rows: SqlValue[][];
  rowCount: number;
  truncatedRows: number;
}

interface RequestBase {
  requestId: RequestId;
}

export interface ImportedSchema {
  tables: { name: string; columns: { name: string; type: string; primaryKey: boolean; references?: { table: string; column: string } }[] }[];
  relationships: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; description: string }[];
}

export type SqlWorkerRequest =
  | (RequestBase & { type: 'INITIALIZE' })
  | (RequestBase & { type: 'EXECUTE'; sql: string })
  | (RequestBase & { type: 'VALIDATE'; sql: string; solution: string; ordered: boolean })
  | (RequestBase & { type: 'RESET' })
  | (RequestBase & { type: 'SWITCH_DATABASE'; databaseId: import('../data/databases').DatabaseId })
  | (RequestBase & { type: 'LOAD_DATABASE'; databaseId: import('../data/databases').DatabaseId; buffer: ArrayBuffer; resetSnapshot?: ArrayBuffer; databaseName?: string })
  | (RequestBase & { type: 'IMPORT_DATABASE'; name: string; format: 'sqlite' | 'sql'; buffer: ArrayBuffer });

interface ResponseBase {
  requestId: RequestId;
}

export type SqlWorkerResponse =
  | (ResponseBase & {
      type: 'READY';
      message: string;
      databaseId: import('../data/databases').DatabaseId;
      databaseName: string;
      databaseSnapshot: ArrayBuffer;
      originalSnapshot: ArrayBuffer;
      schema: ImportedSchema;
    })
  | (ResponseBase & {
      type: 'RESULT';
      resultSets: QueryResultSet[];
      totalRows: number;
      affectedRows: number;
      executionTimeMs: number;
      displayLimit: number;
      databaseId: import('../data/databases').DatabaseId;
      databaseSnapshot: ArrayBuffer;
      emptyQuery: boolean;
    })
  | (ResponseBase & { type:'VALIDATION'; correct:boolean; resultSets:QueryResultSet[]; expectedSets:QueryResultSet[]; executionTimeMs:number; message:string; databaseId:import('../data/databases').DatabaseId })
  | (ResponseBase & { type: 'ERROR'; message: string; databaseId: import('../data/databases').DatabaseId; databaseSnapshot?: ArrayBuffer });

export const MAX_DISPLAY_ROWS = 200;
