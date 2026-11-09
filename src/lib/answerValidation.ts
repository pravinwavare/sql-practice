import type { QueryResultSet, SqlValue } from './sqlProtocol';

const valueEqual = (left: SqlValue, right: SqlValue) => {
  if (left === null || right === null) return left === right;
  if (left instanceof Uint8Array || right instanceof Uint8Array) {
    return left instanceof Uint8Array
      && right instanceof Uint8Array
      && left.length === right.length
      && left.every((value, index) => value === right[index]);
  }
  if (typeof left !== typeof right) return false;
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right || Math.abs(left - right) <= 1e-7 * Math.max(1, Math.abs(left), Math.abs(right));
  }
  return left === right;
};
const rowEqual = (a: SqlValue[], b: SqlValue[]) => a.length === b.length && a.every((value, index) => valueEqual(value, b[index]));

export function resultsMatch(actual: QueryResultSet[], expected: QueryResultSet[], ordered = false): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((result, setIndex) => {
    const target = expected[setIndex];
    if (!target || result.columns.length !== target.columns.length || result.rowCount !== target.rowCount || result.rows.length !== target.rows.length || result.truncatedRows !== target.truncatedRows) return false;
    if (result.columns.some((column, index) => column.toLowerCase() !== target.columns[index]?.toLowerCase())) return false;
    if (result.rows.some((row) => row.length !== result.columns.length)
      || target.rows.some((row) => row.length !== target.columns.length)) return false;
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
