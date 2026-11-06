# Architecture

## Pages and content

Astro builds a static site from file-based routes under `src/pages/`. `SiteLayout.astro` owns the shared header, footer, page title, description, canonical URL, and social metadata. Astro components render the database schema and playground controls. Topic, question, and database detail pages use `getStaticPaths()` and the typed content definitions in `src/data/`.

Tailwind CSS styles the UI. CodeMirror 6 is loaded only by the playground or individual practice question page that needs an editor. There is no React, framework hydration runtime, server adapter, authentication, or backend.

## Browser SQL engine

`src/workers/sql.worker.ts` imports the sql.js WebAssembly URL through Vite and initializes the three sample databases from `src/lib/sqlExecution.ts`. Typed requests and responses are defined in `src/lib/sqlProtocol.ts`; `SqlWorkerClient` matches them by request ID, enforces a ten-second timeout, and recreates a failed worker. The client keeps active session snapshots for databases it has visited so recovery can reload them. Resets replace only the active DB from its original snapshot.

Normal playground statements execute on the selected in-memory database. The visible result is capped at 200 rows per result set while total returned row count is retained. Practice checking instead clones the original database twice and executes the user query and reference solution in isolation. The worker caps answer checking at 10,000 rows before returning results for comparison. User SQL never reaches a server and is executed without `eval()`.

## Answer comparison and progress

`src/lib/answerValidation.ts` compares result sets with ordering rules from the question record. Column names are case-insensitive, NULL values must match, numeric values have a small tolerance, and row matching preserves duplicates. `src/lib/progress.ts` stores versioned question attempts and completion flags in localStorage. The application handles missing, invalid, or cleared storage without requiring an account.

## Search and accessibility

Static page metadata is rendered in HTML. Routes include canonical links, Open Graph and Twitter title/description tags, WebSite and breadcrumb JSON-LD, a static XML sitemap, robots policy, and a custom 404. No unverified reviews or aggregate rating markup is emitted. Native links, headings, labels, table semantics, button controls, visible focus styles, responsive layouts, and live status regions are used for accessibility.

## Limitations

sql.js implements SQLite in WebAssembly, so behavior follows SQLite rather than MySQL, PostgreSQL, or SQL Server. The sample datasets are educational and small. Browser resources constrain query size and execution. A synchronous SQLite statement cannot be cooperatively interrupted, so the client enforces a timeout by terminating and recreating the worker; active database states that were already returned to the main thread are restored, while changes made after the most recent response can be lost if the worker crashes. Answer checking confirms output equivalence for the supplied seed data, not query quality or correctness for every possible database state. The solution text is shipped to the browser for local grading and can be inspected by a determined learner.
