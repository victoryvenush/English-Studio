import { topics } from '../data/topics';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const difficultySettings: Record<Difficulty, { minutes: number; bonus: number }> = {
  easy: { minutes: 8, bonus: 10 }, medium: { minutes: 12, bonus: 20 }, hard: { minutes: 15, bonus: 30 },
};

export interface Question {
  id: string;
  topicId: string;
  difficulty: Difficulty;
  type: 'multiple_choice' | 'fill_blank' | 'transformation' | 'error_identification' | 'word_form';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  takeaway: string;
  fingerprint: string;
}

interface AttemptBase { id: string; topicId: string; difficulty: Difficulty; startedAt: string }
export interface ActiveAttempt extends AttemptBase {
  status: 'in_progress';
  questions: Question[];
  timeLimit: number;
}
export interface CancelledAttempt extends AttemptBase {
  status: 'cancelled';
  endedAt: string;
  reason: string;
  score: 0;
  acknowledged: boolean;
}
export interface CompletedAttempt extends AttemptBase {
  status: 'completed';
  endedAt: string;
  questions: Question[];
  answers: Record<string, string>;
  timeTaken: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
  accuracy: number;
}
export type Attempt = ActiveAttempt | CancelledAttempt | CompletedAttempt;
export interface HistoryRecord { id: string; topicId: string; createdAt: string }
export interface CardRecord { id: string; status: 'known' | 'review'; reviews: number; updatedAt: string }
export interface LessonRecord { id: string; completedAt: string }
export interface AwardRecord { id: string; unlockedAt: string }
export interface XPRecord { id: string; attemptId: string; amount: number; createdAt: string }
export interface ActivityRecord { id: string; type: 'quiz' | 'lesson' | 'flashcard'; sourceId: string; at: string; duration: number; rating?: 'known' | 'review'; sequence?: number }
export interface Snapshot {
  attempts: Attempt[];
  history: HistoryRecord[];
  cards: CardRecord[];
  lessons: LessonRecord[];
  awards: AwardRecord[];
  xp: XPRecord[];
  activity: ActivityRecord[];
}
export interface Profile {
  name: string;
  theme: 'light' | 'dark';
  animations: boolean;
  lastBackupAt: string | null;
}
export const emptySnapshot = (): Snapshot => ({ attempts: [], history: [], cards: [], lessons: [], awards: [], xp: [], activity: [] });

export function normalizeQuestion(text: string): string {
  return text.toLowerCase().normalize('NFKC').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isNearDuplicate(a: string, b: string): boolean {
  const left = normalizeQuestion(a);
  const right = normalizeQuestion(b);
  if (left === right) return true;
  const aWords = new Set(left.split(' ').filter((word) => word.length > 2));
  const bWords = new Set(right.split(' ').filter((word) => word.length > 2));
  if (aWords.size < 5 || bWords.size < 5) return false;
  let shared = 0;
  aWords.forEach((word) => { if (bWords.has(word)) shared += 1; });
  return shared / (aWords.size + bWords.size - shared) >= 0.88;
}

export function scoreQuiz(questions: Question[], answers: Record<string, string>, difficulty: Difficulty) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  for (const question of questions) {
    const answer = answers[question.id];
    if (!answer) unanswered += 1;
    else if (answer === question.correctAnswer) correct += 1;
    else incorrect += 1;
  }
  const score = correct * 10 + difficultySettings[difficulty].bonus + (correct === 15 ? 25 : 0);
  return { correct, incorrect, unanswered, score, accuracy: Math.round((correct / 15) * 100) };
}

function dayNumber(value: string | Date): number {
  const date = new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function getStats(snapshot: Snapshot) {
  const completed = snapshot.attempts.filter((attempt): attempt is CompletedAttempt => attempt.status === 'completed').sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  const totalXP = completed.reduce((sum, attempt) => sum + attempt.score, 0);
  const correct = completed.reduce((sum, attempt) => sum + attempt.correct, 0);
  const answeredQuestions = completed.length * 15;
  const days = [...new Set(snapshot.activity.map((event) => dayNumber(event.at)))].sort((a, b) => b - a);
  const today = dayNumber(new Date());
  let streak = 0;
  if (days.length && days[0] >= today - 1 && days[0] <= today) {
    let day = days[0];
    for (const item of days) { if (item !== day) break; streak += 1; day -= 1; }
  }
  let bestStreak = 0;
  let run = 0;
  let previous = Infinity;
  for (const day of days) { run = previous - day === 1 ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); previous = day; }
  let perfectStreak = 0;
  let bestPerfectStreak = 0;
  for (const attempt of [...completed].reverse()) {
    perfectStreak = attempt.correct === 15 ? perfectStreak + 1 : 0;
    bestPerfectStreak = Math.max(bestPerfectStreak, perfectStreak);
  }
  const topicStats = topics.map((topic) => {
    const attempts = completed.filter((attempt) => attempt.topicId === topic.id);
    const topicCorrect = attempts.reduce((sum, attempt) => sum + attempt.correct, 0);
    return { topic, attempts, correct: topicCorrect, accuracy: attempts.length ? Math.round(topicCorrect / (attempts.length * 15) * 100) : 0 };
  });
  return {
    completed, totalXP, correct, accuracy: answeredQuestions ? Math.round(correct / answeredQuestions * 100) : 0,
    level: Math.floor(totalXP / 200) + 1, levelXP: totalXP % 200, streak, bestStreak, bestPerfectStreak, topicStats,
    timeSpent: snapshot.activity.reduce((sum, event) => sum + event.duration, 0),
    perfect: completed.filter((attempt) => attempt.correct === 15).length,
    reviews: snapshot.cards.reduce((sum, card) => sum + card.reviews, 0),
    known: snapshot.cards.filter((card) => card.status === 'known').length,
    topicsPractised: topicStats.filter((entry) => entry.attempts.length > 0).length,
  };
}