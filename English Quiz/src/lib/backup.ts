import { z } from 'zod';
import { allAwards, awardProgress } from '../data/awards';
import { allFlashcards, topics } from '../data/topics';
import { difficultySettings, isNearDuplicate, normalizeQuestion, scoreQuiz, type CompletedAttempt, type Profile, type Snapshot } from './model';

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).refine((value) => !['__proto__', 'prototype', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'].includes(value), 'Reserved ID');
const timestamp = z.string().max(30).refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'Invalid timestamp');
const topicId = z.string().refine((value) => topics.some((topic) => topic.id === value), 'Unknown topic');
const difficulty = z.enum(['easy', 'medium', 'hard']);
const shortText = z.string().trim().min(1).max(1200);
const questionSchema = z.object({
  id, topicId, difficulty, type: z.enum(['multiple_choice', 'fill_blank', 'transformation', 'error_identification', 'word_form']),
  question: shortText, options: z.array(z.string().trim().min(1).max(300)).length(4), correctAnswer: z.string().trim().min(1).max(300),
  explanation: shortText, takeaway: shortText, fingerprint: z.string().min(1).max(1200),
}).strict().superRefine((question, context) => {
  if (new Set(question.options.map((option) => option.toLowerCase())).size !== 4 || question.options.filter((option) => option === question.correctAnswer).length !== 1) context.addIssue({ code: 'custom', message: 'A question must have four distinct options and one matching answer.' });
  if (question.options.some((option) => /^(all|none|both) of the above[.!]?$/i.test(option))) context.addIssue({ code: 'custom', message: 'Ambiguous compound options are not supported.' });
  if (question.fingerprint !== normalizeQuestion(question.question)) context.addIssue({ code: 'custom', message: 'Question fingerprint does not match.' });
});
export { questionSchema };

const baseAttempt = { id, topicId, difficulty, startedAt: timestamp };
const cancelledSchema = z.object({ ...baseAttempt, status: z.literal('cancelled'), endedAt: timestamp, reason: z.string().min(1).max(100), score: z.literal(0), acknowledged: z.boolean() }).strict();
const completedSchema = z.object({
  ...baseAttempt, status: z.literal('completed'), endedAt: timestamp, questions: z.array(questionSchema).length(15),
  answers: z.record(id, z.string().min(1).max(300)), timeTaken: z.number().int().min(0).max(900), correct: z.number().int().min(0).max(15),
  incorrect: z.number().int().min(0).max(15), unanswered: z.number().int().min(0).max(15), score: z.number().int().min(0).max(205), accuracy: z.number().int().min(0).max(100),
}).strict();
const profileSchema = z.object({ name: z.string().trim().min(1).max(40), theme: z.enum(['light', 'dark']), animations: z.boolean(), lastBackupAt: timestamp.nullable() }).strict();
const dataSchema = z.object({
  attempts: z.array(z.discriminatedUnion('status', [cancelledSchema, completedSchema])).max(500),
  history: z.array(z.object({ id: z.string().min(1).max(1200), topicId, createdAt: timestamp }).strict()).max(20000),
  cards: z.array(z.object({ id, status: z.enum(['known', 'review']), reviews: z.number().int().min(1).max(20000), updatedAt: timestamp }).strict()).max(allFlashcards.length),
  lessons: z.array(z.object({ id: topicId, completedAt: timestamp }).strict()).max(topics.length),
  awards: z.array(z.object({ id, unlockedAt: timestamp }).strict()).max(allAwards.length),
  xp: z.array(z.object({ id, attemptId: id, amount: z.number().int().min(0).max(205), createdAt: timestamp }).strict()).max(500),
  activity: z.array(z.object({ id, type: z.enum(['quiz', 'lesson', 'flashcard']), sourceId: id, at: timestamp, duration: z.number().int().min(0).max(10800), rating: z.enum(['known', 'review']).optional(), sequence: z.number().int().min(1).max(20000).optional() }).strict().superRefine((event, context) => {
    if (event.type === 'flashcard' ? !event.rating || !event.sequence : event.rating !== undefined || event.sequence !== undefined) context.addIssue({ code: 'custom', message: 'Invalid activity details.' });
  })).max(20000),
}).strict();
const backupSchema = z.object({ format: z.literal('english-studio-backup'), version: z.literal(1), exportedAt: timestamp, profile: profileSchema, data: dataSchema }).strict();
export type Backup = z.infer<typeof backupSchema>;

export function makeBackup(profile: Profile, snapshot: Snapshot): Backup {
  const exportedAt = new Date().toISOString();
  return {
    format: 'english-studio-backup', version: 1, exportedAt, profile,
    data: { ...snapshot, attempts: snapshot.attempts.map((attempt) => attempt.status === 'in_progress'
      ? { id: attempt.id, topicId: attempt.topicId, difficulty: attempt.difficulty, startedAt: attempt.startedAt, status: 'cancelled' as const, endedAt: exportedAt, reason: 'interrupted', score: 0 as const, acknowledged: false }
      : attempt) },
  };
}

export function downloadBackup(profile: Profile, snapshot: Snapshot): string {
  const backup = makeBackup(profile, snapshot);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `english-studio-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup.exportedAt;
}

function unique(values: string[]): boolean { return new Set(values).size === values.length; }

export function validateBackup(raw: unknown): { backup: Backup; droppedAwards: number } {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new Error('This file is not a supported English Studio backup, or its data is invalid.');
  const backup = parsed.data;
  const data = backup.data;
  for (const records of Object.values(data)) if (!unique(records.map((record) => record.id))) throw new Error('The backup contains duplicate record IDs.');
  const exportTime = Date.parse(backup.exportedAt);
  const dates = [backup.profile.lastBackupAt, ...data.attempts.flatMap((attempt) => [attempt.startedAt, attempt.endedAt]), ...data.history.map((item) => item.createdAt), ...data.cards.map((item) => item.updatedAt), ...data.lessons.map((item) => item.completedAt), ...data.awards.map((item) => item.unlockedAt), ...data.xp.map((item) => item.createdAt), ...data.activity.map((item) => item.at)];
  if (dates.some((date) => date !== null && Date.parse(date) > exportTime)) throw new Error('The backup contains records dated after its export.');
  const validCards = new Set(allFlashcards.map((card) => card.id));
  const validAwards = new Set(allAwards.map((award) => award.id));
  if (data.cards.some((card) => !validCards.has(card.id)) || data.awards.some((award) => !validAwards.has(award.id))) throw new Error('The backup contains unknown cards or awards.');
  if (data.history.some((record) => record.id !== normalizeQuestion(record.id))) throw new Error('The backup contains an invalid question fingerprint.');
  const completed = data.attempts.filter((attempt): attempt is CompletedAttempt => attempt.status === 'completed');
  for (const attempt of data.attempts) {
    if (Date.parse(attempt.endedAt) < Date.parse(attempt.startedAt)) throw new Error('An attempt has inconsistent timestamps.');
    if (attempt.status !== 'completed') continue;
    if (!unique(attempt.questions.map((question) => question.id)) || !unique(attempt.questions.map((question) => question.fingerprint))) throw new Error('A quiz contains duplicate questions.');
    if (attempt.questions.some((question, index) => attempt.questions.slice(0, index).some((previous) => isNearDuplicate(previous.fingerprint, question.fingerprint)))) throw new Error('A quiz contains near-duplicate questions.');
    if (attempt.questions.some((question) => question.topicId !== attempt.topicId || question.difficulty !== attempt.difficulty)) throw new Error('A quiz contains inconsistent question details.');
    const questionsById = new Map(attempt.questions.map((question) => [question.id, question]));
    if (Object.entries(attempt.answers).some(([key, answer]) => !questionsById.get(key)?.options.includes(answer))) throw new Error('A quiz contains an invalid answer.');
    const expected = scoreQuiz(attempt.questions, attempt.answers, attempt.difficulty);
    if (attempt.score !== expected.score || attempt.correct !== expected.correct || attempt.incorrect !== expected.incorrect || attempt.unanswered !== expected.unanswered || attempt.accuracy !== expected.accuracy || attempt.timeTaken > difficultySettings[attempt.difficulty].minutes * 60) throw new Error('A quiz score is inconsistent with its answers.');
  }
  if (data.xp.length !== completed.length || data.xp.some((record) => {
    const attempt = completed.find((item) => item.id === record.attemptId);
    return !attempt || record.id !== `quiz-${attempt.id}` || record.amount !== attempt.score || record.createdAt !== attempt.endedAt;
  })) throw new Error('XP records are inconsistent with completed quizzes.');
  const quizEvents = data.activity.filter((event) => event.type === 'quiz');
  const lessonEvents = data.activity.filter((event) => event.type === 'lesson');
  const cardEvents = data.activity.filter((event) => event.type === 'flashcard');
  if (quizEvents.length !== completed.length || quizEvents.some((event) => !completed.some((attempt) => event.id === `quiz-${attempt.id}` && event.sourceId === attempt.id && event.at === attempt.endedAt && event.duration === attempt.timeTaken))) throw new Error('Quiz activity is inconsistent with completed attempts.');
  if (lessonEvents.length !== data.lessons.length || lessonEvents.some((event) => !data.lessons.some((lesson) => event.id === `lesson-${lesson.id}` && event.sourceId === lesson.id && event.at === lesson.completedAt))) throw new Error('Lesson activity is inconsistent.');
  if (cardEvents.some((event) => !data.cards.some((card) => card.id === event.sourceId)) || data.cards.some((card) => {
    const reviews = cardEvents.filter((event) => event.sourceId === card.id).sort((a, b) => a.sequence! - b.sequence!);
    const last = reviews[reviews.length - 1];
    return reviews.length !== card.reviews || reviews.some((event, index) => event.sequence !== index + 1) || last?.at !== card.updatedAt || last?.rating !== card.status;
  })) throw new Error('Flashcard activity is inconsistent.');
  // Check each unlock against the history available at that time, not only today's accuracy or card ratings.
  const keptAwards = data.awards.filter((record) => {
    const definition = allAwards.find((award) => award.id === record.id)!;
    const activity = data.activity.filter((event) => event.at <= record.unlockedAt);
    const cards = data.cards.flatMap((card) => {
      const reviews = activity.filter((event) => event.type === 'flashcard' && event.sourceId === card.id).sort((a, b) => a.sequence! - b.sequence!);
      const last = reviews[reviews.length - 1];
      return last ? [{ id: card.id, status: last.rating!, reviews: reviews.length, updatedAt: last.at }] : [];
    });
    const historical: Snapshot = { ...data, attempts: data.attempts.filter((attempt) => attempt.endedAt <= record.unlockedAt), lessons: data.lessons.filter((lesson) => lesson.completedAt <= record.unlockedAt), activity, cards, awards: [], xp: data.xp.filter((item) => item.createdAt <= record.unlockedAt) };
    return awardProgress(definition, historical).unlocked;
  });
  const droppedAwards = data.awards.length - keptAwards.length;
  backup.data.awards = keptAwards;
  return { backup, droppedAwards };
}