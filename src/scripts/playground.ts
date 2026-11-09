import { basicSetup, EditorView } from 'codemirror';
import { sql, SQLite } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { SqlWorkerClient } from '../lib/sqlWorkerClient';
import type { ImportedSchema, QueryResultSet, SqlValue } from '../lib/sqlProtocol';
import { databases, type DatabaseId } from '../data/databases';
import { questionBySlug } from '../data/questions';
import { recordAttempt } from '../lib/progress';
import { formatSql } from '../lib/sqlFormat';

const INITIAL_QUERIES: Record<string, string> = {
  hospital: 'SELECT * FROM patients LIMIT 10;',
  company: 'SELECT * FROM employees LIMIT 10;',
  ecommerce: 'SELECT * FROM customers LIMIT 10;',
};
const LONG_CELL_LIMIT = 2_000;
const themeCompartment = new Compartment();

const editorTheme = (dark: boolean) => [
  EditorView.theme({
    '&': { fontSize: '14px', color: dark ? '#e4eeea' : '#1e293b', backgroundColor: dark ? '#111c19' : '#ffffff' },
    '.cm-content': { minHeight: '18rem', padding: '1rem 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', caretColor: dark ? '#56d3a6' : '#0f766e' },
    '.cm-gutters': { backgroundColor: dark ? '#111c19' : '#ffffff', color: dark ? '#6b8279' : '#94a3b8', border: 'none', borderRight: `1px solid ${dark ? '#263630' : '#e2e8f0'}` },
    '.cm-activeLineGutter': { backgroundColor: dark ? '#172520' : '#f8fafc', color: dark ? '#b7c9c1' : '#475569' },
    '.cm-activeLine': { backgroundColor: dark ? '#172520' : '#f8fafc' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, ::selection': { backgroundColor: dark ? '#214b3e' : '#ccfbf1' },
  }, { dark }),
  syntaxHighlighting(HighlightStyle.define([
    { tag: tags.keyword, color: dark ? '#8fc7ff' : '#6d5bd0', fontWeight: '650' },
    { tag: tags.operator, color: dark ? '#e5b66a' : '#a75e2b' },
    { tag: tags.string, color: dark ? '#a9d789' : '#a35c1b' },
    { tag: tags.number, color: dark ? '#efad82' : '#b45309' },
    { tag: tags.comment, color: dark ? '#81938b' : '#8a9691', fontStyle: 'italic' },
    { tag: tags.variableName, color: dark ? '#e4eeea' : '#334155' },
    { tag: tags.typeName, color: dark ? '#72d4bd' : '#0f766e' },
  ], { themeType: dark ? 'dark' : 'light' })),
];

const getElement = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

export function mountPlayground() {
  const editorHost = getElement<HTMLDivElement>('#sql-editor');
  const runButton = getElement<HTMLButtonElement>('#run-query');
  const runButtonLabel = getElement<HTMLSpanElement>('#run-button-label');
  const resetQueryButton = getElement<HTMLButtonElement>('#reset-query');
  const formatButton = getElement<HTMLButtonElement>('#format-query');
  const resetDatabaseButton = getElement<HTMLButtonElement>('#reset-database');
  const databaseSelect = getElement<HTMLSelectElement>('#database-select');
  const databaseFileInput = getElement<HTMLInputElement>('#database-file');
  const importDatabaseButton = getElement<HTMLButtonElement>('#import-database');
  const schemaTables = getElement<HTMLDivElement>('#schema-tables');
  const schemaRelationships = getElement<HTMLDivElement>('#schema-relationships');
  const clearQueryButton = getElement<HTMLButtonElement>('#clear-query');
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
  const formatShortcutLabel = getElement<HTMLElement>('#format-shortcut-label');

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

  const renderSchema = (databaseId: DatabaseId, importedSchema?: ImportedSchema) => {
    const definition = databases.find((database) => database.id === databaseId);
    const tables = importedSchema?.tables ?? definition?.tables;
    const relationships = importedSchema?.relationships ?? definition?.relationships;
    if (!schemaTables || !tables || !relationships) return;
    schemaTables.replaceChildren();
    tables.forEach((table, index) => {
      const details = document.createElement('details');
      details.className = 'group rounded-md';
      details.open = index === 0;
      const summary = document.createElement('summary');
      summary.className = 'flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50';
      summary.textContent = `▦ ${table.name}`;
      const useTable = document.createElement('button');
      useTable.type = 'button';
      useTable.dataset.tableQuery = table.name;
      useTable.className = 'ml-8 mt-1 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50';
      useTable.textContent = `Use SELECT * from ${table.name}`;
      const columns = document.createElement('ul');
      columns.className = 'ml-[1.15rem] border-l border-slate-200 py-1 pl-3 text-xs';
      table.columns.forEach((column) => {
        const item = document.createElement('li');
        item.className = 'flex items-center gap-2 py-1.5';
        const insertColumn = document.createElement('button');
        insertColumn.type = 'button';
        insertColumn.dataset.columnQuery = column.name;
        insertColumn.className = 'min-w-0 truncate text-left text-slate-700 hover:text-teal-800';
        insertColumn.setAttribute('aria-label', `Insert ${column.name} into query`);
        const marker = document.createElement('span');
        marker.className = column.primaryKey ? 'text-amber-600' : column.references ? 'text-sky-700' : 'text-transparent';
        marker.textContent = column.primaryKey ? '◆' : column.references ? '↗' : '·';
        marker.title = column.primaryKey ? 'Primary key' : column.references ? `Foreign key to ${column.references.table}.${column.references.column}` : '';
        const name = document.createElement('code');
        name.textContent = column.name;
        insertColumn.append(name);
        const type = document.createElement('span');
        type.className = 'ml-auto text-slate-400';
        type.textContent = column.type;
        item.prepend(marker);
        item.append(insertColumn, type);
        columns.append(item);
      });
      details.append(summary, useTable, columns);
      schemaTables.append(details);
    });
    if (schemaRelationships) {
      schemaRelationships.replaceChildren();
      const heading = document.createElement('p');
      heading.className = 'mb-2 text-xs font-semibold tracking-wide text-slate-500';
      heading.textContent = 'RELATIONSHIPS';
      schemaRelationships.append(heading);
      if (!relationships.length) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-slate-400';
        empty.textContent = 'No table relationships defined.';
        schemaRelationships.append(empty);
      }
      relationships.forEach((relationship) => {
        const row = document.createElement('p');
        row.className = 'py-1 text-xs leading-5 text-slate-600';
        row.textContent = `${relationship.fromTable}.${relationship.fromColumn} → ${relationship.toTable}.${relationship.toColumn}`;
        row.title = relationship.description;
        schemaRelationships.append(row);
      });
    }
  };

  const engine = new SqlWorkerClient((message, isError = false) => setStatus(message, isError));
  const savedQueryKey = (databaseId: string) => `sql-practice-query-${databaseId}-v1`;
  const getSavedQuery = (databaseId: string) => {
    try { return localStorage.getItem(savedQueryKey(databaseId)); }
    catch { return null; }
  };
  const saveQuery = (databaseId: string, query: string) => {
    try { localStorage.setItem(savedQueryKey(databaseId), query); }
    catch { /* The editor remains usable when browser storage is unavailable. */ }
  };
  const initialDatabaseId = databaseSelect?.value ?? 'hospital';
  let activeDatabaseId = initialDatabaseId as DatabaseId;
  let activeQuestionSlug: string | null = null;
  let queryExecuting = false;
  let databaseSwitching = false;
  const currentTheme = () => document.documentElement.dataset.theme === 'dark';
  const editor = new EditorView({
    doc: getSavedQuery(initialDatabaseId) ?? INITIAL_QUERIES[initialDatabaseId] ?? INITIAL_QUERIES.hospital,
    parent: editorHost,
    extensions: [
      basicSetup,
      sql({ dialect: SQLite }),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) saveQuery(activeDatabaseId, update.state.doc.toString());
      }),
      keymap.of([
        { key: 'Mod-Enter', run: () => { void runQuery(); return true; } },
        { key: 'Mod-Shift-f', run: (view) => {
          const formatted = formatSql(view.state.doc.toString());
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
          return true;
        } },
      ]),
      themeCompartment.of(editorTheme(currentTheme())),
    ],
  });

  if (/Mac|iPhone|iPad/.test(navigator.platform)) {
    if (shortcutKey) shortcutKey.textContent = '⌘';
    if (formatShortcutLabel) formatShortcutLabel.textContent = '⌘+Shift+F';
  }
  window.addEventListener('sql-theme-changed', () => {
    editor.dispatch({ effects: themeCompartment.reconfigure(editorTheme(currentTheme())) });
  });

  const isBusy = () => queryExecuting || databaseSwitching;
  const syncBusyState = () => {
    const busy = isBusy();
    runButton.disabled = busy;
    runButton.setAttribute('aria-busy', String(queryExecuting));
    runButton.classList.toggle('cursor-wait', busy);
    runButton.classList.toggle('opacity-70', busy);
    if (runButtonLabel) runButtonLabel.textContent = queryExecuting ? 'Running…' : activeQuestionSlug ? 'Run & Check' : 'Run';
    if (resetDatabaseButton) resetDatabaseButton.disabled = busy;
    if (databaseSelect) databaseSelect.disabled = busy;
    window.dispatchEvent(new CustomEvent('sql-workspace-busy', { detail: { busy } }));
  };
  const setRunning = (running: boolean) => {
    queryExecuting = running;
    syncBusyState();
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

  const renderResults = (response: Awaited<ReturnType<SqlWorkerClient['execute']>>, checked?: { correct: boolean; message: string }) => {
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
      resultSummary.textContent = `Statement completed · ${response.affectedRows.toLocaleString()} ${response.affectedRows === 1 ? 'row' : 'rows'} affected · ${elapsed}${checked ? ` · ${checked.correct ? '✓ Correct answer' : 'Answer not matched'}` : ''}`;
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
    resultSummary.textContent = `${rowLabel}${changeLabel} · ${elapsed}${checked ? ` · ${checked.correct ? '✓ Correct answer' : 'Answer not matched'}` : ''}`;
    response.resultSets.forEach((resultSet, index) => appendResultTable(resultSet, index, response.resultSets.length));
    showTab('results');
  };

  const runQuery = async () => {
    if (runButton.disabled) return;
    setRunning(true);
    setStatus('Running query in the browser…');
    try {
      const sqlText = editor.state.doc.toString();
      const question = activeQuestionSlug ? questionBySlug[activeQuestionSlug] : undefined;
      const validation = question ? await engine.validate(sqlText, question.solution, question.ordered ?? false) : undefined;
      const response = await engine.execute(sqlText);
      renderResults(response, validation);
      let progressSaved = true;
      if (question && validation) {
        const progress = recordAttempt(question.slug, validation.correct);
        progressSaved = progress.saved;
        window.dispatchEvent(new CustomEvent('sql-question-graded', { detail: { slug: question.slug, correct: validation.correct, attempts: progress.state[question.slug]?.attempts ?? 1, progressSaved, expectedSets: validation.expectedSets } }));
        if (queryMessage) {
          queryMessage.textContent = validation.message;
          queryMessage.classList.toggle('text-rose-700', false);
          queryMessage.classList.toggle('text-slate-600', true);
        }
      }
      if (response.emptyQuery) {
        setStatus('The database is ready.');
      } else {
        const suffix = validation ? (validation.correct ? ' Answer is correct.' : ' Keep adjusting your output.') : '';
        setStatus(`Query completed in ${response.executionTimeMs.toFixed(1)} ms.${suffix}${!progressSaved ? ' Progress could not be saved on this device.' : ''}`);
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

  const switchDatabase = async (databaseId: DatabaseId): Promise<boolean> => {
    if (isBusy()) return false;
    if (databaseId === activeDatabaseId) {
      if (databaseSelect) databaseSelect.value = activeDatabaseId;
      return true;
    }
    databaseSwitching = true;
    syncBusyState();
    setStatus('Switching database…');
    try {
      const response = await engine.switchDatabase(databaseId);
      activeDatabaseId = response.databaseId;
      if (databaseSelect) databaseSelect.value = activeDatabaseId;
      renderSchema(activeDatabaseId, response.schema);
      editor.dispatch({ changes:{from:0,to:editor.state.doc.length,insert:getSavedQuery(activeDatabaseId) ?? INITIAL_QUERIES[activeDatabaseId] ?? INITIAL_QUERIES.hospital} });
      showInitialResultState();
      setStatus(`${response.databaseName} is ready. Queries run locally in your browser.`);
      showMessage(`${response.databaseName} selected. Each database keeps its own changes until reset.`);
      return true;
    } catch (error) {
      if (databaseSelect) databaseSelect.value = activeDatabaseId;
      const message = error instanceof Error ? error.message : 'The database could not be selected.';
      showMessage(`Database selection error: ${message}`, true);
      setStatus('The database could not be selected.', true);
      return false;
    } finally {
      databaseSwitching = false;
      syncBusyState();
    }
  };

  databaseSelect?.addEventListener('change', () => {
    if (isBusy()) { databaseSelect.value = activeDatabaseId; return; }
    if (activeQuestionSlug) {
      activeQuestionSlug = null;
      if (runButtonLabel) runButtonLabel.textContent = 'Run';
      window.dispatchEvent(new CustomEvent('sql-practice-cleared'));
    }
    void switchDatabase(databaseSelect.value as DatabaseId);
  });

  importDatabaseButton?.addEventListener('click', () => databaseFileInput?.click());
  databaseFileInput?.addEventListener('change', async () => {
    const file = databaseFileInput.files?.[0];
    if (!file || isBusy()) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['db', 'sqlite', 'sqlite3', 'sql'].includes(extension ?? '')) {
      showMessage('Choose a SQLite database (.db, .sqlite) or a SQLite .sql dump.', true);
      databaseFileInput.value = '';
      return;
    }
    databaseSwitching = true;
    syncBusyState();
    setStatus(`Importing ${file.name} locally…`);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const databaseName = file.name.replace(/\.(db|sqlite|sqlite3|sql)$/i, '');
      const response = await engine.importDatabase(databaseName, extension === 'sql' ? 'sql' : 'sqlite', bytes);
      activeDatabaseId = 'custom';
      if (databaseSelect && !databaseSelect.querySelector('option[value="custom"]')) {
        const option = document.createElement('option');
        option.value = 'custom';
        option.textContent = response.databaseName;
        databaseSelect.append(option);
      }
      const customOption = databaseSelect?.querySelector<HTMLOptionElement>('option[value="custom"]');
      if (customOption) customOption.textContent = response.databaseName;
      if (databaseSelect) databaseSelect.value = 'custom';
      if (activeQuestionSlug) {
        activeQuestionSlug = null;
        if (runButtonLabel) runButtonLabel.textContent = 'Run';
        window.dispatchEvent(new CustomEvent('sql-practice-cleared'));
      }
      renderSchema('custom', response.schema);
      const firstTable = response.schema.tables[0]?.name;
      const initialQuery = firstTable ? `SELECT * FROM "${firstTable.replaceAll('"', '""')}" LIMIT 10;` : '';
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: initialQuery } });
      saveQuery('custom', initialQuery);
      showInitialResultState();
      setStatus(`${response.databaseName} imported. Queries run locally in your browser.`);
      showMessage(`${response.databaseName} imported for this browser session. Nothing was uploaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The database file could not be imported.';
      showMessage(`Import error: ${message}`, true);
      setStatus('The database could not be imported.', true);
    } finally {
      databaseSwitching = false;
      databaseFileInput.value = '';
      syncBusyState();
    }
  });

  window.addEventListener('sql-question-selected', async (event) => {
    if (isBusy()) return;
    const detail = (event as CustomEvent<{ slug: string }>).detail;
    const question = questionBySlug[detail?.slug ?? ''];
    if (!question) return;
    activeQuestionSlug = question.slug;
    if (runButtonLabel) runButtonLabel.textContent = 'Run & Check';
    if (activeDatabaseId !== question.databaseId) {
      const switched = await switchDatabase(question.databaseId);
      if (!switched) return;
    }
    const starter = `-- ${question.title}\n-- Write your answer below.\n`;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: starter }, selection: { anchor: starter.length } });
    editor.focus();
    showInitialResultState('Your answer will appear here');
    setStatus(`Practice mode · ${question.title}. Run your query to check it.`);
  });

  window.addEventListener('sql-insert-query', (event) => {
    const detail = (event as CustomEvent<{ query: string; clearPractice?: boolean }>).detail;
    if (!detail?.query) return;
    if (detail.clearPractice && activeQuestionSlug) {
      activeQuestionSlug = null;
      if (runButtonLabel) runButtonLabel.textContent = 'Run';
      window.dispatchEvent(new CustomEvent('sql-practice-cleared'));
    }
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: detail.query }, selection: { anchor: 0 } });
    editor.focus();
  });

  resetQueryButton.addEventListener('click', () => {
    const activeQuestion = activeQuestionSlug ? questionBySlug[activeQuestionSlug] : undefined;
    const starter = activeQuestion
      ? `-- ${activeQuestion.title}\n-- Write your answer below.\n`
      : INITIAL_QUERIES[activeDatabaseId] ?? INITIAL_QUERIES.hospital;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: starter }, selection: { anchor: 0 } });
    saveQuery(activeDatabaseId, starter);
    editor.focus();
    showMessage('Query reset to the starter example. The database was not changed.');
  });

  clearQueryButton?.addEventListener('click', () => {
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '' } });
    editor.focus();
    showMessage('Editor cleared. Reset restores the starter query.');
  });

  formatButton.addEventListener('click', () => {
    const formatted = formatSql(editor.state.doc.toString());
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: formatted } });
    editor.focus();
    showMessage('Query formatted.');
  });

  schemaTables?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const insertButton = target.closest<HTMLButtonElement>('[data-table-query]');
    const tableName = insertButton?.dataset.tableQuery;
    if (tableName) {
      const query = `SELECT * FROM "${tableName.replaceAll('"', '""')}" LIMIT 10;`;
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: query }, selection: { anchor: 0 } });
      editor.focus();
      showMessage(`Starter query for ${tableName} added to the editor.`);
      return;
    }
    const insertColumn = target.closest<HTMLButtonElement>('[data-column-query]');
    const columnName = insertColumn?.dataset.columnQuery;
    if (!columnName) return;
    const cursor = editor.state.selection.main.head;
    const quotedColumn = `"${columnName.replaceAll('"', '""')}"`;
    editor.dispatch({ changes: { from: cursor, insert: quotedColumn }, selection: { anchor: cursor + quotedColumn.length } });
    editor.focus();
    showMessage(`${columnName} inserted at the cursor.`);
  });

  resetDatabaseButton?.addEventListener('click', async () => {
    if (isBusy()) return;
    if (!window.confirm(`Restore ${databaseSelect?.selectedOptions[0]?.textContent ?? 'the selected database'} to its original state? This will discard changes made by your queries.`)) return;
    databaseSwitching = true;
    syncBusyState();
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
      databaseSwitching = false;
      syncBusyState();
    }
  });

  resultsTab?.addEventListener('click', () => showTab('results'));
  messagesTab?.addEventListener('click', () => showTab('messages'));

  sidebarToggle?.addEventListener('click', () => {
    if (!sidebar) return;
    const collapsed = sidebar.dataset.collapsed !== 'true';
    sidebar.dataset.collapsed = String(collapsed);
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    if (sidebarToggleLabel) sidebarToggleLabel.textContent = collapsed ? 'Show schema' : 'Hide schema';
  });

  void engine.initialize()
    .then((response) => {
      activeDatabaseId = response.databaseId;
      if (databaseSelect) databaseSelect.value = activeDatabaseId;
      renderSchema(activeDatabaseId, response.schema);
      setStatus(`${response.databaseName} is ready. Queries run locally in your browser.`);
    })
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
