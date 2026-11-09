import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { databases, type ColumnDefinition, type DatabaseDefinition, type DatabaseId } from '../data/databases.ts';
import type { QueryResultSet, SqlValue } from './sqlProtocol';

export interface SqlExecutionResult {
  resultSets: QueryResultSet[];
  totalRows: number;
  affectedRows: number;
  executionTimeMs: number;
  emptyQuery: boolean;
}

export interface DatabaseRuntime {
  id: DatabaseId;
  name: string;
  database: Database;
  originalSnapshot: Uint8Array;
}

const quoteIdentifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Invalid schema identifier: ${value}`);
  return `"${value}"`;
};

const sqlLiteral = (value: string | number | null) => {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Seed data cannot contain non-finite numbers.');
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
};

const columnSql = (column: ColumnDefinition) => {
  const identifier = quoteIdentifier(column.name);
  if (column.primaryKey) return `${identifier} ${column.type} PRIMARY KEY`;
  const required = column.nullable ? '' : ' NOT NULL';
  const reference = column.references
    ? ` REFERENCES ${quoteIdentifier(column.references.table)} (${quoteIdentifier(column.references.column)})`
    : '';
  return `${identifier} ${column.type}${required}${reference}`;
};

export function buildDatabaseSeedSql(definition: DatabaseDefinition) {
  const statements = ['PRAGMA foreign_keys = ON;'];
  for (const table of definition.tables) {
    const fields = table.columns.map(columnSql).join(',\n  ');
    statements.push(`CREATE TABLE ${quoteIdentifier(table.name)} (\n  ${fields}\n);`);
    if (table.rows.length === 0) continue;
    const columns = table.columns.map((column) => quoteIdentifier(column.name)).join(', ');
    const rows = table.rows.map((row) => {
      const values = table.columns.map((column) => {
        if (!(column.name in row)) throw new Error(`Missing ${table.name}.${column.name} in its seed row.`);
        return sqlLiteral(row[column.name]);
      });
      return `(${values.join(', ')})`;
    });
    statements.push(`INSERT INTO ${quoteIdentifier(table.name)} (${columns}) VALUES\n  ${rows.join(',\n  ')};`);
  }
  return statements.join('\n\n');
}

export async function initializeSqlDatabases(
  wasmLocation: string,
  initializeSqlJs: typeof initSqlJs = initSqlJs,
) {
  const SQL = await initializeSqlJs({ locateFile: () => wasmLocation });
  const runtimes = new Map<DatabaseId, DatabaseRuntime>();
  try {
    for (const definition of databases) {
      const database = new SQL.Database();
      database.run(buildDatabaseSeedSql(definition));
      const brokenRelationships = database.exec('PRAGMA foreign_key_check;');
      if (brokenRelationships.length > 0 && brokenRelationships[0].values.length > 0) {
        database.close();
        throw new Error(`${definition.name} contains invalid foreign-key relationships.`);
      }
      runtimes.set(definition.id, {
        id: definition.id,
        name: definition.name,
        database,
        originalSnapshot: database.export(),
      });
    }
    return { SQL, runtimes };
  } catch (error) {
    for (const runtime of runtimes.values()) runtime.database.close();
    throw error;
  }
}

const totalChanges = (database: Database) => {
  const result = database.exec('SELECT total_changes() AS changes');
  return Number(result[0]?.values[0]?.[0] ?? 0);
};

const isSingleSelect = (source: string) => {
  let cursor = 0;
  let depth = 0;
  let command = '';
  let withQuery = false;
  let semicolons = 0;
  while (cursor < source.length) {
    const char = source[cursor]!;
    if (/\s/.test(char)) { cursor += 1; continue; }
    if (char === '-' && source[cursor + 1] === '-') { cursor += 2; while (cursor < source.length && source[cursor] !== '\n') cursor += 1; continue; }
    if (char === '/' && source[cursor + 1] === '*') { cursor += 2; while (cursor < source.length && !(source[cursor] === '*' && source[cursor + 1] === '/')) cursor += 1; cursor = Math.min(source.length, cursor + 2); continue; }
    if (char === "'" || char === '"' || char === '`' || char === '[') {
      const closing = char === '[' ? ']' : char; cursor += 1;
      while (cursor < source.length) {
        if (source[cursor] === closing) { if (source[cursor + 1] === closing && char !== '[') { cursor += 2; continue; } cursor += 1; break; }
        cursor += 1;
      }
      continue;
    }
    if (char === '(') { depth += 1; cursor += 1; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); cursor += 1; continue; }
    if (char === ';' && depth === 0) { semicolons += 1; cursor += 1; continue; }
    if (depth === 0 && /[A-Za-z_]/.test(char)) {
      const start = cursor++;
      while (cursor < source.length && /[A-Za-z0-9_$]/.test(source[cursor]!)) cursor += 1;
      const word = source.slice(start, cursor).toUpperCase();
      if (!command && word === 'WITH') withQuery = true;
      else if (!command && !withQuery && word !== 'RECURSIVE') command = word;
      else if (withQuery && ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(word)) command = word;
    } else cursor += 1;
  }
  return command === 'SELECT' && semicolons <= 1;
};

export function executeSql(database: Database, query: string, displayLimit: number): SqlExecutionResult {
  const startedAt = performance.now();
  const emptyQuery = query.trim().length === 0;
  const changesBefore = totalChanges(database);
  const rawResults = emptyQuery ? [] : database.exec(query);
  const resultSets: QueryResultSet[] = rawResults.map((result) => {
    const rows = result.values.slice(0, displayLimit).map((row) => row as SqlValue[]);
    return {
      columns: result.columns,
      rows,
      rowCount: result.values.length,
      truncatedRows: Math.max(0, result.values.length - rows.length),
    };
  });

  // sql.js omits column metadata for empty SELECTs. Never prepare DDL/DML again.
  if (!emptyQuery && resultSets.length === 0 && isSingleSelect(query)) {
    const statement = database.prepare(query);
    try {
      const columns = statement.getColumnNames();
      if (columns.length > 0) resultSets.push({ columns, rows: [], rowCount: 0, truncatedRows: 0 });
    } finally { statement.free(); }
  }

  return {
    resultSets,
    totalRows: resultSets.reduce((count, result) => count + result.rowCount, 0),
    affectedRows: Math.max(0, totalChanges(database) - changesBefore),
    executionTimeMs: performance.now() - startedAt,
    emptyQuery,
  };
}

export type SqlModule = SqlJsStatic;
