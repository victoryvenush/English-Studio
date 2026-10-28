import { allAwards, awardProgress } from '../data/awards';
import { difficultySettings, isNearDuplicate, scoreQuiz, type ActiveAttempt, type Attempt, type CancelledAttempt, type CompletedAttempt, type Profile, type Snapshot } from './model';

const DATABASE = 'english-studio-local';
const PROFILE_KEY = 'english-studio-profile-v1';
const stores = ['attempts', 'history', 'cards', 'lessons', 'awards', 'xp', 'activity'] as const;
type Store = typeof stores[number];
let databasePromise: Promise<IDBDatabase> | null = null;

export const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function database(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        for (const store of stores) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' });
      };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => { databasePromise = null; reject(request.error ?? new Error('Could not open local storage.')); };
      request.onblocked = () => reject(new Error('Local storage is blocked by another open tab.'));
    });
  }
  return databasePromise;
}

function finished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Local storage transaction was cancelled.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local data.'));
  });
}

export function loadProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const profile = value as Partial<Profile>;
    if (typeof profile.name !== 'string' || !profile.name.trim()) return null;
    return { name: profile.name.slice(0, 40), theme: profile.theme === 'dark' ? 'dark' : 'light', animations: profile.animations !== false, lastBackupAt: typeof profile.lastBackupAt === 'string' ? profile.lastBackupAt : null };
  } catch { return null; }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getSnapshot(): Promise<Snapshot> {
  const db = await database();
  const tx = db.transaction(stores, 'readonly');
  const done = finished(tx);
  const results = await Promise.all(stores.map((store) => new Promise<unknown[]>((resolve, reject) => {
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
  })));
  await done;
  return Object.fromEntries(stores.map((store, index) => [store, results[index]])) as unknown as Snapshot;
}

export async function startAttempt(attempt: ActiveAttempt): Promise<'started' | 'active' | 'duplicate'> {
  const db = await database();
  const tx = db.transaction(['attempts', 'history'], 'readwrite');
  const done = finished(tx);
  let result: 'started' | 'active' | 'duplicate' = 'active';
  let attempts: Attempt[] | null = null;
  let history: string[] | null = null;
  const commit = () => {
    if (!attempts || !history) return;
    if (attempts.some((item) => item.status === 'in_progress')) return;
    if (attempt.questions.some((question) => history!.some((fingerprint) => isNearDuplicate(fingerprint, question.fingerprint)))) { result = 'duplicate'; return; }
    tx.objectStore('attempts').add(attempt);
    for (const question of attempt.questions) tx.objectStore('history').put({ id: question.fingerprint, topicId: attempt.topicId, createdAt: attempt.startedAt });
    result = 'started';
  };
  const attemptsRequest = tx.objectStore('attempts').getAll();
  const historyRequest = tx.objectStore('history').getAllKeys();
  attemptsRequest.onsuccess = () => { attempts = attemptsRequest.result as Attempt[]; commit(); };
  historyRequest.onsuccess = () => { history = historyRequest.result as string[]; commit(); };
  await done;
  return result;
}

function cancelledFrom(attempt: ActiveAttempt, reason: string): CancelledAttempt {
  return { id: attempt.id, topicId: attempt.topicId, difficulty: attempt.difficulty, startedAt: attempt.startedAt, status: 'cancelled', endedAt: new Date().toISOString(), reason, score: 0, acknowledged: false };
}

export async function cancelAttempt(id: string, reason: string): Promise<CancelledAttempt | null> {
  const db = await database();
  const tx = db.transaction('attempts', 'readwrite');
  const done = finished(tx);
  let result: CancelledAttempt | null = null;
  const request = tx.objectStore('attempts').get(id);
  request.onsuccess = () => {
    const attempt = request.result as Attempt | undefined;
    if (attempt?.status === 'in_progress') { result = cancelledFrom(attempt, reason); tx.objectStore('attempts').put(result); }
    else if (attempt?.status === 'cancelled') result = attempt;
  };
  await done;
  return result;
}

export async function reconcileInterrupted(): Promise<CancelledAttempt | null> {
  const db = await database();
  const tx = db.transaction('attempts', 'readwrite');
  const done = finished(tx);
  let latest: CancelledAttempt | null = null;
  const request = tx.objectStore('attempts').getAll();
  request.onsuccess = () => {
    for (const attempt of request.result as Attempt[]) {
      if (attempt.status === 'in_progress') {
        const cancelled = cancelledFrom(attempt, 'interrupted');
        tx.objectStore('attempts').put(cancelled);
        if (!latest || cancelled.startedAt > latest.startedAt) latest = cancelled;
      } else if (attempt.status === 'cancelled' && !attempt.acknowledged && (!latest || attempt.startedAt > latest.startedAt)) latest = attempt;
    }
  };
  await done;
  return latest;
}

export async function acknowledgeCancellation(id: string): Promise<void> {
  const db = await database();
  const tx = db.transaction('attempts', 'readwrite');
  const done = finished(tx);
  const request = tx.objectStore('attempts').get(id);
  request.onsuccess = () => {
    const attempt = request.result as Attempt | undefined;
    if (attempt?.status === 'cancelled' && !attempt.acknowledged) tx.objectStore('attempts').put({ ...attempt, acknowledged: true });
  };
  await done;
}

export async function completeAttempt(id: string, inputAnswers: Record<string, string>, signal?: AbortSignal): Promise<CompletedAttempt | null> {
  const db = await database();
  if (signal?.aborted) return null;
  const tx = db.transaction(['attempts', 'xp', 'activity'], 'readwrite');
  const done = finished(tx);
  const abort = () => { try { tx.abort(); } catch { /* The transaction has already finished. */ } };
  signal?.addEventListener('abort', abort, { once: true });
  let result: CompletedAttempt | null = null;
  const request = tx.objectStore('attempts').get(id);
  request.onsuccess = () => {
    const attempt = request.result as Attempt | undefined;
    if (!attempt || attempt.status !== 'in_progress' || attempt.questions.length !== 15) return;
    const answers: Record<string, string> = {};
    for (const question of attempt.questions) if (question.options.includes(inputAnswers[question.id])) answers[question.id] = inputAnswers[question.id];
    const endedAt = new Date().toISOString();
    const timeTaken = Math.min(difficultySettings[attempt.difficulty].minutes * 60, Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(attempt.startedAt)) / 1000)));
    result = { id: attempt.id, topicId: attempt.topicId, difficulty: attempt.difficulty, startedAt: attempt.startedAt, status: 'completed', endedAt, questions: attempt.questions, answers, timeTaken, ...scoreQuiz(attempt.questions, answers, attempt.difficulty) };
    tx.objectStore('attempts').put(result);
    tx.objectStore('xp').put({ id: `quiz-${id}`, attemptId: id, amount: result.score, createdAt: endedAt });
    tx.objectStore('activity').put({ id: `quiz-${id}`, type: 'quiz', sourceId: id, at: endedAt, duration: timeTaken });
  };
  try { await done; }
  catch (error) { if (signal?.aborted) return null; throw error; }
  finally { signal?.removeEventListener('abort', abort); }
  return result;
}

export async function completeLesson(topicId: string, duration: number): Promise<void> {
  const db = await database();
  const tx = db.transaction(['lessons', 'activity'], 'readwrite');
  const done = finished(tx);
  const request = tx.objectStore('lessons').get(topicId);
  request.onsuccess = () => {
    if (request.result) return;
    const at = new Date().toISOString();
    tx.objectStore('lessons').add({ id: topicId, completedAt: at });
    tx.objectStore('activity').add({ id: `lesson-${topicId}`, type: 'lesson', sourceId: topicId, at, duration: Math.min(10800, Math.max(0, Math.round(duration))) });
  };
  await done;
}

export async function reviewCard(id: string, status: 'known' | 'review', duration: number): Promise<void> {
  const db = await database();
  const tx = db.transaction(['cards', 'activity'], 'readwrite');
  const done = finished(tx);
  const request = tx.objectStore('cards').get(id);
  request.onsuccess = () => {
    const at = new Date().toISOString();
    const sequence = (request.result?.reviews ?? 0) + 1;
    tx.objectStore('cards').put({ id, status, reviews: sequence, updatedAt: at });
    tx.objectStore('activity').add({ id: `card-${makeId()}`, type: 'flashcard', sourceId: id, at, duration: Math.min(10800, Math.max(0, Math.round(duration))), rating: status, sequence });
  };
  await done;
}

export async function unlockEligibleAwards(): Promise<string[]> {
  const snapshot = await getSnapshot();
  const eligible = allAwards.filter((award) => awardProgress(award, snapshot).unlocked);
  const db = await database();
  const tx = db.transaction('awards', 'readwrite');
  const done = finished(tx);
  const unlocked: string[] = [];
  const request = tx.objectStore('awards').getAllKeys();
  request.onsuccess = () => {
    const existing = new Set(request.result as string[]);
    for (const award of eligible) if (!existing.has(award.id)) {
      tx.objectStore('awards').put({ id: award.id, unlockedAt: new Date().toISOString() });
      unlocked.push(award.id);
    }
  };
  await done;
  return unlocked;
}

export async function clearStore(store: Store): Promise<void> {
  const db = await database();
  const tx = db.transaction(store, 'readwrite');
  const done = finished(tx);
  tx.objectStore(store).clear();
  await done;
}

export async function resetProgress(): Promise<void> {
  const db = await database();
  const tx = db.transaction(stores, 'readwrite');
  const done = finished(tx);
  for (const store of stores) tx.objectStore(store).clear();
  await done;
}

export async function restoreSnapshot(snapshot: Snapshot, profile: Profile): Promise<void> {
  const oldProfile = localStorage.getItem(PROFILE_KEY);
  saveProfile(profile);
  try {
    const db = await database();
    const tx = db.transaction(stores, 'readwrite');
    const done = finished(tx);
    for (const store of stores) {
      const objectStore = tx.objectStore(store);
      objectStore.clear();
      for (const record of snapshot[store]) objectStore.put(record);
    }
    await done;
  } catch (error) {
    if (oldProfile === null) localStorage.removeItem(PROFILE_KEY); else localStorage.setItem(PROFILE_KEY, oldProfile);
    throw error;
  }
}