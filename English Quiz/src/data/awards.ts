import { topics } from './topics';
import { getStats, type Snapshot } from '../lib/model';

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mystic';
type Metric = 'reviews' | 'quizzes' | 'correct' | 'xp' | 'streak' | 'topics' | 'accuracy' | 'known' | 'perfect' | 'perfectStreak';
type Rule = { type: 'lesson'; topicId: string } | { type: 'topic'; topicId: string; target: number; accuracy?: number; perfect?: boolean } | { type: 'metric'; metric: Metric; target: number; minimumQuestions?: number };
export interface Award { id: string; name: string; rarity: Rarity; icon: string; description: string; rule: Rule }

const awards: Award[] = [];
const add = (award: Award) => awards.push(award);

for (const topic of topics) {
  add({ id: `topic-first-${topic.id}`, name: `${topic.short} First Steps`, rarity: 'Common', icon: 'book', description: `Complete your first ${topic.short} quiz.`, rule: { type: 'topic', topicId: topic.id, target: 1 } });
  add({ id: `topic-explorer-${topic.id}`, name: `${topic.short} Explorer`, rarity: 'Rare', icon: 'compass', description: `Complete 3 ${topic.short} quizzes.`, rule: { type: 'topic', topicId: topic.id, target: 3 } });
  add({ id: `topic-specialist-${topic.id}`, name: `${topic.short} Specialist`, rarity: 'Epic', icon: 'target', description: `Complete 5 ${topic.short} quizzes with at least 75% overall accuracy in the topic.`, rule: { type: 'topic', topicId: topic.id, target: 5, accuracy: 75 } });
  add({ id: `topic-ace-${topic.id}`, name: `${topic.short} Ace`, rarity: 'Legendary', icon: 'star', description: `Get a perfect score in a ${topic.short} quiz.`, rule: { type: 'topic', topicId: topic.id, target: 1, perfect: true } });
  add({ id: `topic-luminary-${topic.id}`, name: `${topic.short} Luminary`, rarity: 'Mystic', icon: 'sparkles', description: `Complete 10 ${topic.short} quizzes with at least 90% overall accuracy in the topic.`, rule: { type: 'topic', topicId: topic.id, target: 10, accuracy: 90 } });
  add({ id: `lesson-${topic.id}`, name: `${topic.short} Discovery`, rarity: 'Common', icon: 'book', description: `Complete the ${topic.short} lesson.`, rule: { type: 'lesson', topicId: topic.id } });
}

function series(rarity: Rarity, metric: Metric, names: string[], targets: number[], description: (target: number) => string, icon: string, minimumQuestions?: number) {
  names.forEach((name, index) => add({ id: `${rarity.toLowerCase()}-${metric}-${targets[index]}`, name, rarity, icon, description: description(targets[index]), rule: { type: 'metric', metric, target: targets[index], minimumQuestions } }));
}

series('Common', 'reviews', ['First Flip', 'Curious Cards', 'Memory Starter', 'Card Collector', 'Steady Recall', 'Study Shuffle', 'Memory Maker', 'Card Companion', 'Recall Rhythm', 'Fifty Flips'], [1, 3, 5, 10, 15, 20, 25, 30, 40, 50], (n) => `Review ${n} flashcard${n === 1 ? '' : 's'}.`, 'layers');
series('Common', 'quizzes', ['First Challenge', 'Back for More', 'Triple Try', 'High Five', 'Lucky Seven', 'Tenacious Ten', 'Practice Makes Progress', 'Twenty Challenges'], [1, 2, 3, 5, 7, 10, 15, 20], (n) => `Complete ${n} quiz${n === 1 ? '' : 'zes'}.`, 'zap');
series('Common', 'correct', ['Right on', 'Five Bright Ideas', 'Ten on Target', 'Quarter Century', 'Fifty Right', 'Seventy-Five Sparks', 'Century of Answers', 'Answer Adventurer'], [1, 5, 10, 25, 50, 75, 100, 150], (n) => `Answer ${n} quiz question${n === 1 ? '' : 's'} correctly.`, 'target');
series('Rare', 'reviews', ['Recall Rover', 'Memory Gardener', 'Hundred Hands', 'Recall Runner', 'Memory Mosaic', 'Study Spark', 'Flip Fantastic', 'Recall Voyager', 'Memory Marathon', 'Card Constellation'], [60, 75, 100, 125, 150, 175, 200, 250, 300, 400], (n) => `Review ${n} flashcards.`, 'layers');
series('Rare', 'quizzes', ['Challenge Chaser', 'Thirty Strong', 'Quiz Pathfinder', 'Forty Forward', 'Half-Century Hero', 'Sixty Studies', 'Quiz Voyager', 'Century Challenger'], [25, 30, 35, 40, 50, 60, 75, 100], (n) => `Complete ${n} quizzes.`, 'zap');
series('Rare', 'xp', ['First Level Up', 'Rising Star', 'Thousand Points', 'Momentum Maker', 'Point Pioneer'], [200, 500, 1000, 2000, 3000], (n) => `Earn ${n} total quiz XP.`, 'star');
series('Rare', 'streak', ['Two-Day Tandem', 'Three-Day Glow', 'Five-Day Focus', 'Week of Wonder', 'Fortnight Focus'], [2, 3, 5, 7, 14], (n) => `Learn on ${n} consecutive days.`, 'flame');
series('Epic', 'topics', ['Curious Explorer', 'Four Corners', 'Seven Subjects', 'Ten Topic Trek', 'Wide World of Words'], [2, 4, 7, 10, 14], (n) => `Complete quizzes in ${n} different topics.`, 'compass');
series('Epic', 'accuracy', ['Finding Your Aim', 'Sharpened Focus', 'Precision Practice', 'Accuracy Artist', 'Brilliant Accuracy'], [50, 60, 70, 80, 90], (n) => `Reach ${n}% overall accuracy across at least 30 quiz questions.`, 'target', 30);
series('Epic', 'quizzes', ['Challenge Champion', 'Quiz Pathfinder Plus', 'Two Hundred Triumphs', 'Quiz Odyssey'], [125, 150, 200, 250], (n) => `Complete ${n} quizzes.`, 'zap');
series('Epic', 'known', ['Ten to Remember', 'Twenty in Mind', 'Memory Maestro', 'Fifty in Focus'], [10, 20, 35, 50], (n) => `Mark ${n} different flashcards as known.`, 'layers');
series('Legendary', 'perfect', ['Flawless Flight', 'Perfect Trio', 'Five Flawless', 'Perfection Pursuit'], [1, 3, 5, 10], (n) => `Complete ${n} perfect quiz${n === 1 ? '' : 'zes'}.`, 'crown');
series('Legendary', 'xp', ['Five Thousand Stars', 'Ten Thousand Lights', 'Fifteen Thousand Horizons', 'Twenty-Five Thousand Skies'], [5000, 10000, 15000, 25000], (n) => `Earn ${n} total quiz XP.`, 'star');
series('Mystic', 'perfect', ['Constellation of Perfection'], [20], (n) => `Complete ${n} perfect quizzes.`, 'sparkles');
series('Mystic', 'topics', ['The Whole Galaxy'], [17], (n) => `Complete a quiz in all ${n} topics.`, 'sparkles');
series('Mystic', 'streak', ['Thirty-Day Orbit'], [30], (n) => `Learn on ${n} consecutive days.`, 'sparkles');

export const allAwards = awards;

export function awardProgress(award: Award, snapshot: Snapshot): { current: number; target: number; unlocked: boolean; note?: string } {
  const stats = getStats(snapshot);
  const rule = award.rule;
  if (rule.type === 'lesson') {
    const current = snapshot.lessons.some((lesson) => lesson.id === rule.topicId) ? 1 : 0;
    return { current, target: 1, unlocked: current === 1 };
  }
  if (rule.type === 'topic') {
    const entry = stats.topicStats.find((item) => item.topic.id === rule.topicId)!;
    const current = rule.perfect ? entry.attempts.filter((attempt) => attempt.correct === 15).length : entry.attempts.length;
    return { current, target: rule.target, unlocked: current >= rule.target && (!rule.accuracy || entry.accuracy >= rule.accuracy), note: rule.accuracy ? `Topic accuracy: ${entry.accuracy}% / ${rule.accuracy}%` : undefined };
  }
  const values: Record<Metric, number> = { reviews: stats.reviews, quizzes: stats.completed.length, correct: stats.correct, xp: stats.totalXP, streak: stats.bestStreak, topics: stats.topicsPractised, accuracy: stats.accuracy, known: stats.known, perfect: stats.perfect, perfectStreak: stats.bestPerfectStreak };
  const current = values[rule.metric];
  const enoughQuestions = !rule.minimumQuestions || stats.completed.length * 15 >= rule.minimumQuestions;
  return { current, target: rule.target, unlocked: current >= rule.target && enoughQuestions, note: rule.minimumQuestions ? `${stats.completed.length * 15} / ${rule.minimumQuestions} quiz questions` : undefined };
}