import { basicSetup, EditorView } from 'codemirror';
import { sql, SQLite } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';
import { questions } from '../data/questions';
import { SqlWorkerClient } from '../lib/sqlWorkerClient';
import { readProgress, writeAttempt } from '../lib/progress';
import type { QueryResultSet, SqlValue } from '../lib/sqlProtocol';

const slug = document.querySelector<HTMLElement>('[data-question-slug]')?.dataset.questionSlug;
const question = questions.find((entry) => entry.slug === slug);
const host = document.querySelector<HTMLDivElement>('#sql-editor');
const checkButton = document.querySelector<HTMLButtonElement>('#run-query');
const output = document.querySelector<HTMLElement>('#question-output');
const message = document.querySelector<HTMLElement>('#question-message');
const hintButton = document.querySelector<HTMLButtonElement>('#show-hint');
const hint = document.querySelector<HTMLElement>('#question-hint');
const revealButton = document.querySelector<HTMLButtonElement>('#reveal-solution');
const solution = document.querySelector<HTMLElement>('#question-solution');
const expectedButton = document.querySelector<HTMLButtonElement>('#show-expected-result');
const expectedOutput = document.querySelector<HTMLElement>('#expected-result-output');
if (question && host && checkButton) {
  const activeQuestion = question;
  const button = checkButton;
  const editor = new EditorView({ doc:'SELECT * FROM patients LIMIT 10;', parent:host, extensions:[basicSetup, sql({dialect:SQLite}), EditorView.lineWrapping, keymap.of([{ key:'Mod-Enter', run: () => { void check(); return true; } }])] });
  const engine = new SqlWorkerClient((status) => { if (message) message.textContent = status; });
  const progressStatus = document.querySelector<HTMLElement>('#question-status');
  const updateProgress = () => {
    const record = readProgress()[activeQuestion.slug];
    if (progressStatus) progressStatus.textContent = record?.correct ? `Completed · ${record.attempts} ${record.attempts === 1 ? 'attempt' : 'attempts'} saved on this device.` : `${record?.attempts ?? 0} attempts saved on this device.`;
  };
  updateProgress();
  const render = (sets: QueryResultSet[], target: HTMLElement | null = output) => {
    if (!target) return;
    target.replaceChildren();
    if (sets.length === 0 || sets.every((set) => set.columns.length === 0)) { target.textContent = 'Query ran successfully and returned no rows.'; return; }
    sets.forEach((set) => {
      const wrap = document.createElement('div'); wrap.className = 'max-w-full overflow-x-auto';
      const table = document.createElement('table'); table.className = 'min-w-max border-collapse text-left text-sm';
      const head = document.createElement('tr'); set.columns.forEach((name) => { const th = document.createElement('th'); th.className='border-b px-3 py-2 font-medium text-slate-600'; th.textContent=name; head.append(th); });
      const thead=document.createElement('thead'); thead.append(head); table.append(thead);
      const tbody=document.createElement('tbody'); set.rows.forEach((row:SqlValue[]) => { const tr=document.createElement('tr'); row.forEach((value) => { const td=document.createElement('td'); td.className='border-b border-slate-100 px-3 py-2'; td.textContent=value===null?'NULL':String(value); if (value===null) td.classList.add('italic','text-slate-400'); tr.append(td); }); tbody.append(tr); }); table.append(tbody); wrap.append(table); target.append(wrap);
    });
  };
  async function check() {
    if (button.disabled) return;
    button.disabled=true; button.textContent='Checking…';
    try {
      const response=await engine.validate(editor.state.doc.toString(),activeQuestion.solution,activeQuestion.ordered ?? false);
      render(response.resultSets);
      if (message) { message.textContent=response.message; message.className=`text-sm font-medium ${response.correct?'text-emerald-700':'text-amber-700'}`; }
      writeAttempt(activeQuestion.slug,response.correct);
      progressStatus?.setAttribute('data-completed',String(response.correct));
      updateProgress();
    } catch (error) { if(message) { message.textContent=error instanceof Error?error.message:'Could not check this query.'; message.className='text-sm text-rose-700'; } }
    finally { button.disabled=false; button.textContent='Check answer'; }
  }
  checkButton.addEventListener('click',()=>void check());
  document.querySelector('#reset-query')?.addEventListener('click',()=>editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:'SELECT * FROM patients LIMIT 10;'}}));
  hintButton?.addEventListener('click',()=>{ if(hint) hint.hidden=!hint.hidden; });
  revealButton?.addEventListener('click',()=>{ if(solution) solution.hidden=!solution.hidden; });
  expectedButton?.addEventListener('click',async()=>{
    if (!expectedOutput || expectedButton.disabled) return;
    if (!expectedOutput.hidden) { expectedOutput.hidden=true; expectedButton.textContent='Show expected result'; return; }
    expectedButton.disabled=true; expectedButton.textContent='Loading expected result…';
    try { const expected=await engine.validate(activeQuestion.solution,activeQuestion.solution,activeQuestion.ordered ?? false); render(expected.expectedSets,expectedOutput); expectedOutput.hidden=false; expectedButton.textContent='Hide expected result'; }
    catch(error) { expectedButton.textContent=error instanceof Error?error.message:'Could not load expected result.'; }
    finally { expectedButton.disabled=false; }
  });
  void engine.initialize().catch((error:unknown)=>{if(message)message.textContent=error instanceof Error?error.message:'The SQL engine could not start.';});
  window.addEventListener('pagehide',()=>{editor.destroy();engine.dispose();},{once:true});
}
