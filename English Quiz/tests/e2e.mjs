import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
await mkdir('.screenshots', { recursive: true });
const names = ['quiet river path', 'brave mountain climber', 'tiny garden flower', 'silver evening cloud', 'curious library visitor', 'friendly village baker', 'ancient ocean vessel', 'colourful autumn forest', 'gentle classroom teacher', 'bright morning sunrise', 'hidden desert treasure', 'playful meadow rabbit', 'distant island lighthouse', 'careful science student', 'golden winter lantern'];
let batch = 0;
const normalize = (text) => text.toLowerCase().normalize('NFKC').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

async function mockAI(page) {
  await page.route('**/api/generate-quiz', async (route) => {
    const request = route.request().postDataJSON();
    const currentBatch = ++batch;
    const questions = Array.from({ length: request.count }, (_, index) => {
      const question = `Select the best answer for ${names[index]} during scenario batch${currentBatch}.`;
      const options = [`Correct option ${index} batch${currentBatch}`, `Wrong option ${index} batch${currentBatch}`, `Another option ${index} batch${currentBatch}`, `Final option ${index} batch${currentBatch}`];
      return { id: `question-${currentBatch}-${index}`, topicId: request.topicId, difficulty: request.difficulty, type: ['multiple_choice', 'fill_blank', 'transformation', 'error_identification', 'word_form'][index % 5], question, options, correctAnswer: options[0], explanation: 'The first option correctly answers this practice question.', takeaway: 'Read each question carefully before choosing your answer.', fingerprint: normalize(question) };
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions }) });
  });
}

async function snapshot(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('english-studio-local'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const names = ['attempts', 'history', 'cards', 'lessons', 'awards', 'xp', 'activity'];
    const tx = db.transaction(names, 'readonly');
    const entries = await Promise.all(names.map((name) => new Promise((resolve, reject) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve([name, request.result]); request.onerror = () => reject(request.error); })));
    return Object.fromEntries(entries);
  });
}

async function start(page, difficulty = 'easy') {
  await page.locator('.difficulty-option').filter({ hasText: new RegExp(difficulty, 'i') }).click();
  await page.getByLabel('I understand and agree to stay on the quiz page.').check();
  await page.getByRole('button', { name: 'Start my quiz' }).click();
  await page.getByRole('heading', { name: 'Your challenge' }).waitFor();
}

async function answerQuiz(page, correctCount) {
  for (let index = 0; index < 15; index += 1) {
    await page.locator('.answer-options button').nth(index < correctCount ? 0 : 1).click();
    if (index < 14) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Finish quiz', exact: true }).click();
  await page.getByRole('button', { name: 'Submit quiz' }).click();
  await page.getByRole('heading', { name: 'Look what you did.' }).waitFor();
}

async function assertTimerTick(page) {
  const seconds = (value) => { const [minutes, remainder] = value.split(':').map(Number); return minutes * 60 + remainder; };
  const before = seconds(await page.locator('.timer strong').textContent());
  await page.waitForTimeout(1300);
  const after = seconds(await page.locator('.timer strong').textContent());
  assert.ok(after < before, 'Quiz timer should count down');
}

async function overflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, bad: [...document.querySelectorAll('button,input,select')].filter((element) => { const r = element.getBoundingClientRect(); const style = getComputedStyle(element); return r.width > 0 && style.visibility !== 'hidden' && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 5).map((element) => element.textContent?.trim() || element.getAttribute('aria-label')) }));
  assert.ok(dimensions.document <= dimensions.width && dimensions.body <= dimensions.width && dimensions.bad.length === 0, `${label} overflow: ${JSON.stringify(dimensions)}`);
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await mockAI(page);
await page.goto(base);
await page.locator('#welcome-name').fill('Alex');
await page.getByRole('button', { name: 'Start Learning' }).click();
await page.getByRole('heading', { name: /Alex/ }).waitFor();
await page.reload();
await page.getByRole('heading', { name: /Alex/ }).waitFor();

await page.getByRole('button', { name: 'Continue learning' }).click();
await page.getByRole('button', { name: 'Mark lesson complete' }).click();
await page.getByRole('button', { name: 'Lesson complete' }).waitFor();
await page.locator('.side-nav button').nth(2).click();
await page.locator('.flash-card').click();
await page.getByRole('button', { name: 'Know it' }).click();
await page.waitForTimeout(300);
await page.locator('.side-nav button').nth(3).click();
assert.equal(await page.locator('.award-card').count(), 185);
const rarityCounts = await page.locator('.award-card .rarity-label').allTextContents();
for (const [rarity, count] of Object.entries({ Common: 60, Rare: 45, Epic: 35, Legendary: 25, Mystic: 20 })) assert.equal(rarityCounts.filter((item) => item === rarity).length, count, rarity);
const awardNames = await page.locator('.award-card > strong').allTextContents();
assert.equal(new Set(awardNames).size, 185);
const awardIds = await page.locator('.award-card').evaluateAll((elements) => elements.map((element) => element.dataset.awardId));
assert.equal(new Set(awardIds).size, 185);
await page.locator('.award-card').first().click();
await page.getByRole('dialog').waitFor();
await page.getByRole('button', { name: 'Close award details' }).click();

await page.locator('.side-nav button').first().click();
await page.getByRole('button', { name: 'Quick challenge', exact: true }).click();
await start(page, 'hard');
assert.match(await page.locator('.timer strong').textContent(), /^14:|^15:/);
await assertTimerTick(page);
await answerQuiz(page, 12);
assert.match(await page.locator('.result-score').textContent(), /\+150/);
assert.deepEqual((await page.locator('.result-metrics strong').allTextContents()).slice(0, 4), ['12', '3', '0', '80%']);
await page.getByRole('button', { name: 'Retry quiz' }).click();
await start(page, 'hard');
await answerQuiz(page, 15);
assert.match(await page.locator('.result-score').textContent(), /\+205/);

await page.getByRole('button', { name: 'Retry quiz' }).click();
await start(page, 'easy');
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
const other = await context.newPage();
await other.goto('about:blank');
await other.bringToFront();
await page.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor({ timeout: 5000 });
await other.close(); await page.bringToFront();
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('pagehide')); });
await page.waitForTimeout(250);
let data = await snapshot(page);
assert.equal(data.attempts.filter((item) => item.status === 'cancelled').length, 1);
assert.equal(data.attempts.filter((item) => item.status === 'completed').reduce((sum, item) => sum + item.score, 0), 355);
await page.reload();
await page.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor();
await page.getByRole('button', { name: 'Return to Dashboard' }).click();
await page.getByRole('heading', { name: /Alex/ }).waitFor();
await page.reload();
await page.getByRole('heading', { name: /Alex/ }).waitFor();

await page.getByRole('button', { name: 'Quick challenge', exact: true }).click();
await start(page, 'medium');
assert.match(await page.locator('.timer strong').textContent(), /^11:|^12:/);
await assertTimerTick(page);
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); delete document.visibilityState; });
await page.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor();
await page.getByRole('button', { name: 'Start a New Quiz' }).click();
await start(page, 'easy');
assert.match(await page.locator('.timer strong').textContent(), /^07:|^08:/);
await assertTimerTick(page);
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor();
await page.getByRole('button', { name: 'Start a New Quiz' }).click();
await start(page, 'easy');
await page.reload();
await page.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor();
await page.getByRole('button', { name: 'Return to Dashboard' }).click();
await page.getByRole('heading', { name: /Alex/ }).waitFor();
await page.getByRole('button', { name: 'Quick challenge', exact: true }).click();
await start(page, 'easy');
await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const request = indexedDB.open('english-studio-local'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  window.holdQuizTransaction = true;
  const transaction = db.transaction('attempts', 'readwrite');
  const keepAlive = () => { if (window.holdQuizTransaction) { const request = transaction.objectStore('attempts').get('test-lock'); request.onsuccess = keepAlive; } };
  keepAlive();
});
await page.getByRole('button', { name: 'Finish quiz now' }).click();
await page.getByRole('button', { name: 'Submit quiz' }).click();
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor();
await page.evaluate(() => { window.holdQuizTransaction = false; });
await page.getByRole('button', { name: 'Return to Dashboard' }).click();
await page.getByRole('heading', { name: /Alex/ }).waitFor();
data = await snapshot(page);
assert.equal(data.attempts.filter((item) => item.status === 'cancelled').length, 5);
assert.ok(data.attempts.filter((item) => item.status === 'cancelled').every((item) => item.score === 0 && !('questions' in item)));
assert.equal(data.xp.reduce((sum, item) => sum + item.amount, 0), 355);
assert.equal(data.attempts.filter((item) => item.status === 'completed').length, 2);

await page.locator('.settings-link').click();
await page.getByLabel('Appearance').selectOption('dark');
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
assert.equal(await page.evaluate(() => getComputedStyle(document.body).color), 'rgb(237, 240, 255)');
await page.getByRole('switch', { name: 'Animations' }).click();
assert.equal(await page.getByRole('switch', { name: 'Animations' }).getAttribute('aria-checked'), 'false');
await page.reload();
await page.getByRole('heading', { name: /Alex/ }).waitFor();
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
await page.locator('.settings-link').click();
await page.getByLabel('Appearance').selectOption('light');
await page.getByRole('switch', { name: 'Animations' }).click();
await page.locator('#settings-name').fill('Alex Reader');
await page.getByRole('button', { name: 'Save name' }).click();
await page.getByText('Your display name was updated.').waitFor();
await page.locator('#settings-name').fill('Alex');
await page.getByRole('button', { name: 'Save name' }).click();
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Download My Data (.json)' }).click();
const download = await downloadPromise;
const backupBuffer = await readFile(await download.path());
const backup = JSON.parse(backupBuffer.toString());
assert.equal(backup.format, 'english-studio-backup');
assert.equal(backup.data.attempts.filter((item) => item.status === 'completed').length, 2);
assert.equal(backup.data.lessons.length, 1);
assert.equal(backup.data.cards.length, 1);
assert.ok(backup.data.awards.length > 0 && backup.data.history.length >= 30);
assert.ok(!backupBuffer.toString().includes('GROQ_API_KEY'));
const input = page.locator('input[type=file]');
await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
await page.locator('.settings-message.error').waitFor();
const tampered = structuredClone(backup); tampered.data.attempts.find((item) => item.status === 'completed').score = 151;
await input.setInputFiles({ name: 'tampered.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tampered)) });
await page.locator('.settings-message.error').waitFor();
assert.equal((await snapshot(page)).xp.reduce((sum, item) => sum + item.amount, 0), 355);
await page.getByRole('button', { name: 'Reset progress', exact: true }).click();
await page.getByRole('button', { name: 'Yes, reset progress' }).click();
await page.getByText('Learning progress was reset on this browser.').waitFor();
assert.equal((await snapshot(page)).attempts.length, 0);
await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backupBuffer });
await page.getByText('Backup ready to review').waitFor();
await page.getByRole('button', { name: 'Restore Backup', exact: true }).click();
assert.equal((await snapshot(page)).attempts.length, 0);
await page.getByRole('button', { name: 'Yes, replace my data' }).click();
await page.getByText(/Backup restored successfully/).waitFor();
data = await snapshot(page);
assert.equal(data.xp.reduce((sum, item) => sum + item.amount, 0), 355);
assert.equal(data.attempts.filter((item) => item.status === 'completed').length, 2);
assert.equal(data.cards.length, 1);
assert.equal(data.awards.length, backup.data.awards.length);
assert.equal(data.history.length, backup.data.history.length);
await page.getByRole('button', { name: 'Clear history', exact: true }).click();
await page.getByRole('button', { name: 'Yes, clear history' }).click();
await page.getByText('Question history cleared. Your other progress is still here.').waitFor();
assert.equal((await snapshot(page)).history.length, 0);
assert.equal((await snapshot(page)).xp.reduce((sum, item) => sum + item.amount, 0), 355);
assert.deepEqual(errors, []);
console.log('PASS: login, local persistence, 17-topic learning, flashcards, 185 unique awards and exact rarity counts');
console.log('PASS: 15-question quizzes, all timers, 150/205 scoring, actual tab switch, visibility, blur, refresh and idempotent cancellation');
console.log('PASS: JSON download, corruption and tampering rejection, confirmation, atomic restore and separate history clearing');
await context.close();

const failureContext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const failurePage = await failureContext.newPage();
await failurePage.goto(base); await failurePage.locator('#welcome-name').fill('Retry'); await failurePage.getByRole('button', { name: 'Start Learning' }).click();
await failurePage.getByRole('button', { name: 'Quick challenge', exact: true }).click();
await failurePage.getByLabel('I understand and agree to stay on the quiz page.').check();
await failurePage.getByRole('button', { name: 'Start my quiz' }).click();
await failurePage.getByText(/Quiz generation is not configured/).waitFor();
assert.equal((await snapshot(failurePage)).attempts.length, 0);
await failurePage.route('**/api/generate-quiz', async (route) => {
  const request = route.request().postDataJSON();
  const question = 'Choose the correct answer for this single repeated prompt.';
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ questions: [{ id: 'same-id', topicId: request.topicId, difficulty: request.difficulty, type: 'multiple_choice', question, options: ['One', 'Two', 'Three', 'Four'], correctAnswer: 'One', explanation: 'The first answer is correct for this example.', takeaway: 'Review the rule before choosing.', fingerprint: normalize(question) }] }) });
});
await failurePage.getByRole('button', { name: 'Retry generation' }).click();
await failurePage.getByText(/Could not find 15 valid, fresh questions/).waitFor();
assert.equal((await snapshot(failurePage)).attempts.length, 0);
await failurePage.unroute('**/api/generate-quiz');
await failurePage.route('**/api/generate-quiz', async (route) => {
  const request = route.request().postDataJSON();
  await new Promise((resolve) => setTimeout(resolve, 900));
  const questions = names.map((name, index) => {
    const question = `Choose the best answer for ${name} during delayed response.`;
    return { id: `delayed-${index}`, topicId: request.topicId, difficulty: request.difficulty, type: 'multiple_choice', question, options: ['One', 'Two', 'Three', 'Four'], correctAnswer: 'One', explanation: 'The first answer is correct for this example.', takeaway: 'Review the rule before choosing.', fingerprint: normalize(question) };
  });
  try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ questions }) }); } catch { /* The navigation intentionally aborts this request. */ }
});
await failurePage.getByRole('button', { name: 'Retry generation' }).click();
await failurePage.locator('.side-nav button').first().click();
await failurePage.getByRole('heading', { name: /Retry/ }).waitFor();
await failurePage.waitForTimeout(1100);
assert.equal((await snapshot(failurePage)).attempts.length, 0);
await failureContext.close();
console.log('PASS: missing Groq configuration, incomplete AI output and responses delayed past navigation never start a quiz');

const timerContext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const timerPage = await timerContext.newPage();
await timerPage.clock.install({ time: new Date() });
await mockAI(timerPage);
await timerPage.goto(base); await timerPage.locator('#welcome-name').fill('Timer'); await timerPage.getByRole('button', { name: 'Start Learning' }).click();
await timerPage.getByRole('button', { name: 'Quick challenge', exact: true }).click(); await start(timerPage, 'easy');
await timerPage.clock.fastForward(481000);
await timerPage.getByRole('heading', { name: 'Look what you did.' }).waitFor();
assert.match(await timerPage.locator('.result-score').textContent(), /\+10/);
assert.equal(await timerPage.locator('.result-metrics strong').nth(2).textContent(), '15');
await timerContext.close();
console.log('PASS: timer expiry completes with unanswered questions and the correct completion bonus');

const topicsContext = await browser.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });
const topicPage = await topicsContext.newPage();
await mockAI(topicPage);
await topicPage.goto(base); await topicPage.locator('#welcome-name').fill('Topics'); await topicPage.getByRole('button', { name: 'Start Learning' }).click();
for (let index = 0; index < 17; index += 1) {
  await topicPage.locator('.side-nav button').nth(1).click();
  assert.equal(await topicPage.locator('.topic-card').count(), 17);
  await topicPage.locator('.topic-card').nth(index).click();
  assert.equal(await topicPage.locator('.lesson-block').count(), 3);
  await topicPage.getByRole('button', { name: 'Review flashcards' }).click();
  assert.match(await topicPage.locator('.flash-counter').textContent(), /CARD 1 OF 3/);
  const front = await topicPage.locator('.flash-card-body strong').textContent();
  await topicPage.locator('.flash-card').click();
  assert.notEqual(await topicPage.locator('.flash-card-body strong').textContent(), front);
  await topicPage.locator('.side-nav button').nth(1).click();
  await topicPage.locator('.topic-card').nth(index).click();
  await topicPage.getByRole('button', { name: 'Take topic quiz' }).click();
  await start(topicPage, 'easy');
  assert.equal(await topicPage.locator('.quiz-dots button').count(), 15);
  await topicPage.getByRole('button', { name: 'Exit quiz' }).click();
  await topicPage.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor();
  await topicPage.getByRole('button', { name: 'Return to Dashboard' }).click();
  await topicPage.getByRole('heading', { name: /Topics/ }).waitFor();
}
let topicData = await snapshot(topicPage);
assert.equal(topicData.attempts.filter((attempt) => attempt.status === 'cancelled').length, 17);
assert.equal(topicData.xp.length, 0);
assert.equal(topicData.awards.length, 0);
await topicPage.locator('.side-nav button').nth(2).click();
for (let index = 0; index < 10; index += 1) await topicPage.getByRole('button', { name: 'Know it' }).click();
await topicPage.getByRole('button', { name: 'Restart session' }).click();
await topicPage.getByRole('button', { name: 'Review again', exact: true }).click();
topicData = await snapshot(topicPage);
assert.equal(topicData.cards.filter((card) => card.status === 'known').length, 9);
assert.ok(topicData.awards.some((award) => award.id === 'epic-known-10'));
await topicPage.locator('.settings-link').click();
const historicalDownload = topicPage.waitForEvent('download');
await topicPage.getByRole('button', { name: 'Download My Data (.json)' }).click();
const historicalBuffer = await readFile(await (await historicalDownload).path());
await topicPage.getByRole('button', { name: 'Reset progress', exact: true }).click();
await topicPage.getByRole('button', { name: 'Yes, reset progress' }).click();
await topicPage.getByText('Learning progress was reset on this browser.').waitFor();
await topicPage.locator('input[type=file]').setInputFiles({ name: 'history.json', mimeType: 'application/json', buffer: historicalBuffer });
await topicPage.getByText('Backup ready to review').waitFor();
await topicPage.getByRole('button', { name: 'Restore Backup', exact: true }).click();
await topicPage.getByRole('button', { name: 'Yes, replace my data' }).click();
await topicPage.getByText(/Backup restored successfully/).waitFor();
assert.ok((await snapshot(topicPage)).awards.some((award) => award.id === 'epic-known-10'));
await topicsContext.close();
console.log('PASS: every topic has a lesson, three working flashcards and a 15-question quiz; historical awards survive a validated restore');

for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
  const mobile = await browser.newContext({ viewport: { width, height: 800 }, acceptDownloads: true });
  const screen = await mobile.newPage();
  const mobileErrors = [];
  screen.on('pageerror', (error) => mobileErrors.push(error.message));
  await mockAI(screen);
  await screen.goto(base); await screen.bringToFront();
  await overflow(screen, `${width} welcome`);
  if (width === 320 || width === 390) await screen.screenshot({ path: `.screenshots/welcome-${width}.png`, fullPage: true });
  await screen.locator('#welcome-name').fill('Sam'); await screen.getByRole('button', { name: 'Start Learning' }).click();
  await screen.getByRole('heading', { name: /Sam/ }).waitFor(); await overflow(screen, `${width} dashboard`);
  if (width === 320 || width === 390) await screen.screenshot({ path: `.screenshots/dashboard-${width}.png`, fullPage: true });
  const nav = () => screen.locator(width < 768 ? '.mobile-nav button' : '.side-nav button');
  await nav().nth(2).click(); await screen.getByRole('heading', { name: 'Flashcard Studio.' }).waitFor(); await overflow(screen, `${width} flashcards`);
  await screen.locator('.flash-card').click();
  await nav().nth(3).click(); await screen.getByRole('heading', { name: 'Awards Vault.' }).waitFor(); await overflow(screen, `${width} awards`);
  await screen.locator('.award-card').first().click(); await screen.getByRole('dialog').waitFor(); await overflow(screen, `${width} award detail`); await screen.getByRole('button', { name: 'Close award details' }).click();
  await nav().nth(4).click(); await screen.locator('.profile-settings').click(); await screen.getByRole('heading', { name: 'Your settings.' }).waitFor(); await overflow(screen, `${width} settings`);
  await screen.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backupBuffer }); await screen.getByText('Backup ready to review').waitFor(); await overflow(screen, `${width} backup preview`);
  await nav().nth(1).click(); await screen.locator('.topic-card').first().click(); await screen.getByRole('button', { name: 'Take topic quiz' }).click(); await overflow(screen, `${width} quiz setup`);
  await start(screen, 'easy'); await overflow(screen, `${width} active quiz`);
  if (width === 320 || width === 390) await screen.screenshot({ path: `.screenshots/quiz-${width}.png`, fullPage: true });
  await screen.getByRole('button', { name: 'Finish quiz now' }).click(); await screen.getByRole('button', { name: 'Submit quiz' }).click(); await screen.getByRole('heading', { name: 'Look what you did.' }).waitFor(); await overflow(screen, `${width} results`);
  await screen.getByRole('button', { name: 'Retry quiz' }).click(); await start(screen, 'easy'); await screen.getByRole('button', { name: 'Exit quiz' }).click(); await screen.getByRole('heading', { name: 'Quiz Cancelled' }).waitFor(); await overflow(screen, `${width} cancellation`);
  assert.deepEqual(mobileErrors, []);
  await mobile.close();
  console.log(`PASS: ${width}px welcome, dashboard, flashcards, awards, settings/backup, setup, quiz, results and cancellation`);
}
await browser.close();