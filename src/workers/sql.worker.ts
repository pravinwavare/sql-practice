import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { executeSql, initializeSqlDatabases, type DatabaseRuntime, type SqlModule } from '../lib/sqlExecution';
import { defaultDatabaseId, databaseById, type DatabaseId } from '../data/databases';
import { MAX_DISPLAY_ROWS, type SqlWorkerRequest, type SqlWorkerResponse } from '../lib/sqlProtocol';
import { resultsMatch } from '../lib/answerValidation';
import type { ImportedSchema } from '../lib/sqlProtocol';

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
const schemaFor = (database: DatabaseRuntime): ImportedSchema => {
  const tables = database.database.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values ?? [];
  const schemaTables: ImportedSchema['tables'] = [];
  const relationships: ImportedSchema['relationships'] = [];
  for (const [value] of tables) {
    const name = String(value);
    const quoted = `\"${name.replaceAll('\"', '\"\"')}\"`;
    const columns = database.database.exec(`PRAGMA table_info(${quoted})`)[0]?.values ?? [];
    const foreignKeys = database.database.exec(`PRAGMA foreign_key_list(${quoted})`)[0]?.values ?? [];
    const refs = new Map(foreignKeys.map((row) => [String(row[3]), { table: String(row[2]), column: String(row[4]) }]));
    schemaTables.push({ name, columns: columns.map((row) => {
      const columnName = String(row[1]);
      const reference = refs.get(columnName);
      if (reference) relationships.push({ fromTable: name, fromColumn: columnName, toTable: reference.table, toColumn: reference.column, description: `${name}.${columnName} references ${reference.table}.${reference.column}.` });
      return { name: columnName, type: String(row[2] || 'ANY'), primaryKey: Number(row[5]) > 0, ...(reference ? { references: reference } : {}) };
    }) });
  }
  return { tables: schemaTables, relationships };
};
const ready = (requestId: number, message: string): Extract<SqlWorkerResponse, {type:'READY'}> => {
  const runtime = active();
  return { type: 'READY', requestId, message, databaseId: activeId, databaseName: runtime.name, databaseSnapshot: toArrayBuffer(runtime.database.export()), originalSnapshot: toArrayBuffer(runtime.originalSnapshot), schema: schemaFor(runtime) };
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
  sendReady(requestId, `${active().name} selected.`);
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
  let runtime = runtimes.get(id);
  if (!runtime && id === 'custom') {
    const database = new SQL.Database(new Uint8Array(buffer));
    const snapshot = resetSnapshot ? new Uint8Array(resetSnapshot).slice() : new Uint8Array(buffer).slice();
    runtime = { id, name: 'Your database', database, originalSnapshot: snapshot };
    runtimes.set(id, runtime);
    activeId = id;
    database.run('PRAGMA foreign_keys = ON');
    sendReady(requestId, 'Database loaded successfully.');
    return;
  }
  if (!runtime) throw new Error('The selected database is not available.');
  const database = new SQL.Database(new Uint8Array(buffer));
  runtime.database.close();
  runtime.database = database;
  runtime.originalSnapshot = resetSnapshot ? new Uint8Array(resetSnapshot).slice() : new Uint8Array(buffer).slice();
  database.run('PRAGMA foreign_keys = ON');
  activeId = id;
  sendReady(requestId, 'Database loaded successfully.');
};
const importDatabase = (requestId: number, name: string, format: 'sqlite' | 'sql', buffer: ArrayBuffer) => {
  if (!SQL) throw new Error('The SQL engine has not been initialized.');
  const database = new SQL.Database();
  try {
    if (format === 'sqlite') {
      const imported = new SQL.Database(new Uint8Array(buffer));
      database.close();
      const snapshot = imported.export();
      runtimes.get('custom')?.database.close();
      runtimes.set('custom', { id: 'custom', name: name || 'Your database', database: imported, originalSnapshot: snapshot.slice() });
    } else {
      database.run(new TextDecoder().decode(buffer));
      database.run('PRAGMA foreign_keys = ON');
      const snapshot = database.export();
      runtimes.get('custom')?.database.close();
      runtimes.set('custom', { id: 'custom', name: name || 'Your database', database, originalSnapshot: snapshot.slice() });
    }
  } catch (error) {
    try { database.close(); } catch { /* The SQLite file path already closed this temporary handle. */ }
    throw error;
  }
  activeId = 'custom';
  sendReady(requestId, `${runtimes.get('custom')!.name} imported locally.`);
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
      case 'IMPORT_DATABASE': importDatabase(request.requestId, request.name, request.format, request.buffer); break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown SQL engine error occurred.';
    const response: SqlWorkerResponse = { type:'ERROR', requestId:request.requestId, message, databaseId:activeId };
    try { response.databaseSnapshot = toArrayBuffer(active().database.export()); } catch { /* initialization can fail before a database exists */ }
    if (response.databaseSnapshot) post(response, [response.databaseSnapshot]); else post(response);
  }
});
