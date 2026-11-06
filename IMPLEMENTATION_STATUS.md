# SQL Practice implementation status

## Phases 4–15

- [x] Phase 4: Hospital, Company, and E-commerce schemas/data; switching and separate reset snapshots; schema explorer generated from shared definitions.
- [x] Phase 5: 40 questions, 18 easy / 16 medium / 6 hard, across 11 SQL topics, with tested reference solutions.
- [x] Phase 6: clean-database answer grading, output comparison, hints, opt-in solutions, and feedback.
- [x] Phase 7: practice index, topic pages, and individual question pages.
- [x] Phase 8: local progress for attempts/completions and a clear-progress control.
- [x] Phase 9: database overview and detailed schema/relationship pages.
- [x] Phase 10: homepage database links and consistent main navigation.
- [x] Phase 11: canonical, Open Graph and Twitter metadata, WebSite/breadcrumb JSON-LD, sitemap, robots, and 404 route.
- [x] Phase 12: route-local CodeMirror scripts, semantic/responsive page structure, labels, focus styles, and live status regions.
- [x] Phase 13: automated coverage for all seed schemas, foreign keys, requested SQL behavior, every reference solution, comparison, progress, reset snapshots, initialization failure, and e-commerce totals.
- [x] Phase 14: `astro check`, SQL tests, and static production build pass; static routes and sitemap generated. Reviewed for static hosting/Vercel compatibility; no deployment performed.
- [x] Phase 15: README, `DATABASES.md`, `QUESTIONS.md`, and `ARCHITECTURE.md` document the project.

## Validation

- Astro diagnostics: 0 errors, 0 warnings.
- SQL tests: 11 passing.
- Production build: 59 static routes built.
- Browser rendering, mobile visual layout, and browser console could not be checked: the computer-use host returned a browser access unavailable error and timed out listing apps. The code and static output were checked instead.

## Architecture

- Astro static routes and shared `SiteLayout`; Tailwind and Astro components; vanilla TypeScript for browser behavior.
- CodeMirror 6 for query editing; sql.js runs in a Vite-built Web Worker.
- Three separate in-browser SQLite databases seeded from `src/data/databases.ts`.
- `src/data/questions.ts` provides question metadata and reference SQL; answer checks run on isolated copies.
- Versioned question progress is stored in localStorage.
