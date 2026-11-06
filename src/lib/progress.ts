import { questions, type Question } from '../data/questions.ts';
const STORAGE_KEY = 'sql-practice-progress-v1';
export interface ProgressRecord { attempted: number; correct: boolean; attempts: number; lastAttempt: string }
export type ProgressState = Record<string, ProgressRecord>;
const empty: ProgressState = {};
export function readProgress(storage: Pick<Storage, 'getItem'> = localStorage): ProgressState {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...empty };
    return parsed as ProgressState;
  } catch { return { ...empty }; }
}
export function writeAttempt(slug: string, correct: boolean, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const state = readProgress(storage);
  const previous = state[slug];
  state[slug] = { attempted: (previous?.attempted ?? 0) + 1, attempts: (previous?.attempts ?? 0) + 1, correct: previous?.correct === true || correct, lastAttempt: new Date().toISOString() };
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}
export function clearProgress(storage: Pick<Storage, 'removeItem'> = localStorage) { storage.removeItem(STORAGE_KEY); }
export function progressSummary(state: ProgressState, items: Question[] = questions) {
  const solved = items.filter((question) => state[question.slug]?.correct).length;
  return { solved, total: items.length, percent: items.length ? Math.round(solved / items.length * 100) : 0 };
}
