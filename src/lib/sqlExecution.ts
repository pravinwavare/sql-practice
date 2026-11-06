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

  if (!emptyQuery && resultSets.length === 0) {
    const statement = database.prepare(query);
    try {
      const columns = statement.getColumnNames();
      if (columns.length > 0) resultSets.push({ columns, rows: [], rowCount: 0, truncatedRows: 0 });
    } finally {
      statement.free();
    }
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
