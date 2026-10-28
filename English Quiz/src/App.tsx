import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Layout, type Page } from './components/Layout';
import { allAwards } from './data/awards';
import { topicById, topics, type Category } from './data/topics';
import { questionSchema } from './lib/backup';
import { difficultySettings, emptySnapshot, isNearDuplicate, type ActiveAttempt, type CompletedAttempt, type Difficulty, type Profile, type Question, type Snapshot } from './lib/model';
import { acknowledgeCancellation, cancelAttempt, completeAttempt, completeLesson, getSnapshot, loadProfile, makeId, reconcileInterrupted, reviewCard, saveProfile, startAttempt, unlockEligibleAwards } from './lib/storage';
import { AwardsPage } from './pages/Awards';
import { Dashboard } from './pages/Dashboard';
import { FlashcardsPage } from './pages/Flashcards';
import { LearnPage, LessonPage } from './pages/Learn';
import { ProfilePage } from './pages/Profile';
import { CancelledScreen, QuizScreen, QuizSetup, ResultsScreen } from './pages/Quiz';
import { SettingsPage } from './pages/Settings';
import { Welcome } from './pages/Welcome';

async function generateQuestions(topicId: string, difficulty: Difficulty, history: string[], controller: AbortController): Promise<Question[]> {
  const accepted: Question[] = [];
  for (let round = 0; round < 4 && accepted.length < 15; round += 1) {
    const timeout = window.setTimeout(() => controller.abort(), 220000);
    let response: Response;
    try {
      response = await fetch('/api/generate-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicId, difficulty, count: 15 - accepted.length }), signal: controller.signal });
    } finally { window.clearTimeout(timeout); }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) throw new Error('The quiz server is not running. Use the production Node server described in the README.');
    const body: unknown = await response.json();
    if (!response.ok) throw new Error(typeof body === 'object' && body && 'error' in body && typeof body.error === 'string' ? body.error : 'Quiz generation failed. Please try again.');
    if (!body || typeof body !== 'object' || !('questions' in body) || !Array.isArray(body.questions)) throw new Error('The AI returned an invalid quiz. Please retry.');
    for (const item of body.questions) {
      const parsed = questionSchema.safeParse(item);
      if (!parsed.success || parsed.data.topicId !== topicId || parsed.data.difficulty !== difficulty) continue;
      const question = parsed.data;
      if (accepted.some((existing) => existing.id === question.id || isNearDuplicate(existing.fingerprint, question.fingerprint))) continue;
      if (history.some((fingerprint) => isNearDuplicate(fingerprint, question.fingerprint))) continue;
      accepted.push(question);
      if (accepted.length === 15) break;
    }
  }
  if (accepted.length !== 15) throw new Error('Could not find 15 valid, fresh questions this time. Please retry; no quiz has started.');
  return accepted;
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [page, setPage] = useState<Page>('home');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [toast, setToast] = useState('');
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [learnKey, setLearnKey] = useState(0);
  const [topicId, setTopicId] = useState(topics[0].id);
  const [cardTopic, setCardTopic] = useState('all');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttempt | null>(null);
  const [result, setResult] = useState<CompletedAttempt | null>(null);
  const [newAwards, setNewAwards] = useState<string[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const generation = useRef<AbortController | null>(null);
  const submission = useRef<AbortController | null>(null);
  const activeState = useRef<{ id: string; state: 'active' | 'cancelled' | 'completing' | 'completed' } | null>(null);

  const refresh = useCallback(async () => { const data = await getSnapshot(); setSnapshot(data); }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const interrupted = await reconcileInterrupted();
        const data = await getSnapshot();
        if (!mounted) return;
        setSnapshot(data);
        if (interrupted) { activeState.current = { id: interrupted.id, state: 'cancelled' }; setTopicId(interrupted.topicId); setDifficulty(interrupted.difficulty); setPage('cancelled'); }
      } catch { if (mounted) setStorageError('Browser storage is unavailable. Enable local storage and IndexedDB to save your learning progress.'); }
      finally { if (mounted) setReady(true); }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme ?? 'light';
    document.documentElement.dataset.motion = profile?.animations === false ? 'off' : 'on';
  }, [profile]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const cancelActive = useCallback((reason: string) => {
    const current = activeState.current;
    if (!current || (current.state !== 'active' && current.state !== 'completing')) return;
    current.state = 'cancelled';
    submission.current?.abort();
    setActiveAttempt(null);
    setPage('cancelled');
    void cancelAttempt(current.id, reason).then(refresh).catch(() => setStorageError('The cancellation will be reconciled when you reopen the app. No rewards will be granted.'));
  }, [refresh]);
  useEffect(() => {
    const visibility = () => { if (document.visibilityState === 'hidden') cancelActive('hidden'); };
    const blur = () => cancelActive('focus-lost');
    const pagehide = () => cancelActive('page-exit');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', pagehide);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', pagehide); };
  }, [cancelActive]);

  const updateProfile = (next: Profile) => { saveProfile(next); setProfile(next); };
  const welcome = (name: string) => {
    try { updateProfile({ name, theme: 'light', animations: true, lastBackupAt: null }); }
    catch { setStorageError('Your profile could not be saved. Please enable browser storage.'); }
  };
  const navigate = (next: Page) => {
    if (activeState.current?.state === 'active' || activeState.current?.state === 'completing') { cancelActive('navigation'); return; }
    generation.current?.abort(); generation.current = null; setLoadingQuiz(false); setQuizError('');
    if (next === 'learn') { setCategory('All'); setLearnKey((key) => key + 1); }
    if (next === 'flashcards') setCardTopic('all');
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const openCategory = (value: Category) => { setCategory(value); setLearnKey((key) => key + 1); setPage('learn'); window.scrollTo(0, 0); };
  const openLesson = (id: string) => { setTopicId(id); setPage('lesson'); window.scrollTo(0, 0); };
  const openCards = (id: string) => { setCardTopic(id); setPage('flashcards'); window.scrollTo(0, 0); };
  const openQuiz = (id = topics[0].id) => { setTopicId(id); setQuizError(''); setPage('quizSetup'); window.scrollTo(0, 0); };

  const performActivity = async (action: () => Promise<void>) => {
    try {
      await action();
      const unlocked = await unlockEligibleAwards();
      await refresh();
      if (unlocked.length) setToast(unlocked.length === 1 ? `Award unlocked: ${allAwards.find((award) => award.id === unlocked[0])?.name}` : `${unlocked.length} new awards unlocked!`);
    } catch { setStorageError('Could not save your activity. Check that browser storage is available.'); }
  };

  const beginQuiz = async () => {
    if (loadingQuiz || generation.current) return;
    const controller = new AbortController(); generation.current = controller; setLoadingQuiz(true); setQuizError('');
    try {
      let history = snapshot.history.map((record) => record.id);
      let attempt: ActiveAttempt | null = null;
      for (let retry = 0; retry < 2; retry += 1) {
        const questions = await generateQuestions(topicId, difficulty, history, controller);
        if (controller.signal.aborted) return;
        attempt = { id: makeId(), topicId, difficulty, status: 'in_progress', startedAt: new Date().toISOString(), timeLimit: difficultySettings[difficulty].minutes * 60, questions };
        const started = await startAttempt(attempt);
        if (started === 'active') throw new Error('Another quiz is already active in this browser. Close the other tab and try again.');
        if (started === 'started') break;
        attempt = null;
        history = (await getSnapshot()).history.map((record) => record.id);
      }
      if (!attempt) throw new Error('Question history changed while preparing the quiz. Please retry for fresh questions.');
      if (controller.signal.aborted) { await cancelAttempt(attempt.id, 'navigation'); return; }
      activeState.current = { id: attempt.id, state: 'active' };
      setActiveAttempt(attempt);
      setPage('quiz');
      if (document.visibilityState === 'hidden' || !document.hasFocus()) cancelActive('focus-lost');
    } catch (reason) {
      if (!controller.signal.aborted) setQuizError(reason instanceof Error ? reason.message : 'Quiz generation failed. Please try again.');
      else if (generation.current === controller) setQuizError('Quiz generation timed out. Please retry.');
    } finally { if (generation.current === controller) { generation.current = null; setLoadingQuiz(false); } }
  };
  const finishQuiz = useCallback(async (answers: Record<string, string>) => {
    const current = activeState.current;
    if (!current || current.state !== 'active') return;
    if (document.visibilityState === 'hidden' || !document.hasFocus()) { cancelActive('focus-lost'); return; }
    current.state = 'completing';
    const controller = new AbortController();
    submission.current = controller;
    try {
      const completed = await completeAttempt(current.id, answers, controller.signal);
      if (controller.signal.aborted) return;
      if (!completed) { current.state = 'cancelled'; setActiveAttempt(null); setPage('cancelled'); await refresh(); return; }
      current.state = 'completed';
      setActiveAttempt(null); setResult(completed); setPage('result');
      try { const unlocked = await unlockEligibleAwards(); setNewAwards(unlocked); await refresh(); }
      catch { setStorageError('Your result was saved, but progress could not be refreshed. Please reload.'); }
    } catch { if (!controller.signal.aborted) { current.state = 'cancelled'; void cancelAttempt(current.id, 'storage-error'); setActiveAttempt(null); setPage('cancelled'); setStorageError('The attempt could not be saved and was cancelled.'); } }
    finally { if (submission.current === controller) submission.current = null; }
  }, [cancelActive, refresh]);

  if (!ready) return <div className="loading-screen"><span className="spinner" /> Opening your studio...</div>;
  if (!profile) return <><Welcome onStart={welcome} />{storageError && <div className="global-error" role="alert">{storageError}</div>}</>;
  if (page === 'quiz' && activeAttempt) return <QuizScreen attempt={activeAttempt} onCancel={() => cancelActive('exit')} onSubmit={finishQuiz} />;
  if (page === 'cancelled') {
    const leaveCancellation = async (retry: boolean) => {
      try { if (activeState.current) await acknowledgeCancellation(activeState.current.id); await refresh(); }
      catch { setStorageError('Could not update the cancellation record.'); }
      activeState.current = null;
      if (retry) openQuiz(topicId); else navigate('home');
    };
    return <CancelledScreen onRetry={() => void leaveCancellation(true)} onDashboard={() => void leaveCancellation(false)} />;
  }
  if (page === 'result' && result) return <ResultsScreen attempt={result} newAwards={newAwards} onRetry={() => { activeState.current = null; setNewAwards([]); openQuiz(result.topicId); }} onDashboard={() => { activeState.current = null; setNewAwards([]); navigate('home'); }} />;

  let content;
  if (page === 'home') content = <Dashboard profile={profile} snapshot={snapshot} navigate={navigate} openCategory={openCategory} openQuiz={openQuiz} openLesson={openLesson} />;
  else if (page === 'learn') content = <LearnPage key={learnKey} snapshot={snapshot} initialCategory={category} openLesson={openLesson} openQuiz={openQuiz} />;
  else if (page === 'lesson') content = <LessonPage key={topicId} topic={topicById(topicId) ?? topics[0]} snapshot={snapshot} back={() => navigate('learn')} onComplete={(id, seconds) => performActivity(() => completeLesson(id, seconds))} openQuiz={openQuiz} openCards={openCards} />;
  else if (page === 'flashcards') content = <FlashcardsPage key={cardTopic} initialTopic={cardTopic} snapshot={snapshot} onReview={(id, status, seconds) => performActivity(() => reviewCard(id, status, seconds))} />;
  else if (page === 'awards') content = <AwardsPage snapshot={snapshot} />;
  else if (page === 'profile') content = <ProfilePage profile={profile} snapshot={snapshot} openSettings={() => navigate('settings')} openQuiz={openQuiz} openAwards={() => navigate('awards')} />;
  else if (page === 'settings') content = <SettingsPage profile={profile} snapshot={snapshot} updateProfile={updateProfile} refresh={refresh} onRestored={async (next) => { setProfile(next); await refresh(); }} />;
  else content = <QuizSetup topicId={topicId} setTopicId={setTopicId} difficulty={difficulty} setDifficulty={setDifficulty} onStart={() => void beginQuiz()} loading={loadingQuiz} error={quizError} back={() => navigate('learn')} />;
  return <><Layout page={page} profile={profile} snapshot={snapshot} navigate={navigate}>{content}</Layout>{toast && <button className="toast" onClick={() => { setToast(''); navigate('awards'); }}><Sparkles size={18} /> {toast} <span>View awards</span></button>}{storageError && <div className="global-error" role="alert">{storageError}<button onClick={() => setStorageError('')} aria-label="Dismiss"><X size={16} /></button></div>}</>;
}
