# SQL Practice

A small SQL learning site built with Astro, TypeScript, Tailwind CSS, CodeMirror 6, and SQLite compiled to WebAssembly. Queries run locally in a dedicated Web Worker; there is no account or SQL backend.

## Run locally

Requires Node.js 22.23.4 or newer and npm.

```sh
npm install
npm run dev
```

This workspace follows `AGENTS.md` and starts Astro in background mode with `astro dev --background`. Manage it with `astro dev status`, `astro dev logs`, and `astro dev stop`.

Useful checks:

```sh
npm run test:sql
npm exec -- astro check
npm run build
npm run preview
```

Set `SITE_URL` at build time to the deployed origin if it differs from the repository’s current default. The static build writes to `dist/`.

## Routes

- `/` — introduction and direct links to the playground, practice, and data.
- `/playground/` — interactive SQL editor with Hospital, Company, and E-commerce databases.
- `/practice/` — 40 questions grouped into 11 SQL topics.
- `/practice/<topic>/` and `/practice/questions/<slug>/` — topic and question pages.
- `/databases/` and `/databases/<id>/` — sample database overview, schemas, and relationships.
- `/sitemap.xml`, `/robots.txt`, and `/404.html` — crawler and not-found routes.

## Data and privacy

The practice exercises use a separate clean database for each answer check. Playground databases live in the worker for the current browser session. Question completion and attempt counts are saved in localStorage on the device; clearing site data removes them. See [DATABASES.md](DATABASES.md), [QUESTIONS.md](QUESTIONS.md), and [ARCHITECTURE.md](ARCHITECTURE.md).

## SQL.js limitations

This is SQLite in WebAssembly, not a full database server. It supports SQLite’s SQL dialect and has no network access, durable server storage, user accounts, or server-side concurrency. Browser memory and CPU limit how much data can be queried. A worker timeout terminates a stuck query and rebuilds the in-memory databases. Practice grading compares output columns and rows; it does not prove that a query is the only or most efficient solution.
