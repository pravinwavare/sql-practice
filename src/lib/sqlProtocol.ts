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

export type SqlWorkerRequest =
  | (RequestBase & { type: 'INITIALIZE' })
  | (RequestBase & { type: 'EXECUTE'; sql: string })
  | (RequestBase & { type: 'VALIDATE'; sql: string; solution: string; ordered: boolean })
  | (RequestBase & { type: 'RESET' })
  | (RequestBase & { type: 'SWITCH_DATABASE'; databaseId: import('../data/databases').DatabaseId })
  | (RequestBase & { type: 'LOAD_DATABASE'; databaseId: import('../data/databases').DatabaseId; buffer: ArrayBuffer; resetSnapshot?: ArrayBuffer });

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
