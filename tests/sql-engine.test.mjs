import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { databases, defaultDatabaseId } from '../src/data/databases.ts';
import { questions } from '../src/data/questions.ts';
import { referenceEntries } from '../src/data/reference.ts';
import { initializeSqlDatabases, executeSql } from '../src/lib/sqlExecution.ts';
import { resultsMatch } from '../src/lib/answerValidation.ts';
import { formatSql } from '../src/lib/sqlFormat.ts';
import { clearProgress, progressSummary, readProgress, recordAttempt, writeAttempt } from '../src/lib/progress.ts';

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

test('practice catalog has 52 valid solutions that execute on clean database copies', () => {
  assert.equal(questions.length, 52);
  const counts = Object.fromEntries(['easy','medium','hard'].map((difficulty) => [difficulty, questions.filter((question) => question.difficulty === difficulty).length]));
  assert.deepEqual(counts, { easy:22, medium:21, hard:9 });
  assert.equal(new Set(questions.map((question) => question.slug)).size, questions.length);
  assert.deepEqual(questions.filter((question) => question.ordered !== /\bORDER\s+BY\b/i.test(question.solution)).map((question) => question.slug), [], 'ordered flag matches each solution ORDER BY');
  assert.ok(questions.some((question) => question.databaseId === 'company'));
  assert.ok(questions.some((question) => question.databaseId === 'ecommerce'));
  for (const question of questions) {
    const db = new initialized.SQL.Database(runtime(question.databaseId).originalSnapshot.slice());
    try {
      const output = executeSql(db, question.solution, 10_000);
      assert.equal(output.emptyQuery, false, question.slug);
      assert.ok(output.resultSets.length > 0, question.slug);
    } finally { db.close(); }
  }
});

test('SQL reference topics are unique and syntax examples compile against their matching samples', () => {
  assert.equal(new Set(referenceEntries.map((entry) => entry.slug)).size, referenceEntries.length);
  assert.equal(new Set(referenceEntries.map((entry) => entry.title.toLowerCase())).size, referenceEntries.length);
  for (const entry of referenceEntries) {
    const dbId = /\b(employees|departments|salaries)\b/.test(entry.example) ? 'company'
      : /\b(customers|products|orders|order_items)\b/.test(entry.example) ? 'ecommerce' : 'hospital';
    const db = new initialized.SQL.Database(runtime(dbId).originalSnapshot.slice());
    try {
      try { executeSql(db, entry.example, 10_000); }
      catch (error) { throw new Error(`${entry.slug}: ${error.message}`); }
      if (entry.slug === 'any-all') assert.match(entry.summary, /does not implement/i);
    } finally { db.close(); }
  }
});

test('answer comparison ignores row order only when requested and handles NULL/numbers', () => {
  const a = [{columns:['value'],rows:[[1],[null],[2.5]],rowCount:3,truncatedRows:0}];
  const b = [{columns:['value'],rows:[[2.50000001],[1],[null]],rowCount:3,truncatedRows:0}];
  assert.equal(resultsMatch(a,b,false),true);
  assert.equal(resultsMatch(a,b,true),false);
});

test('answer comparison preserves types, NULLs, duplicate counts, and column order', () => {
  const result = (columns, rows) => [{ columns, rows, rowCount: rows.length, truncatedRows: 0 }];
  assert.equal(resultsMatch(result(['value'], [[1]]), result(['value'], [['1']])), false);
  assert.equal(resultsMatch(result(['value'], [[null]]), result(['value'], [['NULL']])), false);
  assert.equal(resultsMatch(result(['value'], [[1], [1], [2]]), result(['value'], [[2], [1], [1]])), true);
  assert.equal(resultsMatch(result(['value'], [[1], [1], [2]]), result(['value'], [[2], [1], [3]])), false);
  assert.equal(resultsMatch(result(['first', 'second'], [[1, 2]]), result(['second', 'first'], [[2, 1]])), false);
  assert.equal(resultsMatch(result(['value'], [[1], [2]]), result(['value'], [[2], [1]]), true), false);
  assert.equal(resultsMatch(result(['value'], [[1], [2]]), result(['value'], [[1], [2]]), true), true);
});

test('answer comparison validates multiple result sets and row shapes', () => {
  const set = (columns, rows) => ({ columns, rows, rowCount: rows.length, truncatedRows: 0 });
  assert.equal(resultsMatch([set(['a'], [[1]]), set(['b'], [[2]])], [set(['a'], [[1]]), set(['b'], [[2]])]), true);
  assert.equal(resultsMatch([set(['a'], [[1]])], [set(['a'], [[1]]), set(['b'], [[2]])]), false);
  assert.equal(resultsMatch([set(['a', 'b'], [[1]])], [set(['a', 'b'], [[1, 2]])]), false);
});

test('SQLite formatter preserves query behavior and leaves strings and comments intact', () => {
  const original = "select first_name, city from patients where city='Toronto' and first_name like 'A%' order by patient_id; -- keep Case\n";
  const formatted = formatSql(original);
  assert.match(formatted, /SELECT first_name,\n  city\nFROM patients\nWHERE city = 'Toronto'\n  AND first_name LIKE 'A%'\nORDER BY patient_id;/);
  assert.match(formatted, /-- keep Case/);
  const db = runtime().database;
  assert.equal(resultsMatch(executeSql(db, original, 200).resultSets, executeSql(db, formatted, 200).resultSets, true), true);
  for (const question of questions) {
    const testDb = new initialized.SQL.Database(runtime(question.databaseId).originalSnapshot.slice());
    try { assert.equal(resultsMatch(executeSql(testDb, question.solution, 10_000).resultSets, executeSql(testDb, formatSql(question.solution), 10_000).resultSets, question.ordered ?? false), true, question.slug); }
    finally { testDb.close(); }
  }
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

test('progress writes report browser storage failures without throwing', () => {
  const denied = { getItem() { throw new Error('storage disabled'); }, setItem() { throw new Error('quota exceeded'); } };
  assert.doesNotThrow(() => writeAttempt('select-all', true, denied));
  const write = recordAttempt('select-all', true, denied);
  assert.equal(write.saved, false);
  assert.equal(write.state['select-all'].correct, true);
  const quota = { getItem() { return null; }, setItem() { throw new Error('quota exceeded'); } };
  assert.equal(recordAttempt('select-all', false, quota).saved, false);
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
