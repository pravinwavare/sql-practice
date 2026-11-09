import { questions, type Question } from '../data/questions.ts';
const STORAGE_KEY = 'sql-practice-progress-v1';
export interface ProgressRecord { attempted: number; correct: boolean; attempts: number; lastAttempt: string }
export type ProgressState = Record<string, ProgressRecord>;
export interface ProgressWriteResult { state: ProgressState; saved: boolean }
const empty: ProgressState = {};
type ProgressStorage = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem' | 'removeItem'>>;
const browserStorage = (): ProgressStorage | undefined => {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; }
  catch { return undefined; }
};

export function readProgress(storage: ProgressStorage | undefined = browserStorage()): ProgressState {
  try {
    if (!storage) return { ...empty };
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...empty };
    return parsed as ProgressState;
  } catch { return { ...empty }; }
}
export function recordAttempt(slug: string, correct: boolean, storage: ProgressStorage | undefined = browserStorage()): ProgressWriteResult {
  const state = readProgress(storage);
  const previous = state[slug];
  state[slug] = { attempted: (previous?.attempted ?? 0) + 1, attempts: (previous?.attempts ?? 0) + 1, correct: previous?.correct === true || correct, lastAttempt: new Date().toISOString() };
  try {
    if (!storage?.setItem) return { state, saved: false };
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { state, saved: true };
  } catch { return { state, saved: false }; }
}
/** Backwards-compatible non-throwing write helper. */
export function writeAttempt(slug: string, correct: boolean, storage?: ProgressStorage): ProgressState {
  return recordAttempt(slug, correct, storage).state;
}
export function clearProgress(storage: ProgressStorage | undefined = browserStorage()) {
  try { storage?.removeItem?.(STORAGE_KEY); return true; }
  catch { return false; }
}
export function progressSummary(state: ProgressState, items: Question[] = questions) {
  const solved = items.filter((question) => state[question.slug]?.correct).length;
  return { solved, total: items.length, percent: items.length ? Math.round(solved / items.length * 100) : 0 };
}
