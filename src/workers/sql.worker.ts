import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { executeSql, initializeSqlDatabases, type DatabaseRuntime, type SqlModule } from '../lib/sqlExecution';
import { defaultDatabaseId, databaseById, type DatabaseId } from '../data/databases';
import { MAX_DISPLAY_ROWS, type SqlWorkerRequest, type SqlWorkerResponse } from '../lib/sqlProtocol';
import { resultsMatch } from '../lib/answerValidation';

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<SqlWorkerRequest>) => void): void;
  postMessage(message: SqlWorkerResponse, transfer?: Transferable[]): void;
}
const workerScope = self as unknown as WorkerScope;
let SQL: SqlModule | null = null;
let runtimes = new Map<DatabaseId, DatabaseRuntime>();
let activeId: DatabaseId = defaultDatabaseId;

const toArrayBuffer = (data: Uint8Array) => data.slice().buffer as ArrayBuffer;
const post = (response: SqlWorkerResponse, transfer: Transferable[] = []) => workerScope.postMessage(response, transfer);
const active = () => {
  const runtime = runtimes.get(activeId);
  if (!runtime) throw new Error('The selected database is not available.');
  return runtime;
};
const ready = (requestId: number, message: string): Extract<SqlWorkerResponse, {type:'READY'}> => {
  const runtime = active();
  return { type: 'READY', requestId, message, databaseId: activeId, databaseName: runtime.name, databaseSnapshot: toArrayBuffer(runtime.database.export()), originalSnapshot: toArrayBuffer(runtime.originalSnapshot) };
};
const sendReady = (requestId: number, message: string) => {
  const response = ready(requestId, message);
  post(response, [response.databaseSnapshot, response.originalSnapshot]);
};
const initialize = async (requestId: number) => {
  const result = await initializeSqlDatabases(wasmUrl);
  SQL = result.SQL;
  for (const runtime of runtimes.values()) runtime.database.close();
  runtimes = result.runtimes;
  activeId = defaultDatabaseId;
  sendReady(requestId, `${databaseById[activeId].name} is ready.`);
};
const switchDatabase = (requestId: number, id: DatabaseId) => {
  if (!runtimes.has(id)) throw new Error('That database is not available.');
  activeId = id;
  sendReady(requestId, `${databaseById[id].name} selected.`);
};
const reset = (requestId: number) => {
  if (!SQL) throw new Error('The SQL engine has not been initialized.');
  const runtime = active();
  const database = new SQL.Database(runtime.originalSnapshot.slice());
  runtime.database.close();
  runtime.database = database;
  database.run('PRAGMA foreign_keys = ON');
  sendReady(requestId, `${runtime.name} restored to its original state.`);
};
const load = (requestId: number, id: DatabaseId, buffer: ArrayBuffer, resetSnapshot?: ArrayBuffer) => {
  if (!SQL) throw new Error('The SQL engine has not been initialized.');
  const runtime = runtimes.get(id);
  if (!runtime) throw new Error('The selected database is not available.');
  const database = new SQL.Database(new Uint8Array(buffer));
  runtime.database.close();
  runtime.database = database;
  runtime.originalSnapshot = resetSnapshot ? new Uint8Array(resetSnapshot).slice() : new Uint8Array(buffer).slice();
  database.run('PRAGMA foreign_keys = ON');
  activeId = id;
  sendReady(requestId, 'Database loaded successfully.');
};
const execute = (requestId: number, sql: string) => {
  const runtime = active();
  const result = executeSql(runtime.database, sql, MAX_DISPLAY_ROWS);
  const databaseSnapshot = toArrayBuffer(runtime.database.export());
  post({ type:'RESULT', requestId, ...result, displayLimit:MAX_DISPLAY_ROWS, databaseId:activeId, databaseSnapshot }, [databaseSnapshot]);
};
const validate = (requestId: number, sql: string, solution: string, ordered: boolean) => {
  if (!SQL) throw new Error('The SQL engine has not been initialized.');
  const runtime = active();
  const started = performance.now();
  const userDb = new SQL.Database(runtime.originalSnapshot.slice());
  const referenceDb = new SQL.Database(runtime.originalSnapshot.slice());
  try {
    userDb.run('PRAGMA foreign_keys = ON');
    referenceDb.run('PRAGMA foreign_keys = ON');
    const actual = executeSql(userDb, sql, 10_000);
    const expected = executeSql(referenceDb, solution, 10_000);
    if (actual.emptyQuery) throw new Error('Enter a query before checking your answer.');
    if (actual.resultSets.some((set) => set.truncatedRows > 0) || expected.resultSets.some((set) => set.truncatedRows > 0)) {
      throw new Error('This answer returns too many rows to check safely. Add a filter or LIMIT clause.');
    }
    const correct = resultsMatch(actual.resultSets, expected.resultSets, ordered);
    post({ type:'VALIDATION', requestId, correct, resultSets:actual.resultSets, expectedSets:expected.resultSets, executionTimeMs:performance.now() - started, message:correct ? 'Correct. Your result matches the expected output.' : 'Not quite. Review the result, then try again.', databaseId:activeId });
  } finally {
    userDb.close();
    referenceDb.close();
  }
};

workerScope.addEventListener('message', async ({ data: request }) => {
  if (!request || typeof request.requestId !== 'number') return;
  try {
    switch (request.type) {
      case 'INITIALIZE': await initialize(request.requestId); break;
      case 'EXECUTE': execute(request.requestId, request.sql); break;
      case 'VALIDATE': validate(request.requestId, request.sql, request.solution, request.ordered); break;
      case 'RESET': reset(request.requestId); break;
      case 'SWITCH_DATABASE': switchDatabase(request.requestId, request.databaseId); break;
      case 'LOAD_DATABASE': load(request.requestId, request.databaseId, request.buffer, request.resetSnapshot); break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown SQL engine error occurred.';
    const response: SqlWorkerResponse = { type:'ERROR', requestId:request.requestId, message, databaseId:activeId };
    try { response.databaseSnapshot = toArrayBuffer(active().database.export()); } catch { /* initialization can fail before a database exists */ }
    if (response.databaseSnapshot) post(response, [response.databaseSnapshot]); else post(response);
  }
});
