import type { QueryResultSet, SqlValue } from './sqlProtocol';

const valueEqual = (left: SqlValue, right: SqlValue) => {
  if (left === null || right === null) return left === right;
  if (left instanceof Uint8Array || right instanceof Uint8Array) {
    const a = left instanceof Uint8Array ? [...left] : String(left);
    const b = right instanceof Uint8Array ? [...right] : String(right);
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) <= 1e-7 * Math.max(1, Math.abs(left), Math.abs(right));
  return String(left) === String(right);
};
const rowEqual = (a: SqlValue[], b: SqlValue[]) => a.length === b.length && a.every((value, index) => valueEqual(value, b[index]));

export function resultsMatch(actual: QueryResultSet[], expected: QueryResultSet[], ordered = false): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((result, setIndex) => {
    const target = expected[setIndex];
    if (!target || result.columns.length !== target.columns.length || result.rowCount !== target.rowCount || result.rows.length !== target.rows.length) return false;
    if (result.columns.some((column, index) => column.toLowerCase() !== target.columns[index]?.toLowerCase())) return false;
    if (ordered) return result.rows.every((row, index) => rowEqual(row, target.rows[index] ?? []));
    const unmatched = [...target.rows];
    return result.rows.every((row) => {
      const index = unmatched.findIndex((candidate) => rowEqual(row, candidate));
      if (index < 0) return false;
      unmatched.splice(index, 1);
      return true;
    });
  });
}
