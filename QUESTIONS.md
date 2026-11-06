# Practice questions

Question definitions are maintained in `src/data/questions.ts`. The current catalog contains 40 Hospital Database questions: 18 easy, 16 medium, and 6 hard. Each entry includes a prompt, topic, difficulty, hint, reference solution, database ID, and ordering rule. Topic and question pages are generated from this data.

Topics: selecting columns (4), filtering rows (4), distinct values (2), sorting and limits (3), aggregates (4), GROUP BY (5), HAVING (2), joins (7), subqueries (4), CASE (3), and NULL values (2).

## Grading behavior

When a learner checks an answer, the Web Worker constructs two new databases from the selected database’s original seed snapshot. It runs the learner query against one copy and the reference solution against the other, then compares result-set count, column count/names, row count, and values. Rows are order-insensitive unless the prompt explicitly requires order. NULL must match NULL; numeric values use a small relative tolerance; duplicate rows are preserved. Grading does not compare SQL text and cannot alter the playground session.

Answers returning more than 10,000 rows are rejected for grading. The editor shows the learner’s result, gives correctness feedback, and offers a hint or an opt-in reference solution. Progress is stored per question in localStorage.

## Adding questions

Add a unique slug and a clear prompt with a reference solution that runs on a clean copy of the declared database. Mark `ordered` when result ordering is part of the question. Add or adjust tests in `tests/sql-engine.test.mjs`; that suite executes every solution against a fresh snapshot, checks difficulty totals, validates comparison behavior, and verifies the sample databases. Keep difficulty/topic totals and the topic list in this document accurate when changing the catalog.
