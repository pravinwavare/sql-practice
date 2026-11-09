const clauseWords = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', 'LEFT JOIN', 'LEFT OUTER JOIN', 'INNER JOIN', 'CROSS JOIN', 'JOIN', 'ON']);
const keywordWords = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'LEFT', 'OUTER', 'INNER', 'CROSS', 'JOIN', 'ON', 'AND', 'OR', 'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'WITH', 'RECURSIVE', 'NULL', 'IS', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'GLOB', 'COLLATE', 'RETURNING']);

interface Token { text: string; gap: string }

/** Formats SQLite SQL without rewriting literals, identifiers, or comments. */
export function formatSql(source: string): string {
  const tokens: Token[] = [];
  let index = 0;
  let gap = '';
  while (index < source.length) {
    const start = index;
    const char = source[index]!;
    if (/\s/.test(char)) { gap += char; index += 1; continue; }
    if (char === '-' && source[index + 1] === '-') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
    } else if (char === '/' && source[index + 1] === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index = Math.min(source.length, index + 2);
    } else if (char === "'" || char === '"' || char === '`' || char === '[') {
      const closing = char === '[' ? ']' : char;
      index += 1;
      while (index < source.length) {
        if (source[index] === closing) {
          if (source[index + 1] === closing && char !== '[') { index += 2; continue; }
          index += 1; break;
        }
        index += 1;
      }
    } else if (/[\p{L}_$]/u.test(char)) {
      index += 1;
      while (index < source.length && /[\p{L}\p{N}_$]/u.test(source[index]!)) index += 1;
    } else if (/[0-9]/.test(char)) {
      index += 1;
      while (index < source.length && /[\p{L}\p{N}_.]/u.test(source[index]!)) index += 1;
    } else if (['>=', '<=', '<>', '!=', '==', '||', '->', '->>'].some((operator) => source.startsWith(operator, index))) {
      const operator = ['->>', '>=', '<=', '<>', '!=', '==', '||', '->'].find((candidate) => source.startsWith(candidate, index))!;
      index += operator.length;
    } else index += 1;
    tokens.push({ text: source.slice(start, index), gap });
    gap = '';
  }

  const output: string[] = [];
  let depth = 0;
  const trimEnd = () => { while (output.length && /^\s+$/.test(output[output.length - 1]!)) output.pop(); };
  const addSpace = () => { if (output.length && !/\s$/.test(output[output.length - 1]!)) output.push(' '); };
  const addLine = () => { trimEnd(); if (output.length) output.push('\n'); };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const upper = token.text.toUpperCase();
    const next = tokens[i + 1]?.text.toUpperCase();
    const nextTwo = next && tokens[i + 2]?.text.toUpperCase() ? `${upper} ${next} ${tokens[i + 2]!.text.toUpperCase()}` : '';
    const phrase = nextTwo && clauseWords.has(nextTwo) ? nextTwo : next && clauseWords.has(`${upper} ${next}`) ? `${upper} ${next}` : clauseWords.has(upper) ? upper : '';
    const phraseLength = phrase ? phrase.split(' ').length : 1;
    if (phrase) {
      addLine();
      output.push(phrase);
      i += phraseLength - 1;
      if (i < tokens.length - 1) output.push(' ');
      continue;
    }
    if ((upper === 'AND' || upper === 'OR') && /^[\p{L}_]/u.test(token.text)) {
      addLine(); output.push(`  ${upper} `); continue;
    }
    if (token.text === ',') { trimEnd(); output.push(','); output.push(depth === 0 ? '\n  ' : ' '); continue; }
    if (token.text === ';') { trimEnd(); output.push(';'); if (i < tokens.length - 1) output.push('\n'); continue; }
    if (token.text === '(') {
      const previous = tokens[i - 1]?.text ?? '';
      if (token.gap && keywordWords.has(previous.toUpperCase())) addSpace();
      output.push('('); depth += 1; continue;
    }
    if (token.text === ')') { trimEnd(); output.push(')'); depth = Math.max(0, depth - 1); continue; }
    if (token.text === '.') { trimEnd(); output.push('.'); continue; }
    if (/^(?:=|==|!=|<>|<=|>=|<|>|\+|-|\/|\*|%|\|\|)$/.test(token.text)) {
      addSpace(); output.push(token.text); output.push(' '); continue;
    }
    if (token.text.startsWith('--') || token.text.startsWith('/*')) {
      if (token.gap.includes('\n')) addLine(); else addSpace();
      output.push(token.text);
      if (token.text.startsWith('--')) output.push('\n'); else output.push(' ');
      continue;
    }
    const previous = tokens[i - 1]?.text ?? '';
    if (token.gap && previous !== '(' && previous !== '.') addSpace();
    output.push(keywordWords.has(upper) && /^[\p{L}_]/u.test(token.text) ? upper : token.text);
  }
  return output.join('').trim();
}
