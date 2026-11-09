import { questions, topics, type Question } from '../data/questions';
import { referenceEntries } from '../data/reference';
import { readProgress } from '../lib/progress';

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

export function mountLearningPanel() {
  const questionTab = get<HTMLButtonElement>('#questions-tab');
  const referenceTab = get<HTMLButtonElement>('#reference-tab');
  const notesTab = get<HTMLButtonElement>('#notes-tab');
  const questionsPanel = get<HTMLElement>('#questions-panel');
  const referencePanel = get<HTMLElement>('#reference-panel');
  const notesPanel = get<HTMLElement>('#notes-panel');
  const questionItems = [...document.querySelectorAll<HTMLButtonElement>('[data-question-item]')];
  const questionSearch = get<HTMLInputElement>('#question-search');
  const topicFilter = get<HTMLSelectElement>('#question-topic-filter');
  const difficultyFilter = get<HTMLSelectElement>('#question-difficulty-filter');
  const databaseFilter = get<HTMLSelectElement>('#question-database-filter');
  const questionCount = get<HTMLElement>('#question-result-count');
  const questionEmpty = get<HTMLElement>('#question-empty');
  const title = get<HTMLElement>('#active-question-title');
  const prompt = get<HTMLElement>('#active-question-prompt');
  const topic = get<HTMLElement>('#active-question-topic');
  const difficulty = get<HTMLElement>('#active-question-difficulty');
  const hintButton = get<HTMLButtonElement>('#question-hint-toggle');
  const solutionButton = get<HTMLButtonElement>('#question-solution-toggle');
  const hint = get<HTMLElement>('#active-question-hint');
  const solution = get<HTMLElement>('#active-question-solution');
  const solutionCode = solution?.querySelector('code');
  const fullQuestion = get<HTMLAnchorElement>('#open-full-question');
  const grade = get<HTMLElement>('#question-grade');
  const startButton = get<HTMLButtonElement>('#start-practice');
  const previousButton = get<HTMLButtonElement>('#question-previous');
  const nextButton = get<HTMLButtonElement>('#question-next');
  const expectedButton = get<HTMLButtonElement>('#question-expected-toggle');
  const expectedOutput = get<HTMLElement>('#question-expected-output');
  let saved = readProgress();
  questionItems.forEach((item) => {
    const slug = item.dataset.questionItem;
    if (slug && saved[slug]?.correct) item.classList.add('is-solved');
  });
  let activeQuestion: Question | null = null;
  let expectedReady = false;
  if (hintButton) hintButton.disabled = true;
  if (solutionButton) solutionButton.disabled = true;

  const selectQuestion = (question: Question) => {
    activeQuestion = question;
    const topicTitle = topics.find((entry) => entry.slug === question.topic)?.title ?? question.topic;
    if (title) title.textContent = question.title;
    if (prompt) prompt.textContent = question.prompt;
    if (topic) topic.textContent = topicTitle;
    if (difficulty) {
      difficulty.textContent = question.difficulty;
      difficulty.className = `difficulty-chip level-${question.difficulty}`;
    }
    if (hint) { hint.textContent = question.hint; hint.hidden = true; }
    if (solutionCode) solutionCode.textContent = question.solution;
    if (solution) solution.hidden = true;
    if (expectedOutput) { expectedOutput.replaceChildren(); expectedOutput.hidden = true; }
    expectedReady = false;
    if (expectedButton) { expectedButton.disabled = true; expectedButton.textContent = 'Show expected output'; }
    if (hintButton) { hintButton.disabled = false; hintButton.textContent = 'Show hint'; }
    if (solutionButton) { solutionButton.disabled = false; solutionButton.textContent = 'Show solution'; }
    if (fullQuestion) { fullQuestion.href = `/practice/questions/${question.slug}/`; fullQuestion.hidden = false; }
    if (grade) {
      const record = readProgress()[question.slug];
      grade.className = 'question-grade';
      grade.textContent = record?.correct ? `Solved before · ${record.attempts} ${record.attempts === 1 ? 'attempt' : 'attempts'} saved` : 'Run your query to check your answer.';
    }
    questionItems.forEach((item) => item.classList.toggle('is-active', item.dataset.questionItem === question.slug));
    window.dispatchEvent(new CustomEvent('sql-question-selected', { detail: { slug: question.slug } }));
    updateNavigation();
  };

  const visibleQuestions = () => questionItems.filter((item) => !item.hidden)
    .map((item) => questions.find((entry) => entry.slug === item.dataset.questionItem))
    .filter((item): item is Question => Boolean(item));
  const updateNavigation = () => {
    const visible = visibleQuestions();
    const index = activeQuestion ? visible.findIndex((question) => question.slug === activeQuestion?.slug) : -1;
    if (previousButton) previousButton.disabled = visible.length < 2;
    if (nextButton) nextButton.disabled = visible.length < 2;
    if (previousButton) previousButton.setAttribute('aria-label', index < 0 ? 'Go to previous filtered question' : `Previous question, ${index} of ${visible.length}`);
    if (nextButton) nextButton.setAttribute('aria-label', index < 0 ? 'Go to next filtered question' : `Next question, ${index + 2} of ${visible.length}`);
  };

  const filterQuestions = () => {
    const needle = questionSearch?.value.trim().toLocaleLowerCase() ?? '';
    const selectedTopic = topicFilter?.value ?? 'all';
    const selectedDifficulty = difficultyFilter?.value ?? 'all';
    const selectedDatabase = databaseFilter?.value ?? 'all';
    let visible = 0;
    questionItems.forEach((item) => {
      const question = questions.find((entry) => entry.slug === item.dataset.questionItem);
      if (!question) return;
      const matches = (selectedTopic === 'all' || question.topic === selectedTopic)
        && (selectedDifficulty === 'all' || question.difficulty === selectedDifficulty)
        && (selectedDatabase === 'all' || question.databaseId === selectedDatabase)
        && (!needle || `${question.title} ${question.prompt} ${question.topic}`.toLocaleLowerCase().includes(needle));
      item.hidden = !matches;
      if (matches) visible += 1;
    });
    if (questionCount) questionCount.textContent = `${visible} ${visible === 1 ? 'question' : 'available'}`;
    if (questionEmpty) questionEmpty.hidden = visible !== 0;
    if (startButton) startButton.disabled = visible === 0;
    updateNavigation();
  };

  const showTab = (name: 'questions' | 'reference' | 'notes') => {
    for (const [tab, panel, tabName] of [
      [questionTab, questionsPanel, 'questions'], [referenceTab, referencePanel, 'reference'], [notesTab, notesPanel, 'notes'],
    ] as const) {
      const active = name === tabName;
      tab?.setAttribute('aria-selected', String(active));
      tab?.classList.toggle('is-active', active);
      if (panel) panel.hidden = !active;
    }
  };

  const referenceSearch = get<HTMLInputElement>('#reference-search');
  const referenceCategory = get<HTMLSelectElement>('#reference-category-filter');
  const referenceItems = [...document.querySelectorAll<HTMLButtonElement>('[data-reference-item]')];
  const referenceTitle = get<HTMLElement>('#reference-detail-title');
  const referenceSummary = get<HTMLElement>('#reference-detail-summary');
  const referenceExample = get<HTMLElement>('#reference-detail-example');
  const referenceDetailCategory = get<HTMLElement>('#reference-detail-category');
  let activeExample = 'SELECT * FROM patients LIMIT 10;';

  const filterReference = () => {
    const needle = referenceSearch?.value.trim().toLocaleLowerCase() ?? '';
    const category = referenceCategory?.value ?? 'all';
    referenceItems.forEach((item) => {
      const entry = referenceEntries.find((candidate) => candidate.slug === item.dataset.referenceItem);
      if (!entry) return;
      item.hidden = (category !== 'all' && entry.category !== category)
        || !`${entry.title} ${entry.summary} ${entry.category}`.toLocaleLowerCase().includes(needle);
    });
  };

  questionTab?.addEventListener('click', () => showTab('questions'));
  referenceTab?.addEventListener('click', () => showTab('reference'));
  notesTab?.addEventListener('click', () => showTab('notes'));

  const notesForm = get<HTMLFormElement>('#personal-note-form');
  const notesList = get<HTMLDivElement>('#personal-notes');
  const notesKey = 'sql-practice-learning-notes-v1';
  type PersonalNote = { id: string; title: string; body: string };
  const readNotes = (): PersonalNote[] => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(notesKey) ?? '[]');
      return Array.isArray(value) ? value.filter((note): note is PersonalNote => Boolean(note && typeof note.id === 'string' && typeof note.title === 'string' && typeof note.body === 'string')) : [];
    } catch { return []; }
  };
  const renderNotes = () => {
    if (!notesList) return;
    notesList.replaceChildren();
    for (const note of readNotes()) {
      const card = document.createElement('article');
      card.className = 'personal-note';
      const header = document.createElement('header');
      const heading = document.createElement('h4');
      heading.textContent = note.title;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete note: ${note.title}`);
      remove.addEventListener('click', () => {
        try { localStorage.setItem(notesKey, JSON.stringify(readNotes().filter((item) => item.id !== note.id))); } catch { /* Notes stay on the page until refresh if storage is full. */ }
        renderNotes();
      });
      header.append(heading, remove);
      const body = document.createElement('p');
      body.textContent = note.body;
      card.append(header, body);
      notesList.append(card);
    }
  };
  renderNotes();
  notesForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const titleInput = get<HTMLInputElement>('#personal-note-title');
    const bodyInput = get<HTMLTextAreaElement>('#personal-note-body');
    const titleText = titleInput?.value.trim();
    const bodyText = bodyInput?.value.trim();
    if (!titleText || !bodyText) return;
    try {
      localStorage.setItem(notesKey, JSON.stringify([{ id: crypto.randomUUID(), title: titleText, body: bodyText }, ...readNotes()]));
      notesForm.reset();
      renderNotes();
    } catch {
      if (notesList) notesList.textContent = 'Notes could not be saved in this browser.';
    }
  });
  [questionSearch, topicFilter, difficultyFilter, databaseFilter].forEach((control) => control?.addEventListener('input', filterQuestions));
  questionItems.forEach((item) => item.addEventListener('click', () => {
    const question = questions.find((entry) => entry.slug === item.dataset.questionItem);
    if (question) selectQuestion(question);
  }));
  startButton?.addEventListener('click', () => {
    const candidates = questionItems.filter((item) => !item.hidden).map((item) => questions.find((entry) => entry.slug === item.dataset.questionItem)).filter((item): item is Question => Boolean(item));
    if (!candidates.length) return;
    const solved = candidates.filter((item) => saved[item.slug]?.correct);
    const pool = solved.length < candidates.length ? candidates.filter((item) => !saved[item.slug]?.correct) : candidates;
    selectQuestion(pool[Math.floor(Math.random() * pool.length)]!);
  });
  const navigate = (step: -1 | 1) => {
    const visible = visibleQuestions();
    if (!visible.length) return;
    const current = activeQuestion ? visible.findIndex((question) => question.slug === activeQuestion?.slug) : -1;
    const nextIndex = current < 0 ? (step > 0 ? 0 : visible.length - 1) : (current + step + visible.length) % visible.length;
    selectQuestion(visible[nextIndex]!);
  };
  previousButton?.addEventListener('click', () => navigate(-1));
  nextButton?.addEventListener('click', () => navigate(1));
  hintButton?.addEventListener('click', () => {
    if (!hint) return;
    hint.hidden = !hint.hidden;
    if (hintButton) hintButton.textContent = hint.hidden ? 'Show hint' : 'Hide hint';
  });
  solutionButton?.addEventListener('click', () => {
    if (!solution) return;
    solution.hidden = !solution.hidden;
    if (solutionButton) solutionButton.textContent = solution.hidden ? 'Show solution' : 'Hide solution';
  });
  window.addEventListener('sql-question-graded', (event) => {
    const detail = (event as CustomEvent<{ slug: string; correct: boolean; attempts: number; progressSaved?: boolean; expectedSets?: { columns: string[]; rows: (string | number | Uint8Array | null)[][] }[] }>).detail;
    saved = readProgress();
    if (!activeQuestion || detail?.slug !== activeQuestion.slug || !grade) return;
    grade.className = `question-grade ${detail.correct ? 'is-correct' : 'is-incorrect'}`;
    grade.textContent = detail.correct ? 'Correct — nice work!' : 'Not quite yet. Adjust your query and run it again.';
    if (!detail.progressSaved) grade.textContent += ' Progress could not be saved on this device.';
    if (expectedOutput && expectedButton && detail.expectedSets) {
      expectedReady = true;
      expectedOutput.replaceChildren();
      detail.expectedSets.forEach((set, index) => {
        if (detail.expectedSets!.length > 1) {
          const heading = document.createElement('p'); heading.className = 'px-2 py-1 text-xs font-semibold text-slate-500'; heading.textContent = `Result set ${index + 1}`; expectedOutput.append(heading);
        }
        const table = document.createElement('table');
        const head = document.createElement('thead'); const headRow = document.createElement('tr');
        set.columns.forEach((name) => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; headRow.append(th); });
        head.append(headRow); table.append(head);
        const body = document.createElement('tbody');
        set.rows.forEach((row) => { const tr = document.createElement('tr'); row.forEach((value) => { const td = document.createElement('td'); td.textContent = value === null ? 'NULL' : value instanceof Uint8Array ? `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}` : String(value); if (value === null) td.className = 'is-null'; tr.append(td); }); body.append(tr); });
        table.append(body); expectedOutput.append(table);
        if (set.rows.length === 0) { const empty = document.createElement('p'); empty.className = 'px-2 py-2 text-xs text-slate-500'; empty.textContent = 'No rows returned.'; expectedOutput.append(empty); }
      });
      expectedButton.disabled = false;
      expectedButton.textContent = 'Show expected output';
    }
    if (detail.correct) {
      const item = questionItems.find((candidate) => candidate.dataset.questionItem === detail.slug);
      item?.classList.add('is-solved');
    }
  });
  window.addEventListener('sql-practice-cleared', () => {
    expectedReady = false;
    if (expectedOutput) { expectedOutput.replaceChildren(); expectedOutput.hidden = true; }
    if (expectedButton) { expectedButton.disabled = true; expectedButton.textContent = 'Show expected output'; }
    if (hint) hint.hidden = true;
    if (solution) solution.hidden = true;
    if (hintButton) { hintButton.disabled = true; hintButton.textContent = 'Show hint'; }
    if (solutionButton) { solutionButton.disabled = true; solutionButton.textContent = 'Show solution'; }
    if (grade) {
      grade.className = 'question-grade';
      grade.textContent = 'Practice check paused. Select a question again to continue.';
    }
  });

  expectedButton?.addEventListener('click', () => {
    if (!expectedOutput) return;
    expectedOutput.hidden = !expectedOutput.hidden;
    expectedButton.textContent = expectedOutput.hidden ? 'Show expected output' : 'Hide expected output';
  });
  window.addEventListener('sql-workspace-busy', (event) => {
    const busy = Boolean((event as CustomEvent<{ busy: boolean }>).detail?.busy);
    const controls: HTMLButtonElement[] = [startButton, previousButton, nextButton, expectedButton, hintButton, solutionButton, ...questionItems].filter((element): element is HTMLButtonElement => Boolean(element));
    controls.forEach((control) => {
      const questionAction = control === hintButton || control === solutionButton;
      control.disabled = busy || (control === expectedButton && !expectedReady) || (questionAction && !activeQuestion);
    });
    [questionSearch, topicFilter, difficultyFilter, databaseFilter].forEach((control) => { if (control) control.disabled = busy; });
    if (!busy) updateNavigation();
  });

  [questionSearch, topicFilter, difficultyFilter, databaseFilter].forEach((control) => control?.addEventListener('change', filterQuestions));
  [referenceSearch, referenceCategory].forEach((control) => control?.addEventListener('input', filterReference));
  referenceCategory?.addEventListener('change', filterReference);
  referenceItems.forEach((item) => item.addEventListener('click', () => {
    const entry = referenceEntries.find((candidate) => candidate.slug === item.dataset.referenceItem);
    if (!entry) return;
    if (referenceTitle) referenceTitle.textContent = entry.title;
    if (referenceSummary) referenceSummary.textContent = entry.summary;
    if (referenceExample) referenceExample.textContent = entry.example;
    if (referenceDetailCategory) referenceDetailCategory.textContent = entry.category;
    activeExample = entry.example;
    referenceItems.forEach((button) => button.classList.toggle('is-active', button === item));
  }));
  get<HTMLButtonElement>('#insert-reference-example')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('sql-insert-query', { detail: { query: activeExample, clearPractice: true } }));
  });

  filterQuestions();
  filterReference();
}
