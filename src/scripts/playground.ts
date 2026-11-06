import { basicSetup, EditorView } from 'codemirror';
import { sql, SQLite } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';
import { SqlWorkerClient } from '../lib/sqlWorkerClient';
import type { QueryResultSet, SqlValue } from '../lib/sqlProtocol';
import { databases, type DatabaseId } from '../data/databases';

const INITIAL_QUERIES: Record<string, string> = {
  hospital: 'SELECT * FROM patients LIMIT 10;',
  company: 'SELECT * FROM employees LIMIT 10;',
  ecommerce: 'SELECT * FROM customers LIMIT 10;',
};
const LONG_CELL_LIMIT = 2_000;

const getElement = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

export function mountPlayground() {
  const editorHost = getElement<HTMLDivElement>('#sql-editor');
  const runButton = getElement<HTMLButtonElement>('#run-query');
  const runButtonLabel = getElement<HTMLSpanElement>('#run-button-label');
  const resetQueryButton = getElement<HTMLButtonElement>('#reset-query');
  const formatButton = getElement<HTMLButtonElement>('#format-query');
  const resetDatabaseButton = getElement<HTMLButtonElement>('#reset-database');
  const databaseSelect = getElement<HTMLSelectElement>('#database-select');
  const schemaTables = getElement<HTMLDivElement>('#schema-tables');
  const resultsTab = getElement<HTMLButtonElement>('#results-tab');
  const messagesTab = getElement<HTMLButtonElement>('#messages-tab');
  const resultsPanel = getElement<HTMLDivElement>('#results-panel');
  const messagesPanel = getElement<HTMLDivElement>('#messages-panel');
  const resultsEmpty = getElement<HTMLDivElement>('#results-empty');
  const resultsOutput = getElement<HTMLDivElement>('#results-output');
  const resultSummary = getElement<HTMLDivElement>('#result-summary');
  const resultContent = getElement<HTMLDivElement>('#result-content');
  const queryMessage = getElement<HTMLParagraphElement>('#query-message');
  const engineStatus = getElement<HTMLParagraphElement>('#engine-status');
  const sidebar = getElement<HTMLElement>('#database-sidebar');
  const sidebarToggle = getElement<HTMLButtonElement>('#toggle-database');
  const sidebarToggleLabel = getElement<HTMLSpanElement>('#database-toggle-label');
  const shortcutKey = getElement<HTMLElement>('#run-shortcut-key');

  if (!editorHost || !runButton || !resetQueryButton || !formatButton) return;

  const setStatus = (message: string, isError = false) => {
    if (!engineStatus) return;
    engineStatus.textContent = message;
    engineStatus.classList.toggle('text-rose-700', isError);
    engineStatus.classList.toggle('text-slate-500', !isError);
  };

  const showTab = (active: 'results' | 'messages') => {
    const showResults = active === 'results';
    resultsTab?.setAttribute('aria-selected', String(showResults));
    messagesTab?.setAttribute('aria-selected', String(!showResults));
    resultsTab?.classList.toggle('border-teal-700', showResults);
    resultsTab?.classList.toggle('text-slate-900', showResults);
    resultsTab?.classList.toggle('font-semibold', showResults);
    resultsTab?.classList.toggle('border-transparent', !showResults);
    resultsTab?.classList.toggle('text-slate-500', !showResults);
    resultsTab?.classList.toggle('font-medium', !showResults);
    messagesTab?.classList.toggle('border-teal-700', !showResults);
    messagesTab?.classList.toggle('text-slate-900', !showResults);
    messagesTab?.classList.toggle('font-semibold', !showResults);
    messagesTab?.classList.toggle('border-transparent', showResults);
    messagesTab?.classList.toggle('text-slate-500', showResults);
    messagesTab?.classList.toggle('font-medium', showResults);
    resultsPanel?.classList.toggle('hidden', !showResults);
    messagesPanel?.classList.toggle('hidden', showResults);
  };

  const showMessage = (message: string, isError = false) => {
    if (queryMessage) {
      queryMessage.textContent = message;
      queryMessage.classList.toggle('text-rose-700', isError);
      queryMessage.classList.toggle('text-slate-600', !isError);
    }
    showTab('messages');
  };

  const renderSchema = (databaseId: DatabaseId) => {
    const definition = databases.find((database) => database.id === databaseId);
    if (!schemaTables || !definition) return;
    schemaTables.replaceChildren();
    definition.tables.forEach((table, index) => {
      const details = document.createElement('details');
      details.className = 'group rounded-md';
      details.open = index === 0;
      const summary = document.createElement('summary');
      summary.className = 'flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50';
      summary.textContent = `▦ ${table.name}`;
      const columns = document.createElement('ul');
      columns.className = 'ml-[1.15rem] border-l border-slate-200 py-1 pl-3 text-xs';
      table.columns.forEach((column) => {
        const item = document.createElement('li');
        item.className = 'flex items-center gap-2 py-1.5';
        const name = document.createElement('code');
        name.className = 'text-slate-700';
        name.textContent = column.name;
        const type = document.createElement('span');
        type.className = 'ml-auto text-slate-400';
        type.textContent = column.type;
        item.append(name, type);
        columns.append(item);
      });
      details.append(summary, columns);
      schemaTables.append(details);
    });
  };

  const engine = new SqlWorkerClient((message, isError = false) => setStatus(message, isError));
  const editor = new EditorView({
    doc: INITIAL_QUERIES.hospital,
    parent: editorHost,
    extensions: [
      basicSetup,
      sql({ dialect: SQLite }),
      EditorView.lineWrapping,
      keymap.of([{ key: 'Mod-Enter', run: () => { void runQuery(); return true; } }]),
      EditorView.theme({
        '&': { fontSize: '14px', color: '#1e293b', backgroundColor: '#ffffff' },
        '.cm-content': { minHeight: '18rem', padding: '1rem 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', caretColor: '#0f766e' },
        '.cm-gutters': { backgroundColor: '#ffffff', color: '#94a3b8', border: 'none', borderRight: '1px solid #e2e8f0' },
        '.cm-activeLineGutter': { backgroundColor: '#f8fafc', color: '#475569' },
        '.cm-activeLine': { backgroundColor: '#f8fafc' },
        '&.cm-focused': { outline: 'none' },
        '.cm-selectionBackground, ::selection': { backgroundColor: '#ccfbf1' },
      }),
    ],
  });

  if (shortcutKey && /Mac|iPhone|iPad/.test(navigator.platform)) shortcutKey.textContent = 'Cmd';

  const setRunning = (running: boolean) => {
    runButton.disabled = running;
    runButton.setAttribute('aria-busy', String(running));
    runButton.classList.toggle('cursor-wait', running);
    runButton.classList.toggle('opacity-70', running);
    if (runButtonLabel) runButtonLabel.textContent = running ? 'Running…' : 'Run';
    if (resetDatabaseButton) resetDatabaseButton.disabled = running;
  };

  const formatSql = (source: string) => {
    const syntaxTokens = /'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|--[^\n]*|\/\*[\s\S]*?\*\/|\b(?:SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|JOIN|UNION|AND|OR)\b/gi;
    return source.replace(syntaxTokens, (token, offset: number) => {
      if (/^[\'"`]|^--|^\/\*/.test(token)) return token;
      const lineBreak = offset === 0 || /^\s*$/.test(source.slice(0, offset)) ? '' : '\n';
      const indentation = /^(?:AND|OR)$/i.test(token) ? '  ' : '';
      return `${lineBreak}${indentation}${token.toUpperCase()}`;
    }).trim();
  };

  const showInitialResultState = (message = 'Your results will appear here') => {
    if (resultsEmpty) {
      resultsEmpty.classList.remove('hidden');
      const copy = resultsEmpty.querySelector('div');
      const title = copy?.querySelector('p:first-child');
      const description = copy?.querySelector('p:last-child');
      if (title) title.textContent = message;
      if (description) description.textContent = 'Run a query to see its output.';
    }
    resultsOutput?.classList.add('hidden');
  };

  const valueText = (value: SqlValue) => {
    if (value === null) return { text: 'NULL', isNull: true, truncated: false };
    if (value instanceof Uint8Array) {
      const text = `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
      return { text: text.length > LONG_CELL_LIMIT ? `${text.slice(0, LONG_CELL_LIMIT)}…` : text, isNull: false, truncated: text.length > LONG_CELL_LIMIT };
    }
    const text = String(value);
    return { text: text.length > LONG_CELL_LIMIT ? `${text.slice(0, LONG_CELL_LIMIT)}…` : text, isNull: false, truncated: text.length > LONG_CELL_LIMIT };
  };

  const appendResultTable = (resultSet: QueryResultSet, index: number, totalSets: number) => {
    if (!resultContent) return;
    const section = document.createElement('section');
    section.className = 'min-w-0';

    const tableCaption = document.createElement('h3');
    tableCaption.className = 'px-4 py-2 text-xs font-medium text-slate-500';
    tableCaption.textContent = totalSets > 1
      ? `Result set ${index + 1} · ${resultSet.rowCount.toLocaleString()} rows`
      : `${resultSet.rowCount.toLocaleString()} ${resultSet.rowCount === 1 ? 'row' : 'rows'}`;
    section.append(tableCaption);

    const overflow = document.createElement('div');
    overflow.className = 'max-w-full overflow-x-auto border-t border-slate-100';
    const table = document.createElement('table');
    table.className = 'w-full min-w-max border-collapse text-left text-sm';
    const thead = document.createElement('thead');
    thead.className = 'bg-slate-50 text-xs text-slate-500';
    const headerRow = document.createElement('tr');
    for (const column of resultSet.columns) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.className = 'whitespace-nowrap border-b border-slate-200 px-4 py-2.5 font-medium';
      th.textContent = column;
      headerRow.append(th);
    }
    thead.append(headerRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-slate-100 text-slate-700';
    for (const row of resultSet.rows) {
      const tr = document.createElement('tr');
      for (const value of row) {
        const td = document.createElement('td');
        td.className = 'max-w-96 whitespace-pre-wrap break-words px-4 py-2.5 align-top';
        const formatted = valueText(value);
        td.textContent = formatted.text;
        if (formatted.isNull) td.className += ' italic text-slate-400';
        if (formatted.truncated) td.setAttribute('aria-label', 'Value shortened for display.');
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
    overflow.append(table);
    section.append(overflow);

    if (resultSet.rowCount === 0) {
      const empty = document.createElement('p');
      empty.className = 'px-4 py-3 text-sm text-slate-500';
      empty.textContent = 'No rows returned.';
      section.append(empty);
    } else if (resultSet.truncatedRows > 0) {
      const truncated = document.createElement('p');
      truncated.className = 'px-4 py-2.5 text-xs text-slate-500';
      truncated.textContent = `Showing ${resultSet.rows.length.toLocaleString()} of ${resultSet.rowCount.toLocaleString()} rows. The full query completed; display is limited to ${resultSet.rows.length.toLocaleString()} rows.`;
      section.append(truncated);
    }

    resultContent.append(section);
  };

  const renderResults = (response: Awaited<ReturnType<SqlWorkerClient['execute']>>) => {
    if (!resultContent || !resultSummary || !resultsEmpty || !resultsOutput) return;
    resultContent.replaceChildren();
    resultsEmpty.classList.add('hidden');
    resultsOutput.classList.remove('hidden');

    if (response.emptyQuery) {
      showInitialResultState('No query to run');
      showMessage('Enter a SQL query first.');
      return;
    }

    const elapsed = `${response.executionTimeMs.toFixed(1)} ms`;
    if (response.resultSets.length === 0) {
      resultSummary.textContent = `Statement completed · ${response.affectedRows.toLocaleString()} ${response.affectedRows === 1 ? 'row' : 'rows'} affected · ${elapsed}`;
      const message = document.createElement('p');
      message.className = 'px-4 py-6 text-sm text-slate-600';
      message.textContent = 'Statement completed successfully. No result set was returned.';
      resultContent.append(message);
      showTab('results');
      return;
    }

    const rowLabel = `${response.totalRows.toLocaleString()} ${response.totalRows === 1 ? 'row' : 'rows'} returned`;
    const changeLabel = response.affectedRows > 0
      ? ` · ${response.affectedRows.toLocaleString()} ${response.affectedRows === 1 ? 'row' : 'rows'} affected`
      : '';
    resultSummary.textContent = `${rowLabel}${changeLabel} · ${elapsed}`;
    response.resultSets.forEach((resultSet, index) => appendResultTable(resultSet, index, response.resultSets.length));
    showTab('results');
  };

  const runQuery = async () => {
    if (runButton.disabled) return;
    setRunning(true);
    setStatus('Running query in the browser…');
    try {
      const response = await engine.execute(editor.state.doc.toString());
      renderResults(response);
      if (response.emptyQuery) {
        setStatus('The database is ready.');
      } else {
        setStatus(`Query completed in ${response.executionTimeMs.toFixed(1)} ms.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The SQL query could not be completed.';
      showInitialResultState('Query did not complete');
      showMessage(`SQL error: ${message}`, true);
      setStatus('The query did not complete.', true);
    } finally {
      setRunning(false);
    }
  };

  runButton.addEventListener('click', () => { void runQuery(); });

  databaseSelect?.addEventListener('change', async () => {
    if (runButton.disabled) return;
    const databaseId = databaseSelect.value as DatabaseId;
    databaseSelect.disabled = true;
    setStatus('Switching database…');
    try {
      const response = await engine.switchDatabase(databaseId);
      renderSchema(databaseId);
      editor.dispatch({ changes:{from:0,to:editor.state.doc.length,insert:INITIAL_QUERIES[databaseId] ?? INITIAL_QUERIES.hospital} });
      showInitialResultState();
      setStatus(`${response.databaseName} is ready. Queries run locally in your browser.`);
      showMessage(`${response.databaseName} selected. Each database keeps its own changes until reset.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The database could not be selected.';
      showMessage(`Database selection error: ${message}`, true);
      setStatus('The database could not be selected.', true);
    } finally { databaseSelect.disabled = false; }
  });

  resetQueryButton.addEventListener('click', () => {
    const starter = INITIAL_QUERIES[databaseSelect?.value ?? 'hospital'] ?? INITIAL_QUERIES.hospital;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: starter }, selection: { anchor: 0 } });
    editor.focus();
    showMessage('Query reset to the starter example. The database was not changed.');
  });

  formatButton.addEventListener('click', () => {
    const formatted = formatSql(editor.state.doc.toString());
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: formatted } });
    editor.focus();
    showMessage('Query formatted.');
  });

  resetDatabaseButton?.addEventListener('click', async () => {
    if (runButton.disabled) return;
    if (!window.confirm(`Restore the ${databaseSelect?.selectedOptions[0]?.textContent ?? 'selected database'} to its original sample data? This will discard changes made by your queries.`)) return;
    resetDatabaseButton.disabled = true;
    setStatus('Restoring the original database…');
    try {
      const response = await engine.resetDatabase();
      showInitialResultState();
      showMessage(response.message);
      setStatus(`${response.databaseName} is ready.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The database could not be restored.';
      showMessage(`Database reset error: ${message}`, true);
      setStatus('The database could not be restored.', true);
    } finally {
      resetDatabaseButton.disabled = false;
    }
  });

  resultsTab?.addEventListener('click', () => showTab('results'));
  messagesTab?.addEventListener('click', () => showTab('messages'));

  sidebarToggle?.addEventListener('click', () => {
    if (!sidebar) return;
    const collapsed = sidebar.dataset.collapsed !== 'true';
    sidebar.dataset.collapsed = String(collapsed);
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    if (sidebarToggleLabel) sidebarToggleLabel.textContent = collapsed ? 'Show database' : 'Hide database';
  });

  void engine.initialize()
    .then((response) => setStatus(`${response.databaseName} is ready. Queries run locally in your browser.`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'The SQLite engine could not start.';
      setStatus('The SQLite engine could not initialize.', true);
      showMessage(`Initialization error: ${message}`, true);
    });

  window.addEventListener('pagehide', () => {
    editor.destroy();
    engine.dispose();
  }, { once: true });
}
