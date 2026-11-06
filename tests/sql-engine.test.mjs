import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { databases, defaultDatabaseId } from '../src/data/databases.ts';
import { questions } from '../src/data/questions.ts';
import { initializeSqlDatabases, executeSql } from '../src/lib/sqlExecution.ts';
import { resultsMatch } from '../src/lib/answerValidation.ts';
import { clearProgress, progressSummary, readProgress, writeAttempt } from '../src/lib/progress.ts';

const wasmPath = fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));
let initialized;
before(async () => { initialized = await initializeSqlDatabases(wasmPath); });
after(() => { for (const runtime of initialized?.runtimes.values() ?? []) runtime.database.close(); });
const runtime = (id = defaultDatabaseId) => initialized.runtimes.get(id);

test('seeds all three separate databases with valid relationships', () => {
  assert.deepEqual([...initialized.runtimes.keys()], ['hospital', 'company', 'ecommerce']);
  for (const db of initialized.runtimes.values()) {
    assert.equal(db.database.exec('PRAGMA foreign_key_check').length, 0);
    assert.ok(db.originalSnapshot.byteLength > 0);
  }
  assert.equal(runtime().database.exec('SELECT COUNT(*) FROM patients')[0].values[0][0], 24);
});

test('executes the requested Hospital queries and keeps accurate metadata', () => {
  const db = runtime().database;
  const select = executeSql(db, 'SELECT * FROM patients;', 200);
  assert.equal(select.resultSets[0].rowCount, 24);
  assert.equal(executeSql(db, 'SELECT COUNT(*) FROM patients;', 200).resultSets[0].rows[0][0], 24);
  const grouped = executeSql(db, 'SELECT city, COUNT(*) FROM patients GROUP BY city;', 200);
  assert.ok(grouped.resultSets[0].rows.length > 1);
});

test('supports create, insert, select, update, and delete statements', () => {
  const db = runtime().database;
  db.run('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO test_table VALUES (1, \'Test\');');
  assert.deepEqual(executeSql(db, 'SELECT * FROM test_table;', 200).resultSets[0].rows, [[1, 'Test']]);
  db.run("UPDATE test_table SET name = 'Updated' WHERE id = 1;");
  assert.equal(db.exec('SELECT name FROM test_table')[0].values[0][0], 'Updated');
  db.run('DELETE FROM test_table WHERE id = 1;');
  assert.equal(db.exec('SELECT COUNT(*) FROM test_table')[0].values[0][0], 0);
});

test('handles NULL, empty result, empty query, multiple statements and invalid SQL', () => {
  const db = runtime().database;
  assert.ok(executeSql(db, 'SELECT contact_number FROM patients WHERE contact_number IS NULL;', 200).resultSets[0].rows.some(([value]) => value === null));
  assert.equal(executeSql(db, 'SELECT * FROM patients WHERE patient_id = -1;', 200).resultSets[0].rowCount, 0);
  assert.equal(executeSql(db, '  ', 200).emptyQuery, true);
  assert.equal(executeSql(db, 'SELECT 1; SELECT 2;', 200).resultSets.length, 2);
  assert.throws(() => executeSql(db, 'SELEC invalid syntax', 200), /syntax error/i);
});

test('database reset snapshots restore the original database contents', () => {
  const SQL = initialized.SQL;
  const hospital = runtime();
  const altered = new SQL.Database(hospital.originalSnapshot.slice());
  altered.run('DELETE FROM patients');
  assert.equal(altered.exec('SELECT COUNT(*) FROM patients')[0].values[0][0], 0);
  const reset = new SQL.Database(hospital.originalSnapshot.slice());
  assert.equal(reset.exec('SELECT COUNT(*) FROM patients')[0].values[0][0], 24);
  altered.close(); reset.close();
});

test('practice catalog has 40 valid solutions that execute on clean database copies', () => {
  assert.equal(questions.length, 40);
  const counts = Object.fromEntries(['easy','medium','hard'].map((difficulty) => [difficulty, questions.filter((question) => question.difficulty === difficulty).length]));
  assert.deepEqual(counts, { easy:18, medium:16, hard:6 });
  for (const question of questions) {
    const db = new initialized.SQL.Database(runtime(question.databaseId).originalSnapshot.slice());
    try {
      const output = executeSql(db, question.solution, 10_000);
      assert.equal(output.emptyQuery, false, question.slug);
      assert.ok(output.resultSets.length > 0, question.slug);
    } finally { db.close(); }
  }
});

test('answer comparison ignores row order only when requested and handles NULL/numbers', () => {
  const a = [{columns:['value'],rows:[[1],[null],[2.5]],rowCount:3,truncatedRows:0}];
  const b = [{columns:['value'],rows:[[2.50000001],[1],[null]],rowCount:3,truncatedRows:0}];
  assert.equal(resultsMatch(a,b,false),true);
  assert.equal(resultsMatch(a,b,true),false);
});

test('e-commerce totals equal their line item subtotals', () => {
  const db = runtime('ecommerce').database;
  const mismatch = db.exec('SELECT o.order_id FROM orders o JOIN order_items i ON i.order_id=o.order_id GROUP BY o.order_id HAVING ABS(o.total_amount-SUM(i.quantity*i.unit_price)) > 0.011;');
  assert.equal(mismatch.length, 0);
});

test('reports engine initialization failures', async () => {
  await assert.rejects(() => initializeSqlDatabases(wasmPath, async () => { throw new Error('wasm failure'); }), /wasm failure/);
});

test('practice progress safely records, summarizes, recovers, and clears local data', () => {
  const values = new Map();
  const storage = { getItem:(key)=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,value), removeItem:(key)=>values.delete(key) };
  writeAttempt('select-all', false, storage);
  writeAttempt('select-all', true, storage);
  let state=readProgress(storage);
  assert.equal(state['select-all'].attempts,2);
  assert.equal(state['select-all'].correct,true);
  assert.equal(progressSummary(state).solved,1);
  values.set('sql-practice-progress-v1','invalid JSON');
  assert.deepEqual(readProgress(storage),{});
  clearProgress(storage);
  assert.equal(readProgress(storage)['select-all'],undefined);
});

test('each database snapshot is separate and resettable without cross-database changes', () => {
  for (const id of ['hospital','company','ecommerce']) {
    const clean=new initialized.SQL.Database(runtime(id).originalSnapshot.slice());
    const changed=new initialized.SQL.Database(runtime(id).originalSnapshot.slice());
    const table={hospital:'patients',company:'employees',ecommerce:'customers'}[id];
    const before=clean.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0];
    changed.run(`DELETE FROM ${table}`);
    assert.equal(clean.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0],before);
    const reset=new initialized.SQL.Database(runtime(id).originalSnapshot.slice());
    assert.equal(reset.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0],before);
    clean.close();changed.close();reset.close();
  }
});
