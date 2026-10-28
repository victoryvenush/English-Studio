import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

let invalid = false;
let reviewReject = false;
let upstreamCalls = 0;
const upstream = http.createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  assert.equal(request.headers.authorization, 'Bearer test-only-secret');
  const payload = JSON.parse(body);
  assert.equal(payload.model, 'test-model');
  const count = Number(payload.messages[1].content.match(/exactly (\d+)/)[1]);
  upstreamCalls += 1;
  if (payload.messages[0].content.startsWith('You are an independent')) {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ verdicts: Array.from({ length: count }, (_, index) => ({ index, valid: !reviewReject, reason: 'Checked the answer and explanation.' })) }) } }] }));
    return;
  }
  const questions = Array.from({ length: count }, (_, index) => ({
    type: 'multiple_choice', question: `Which carefully chosen answer is correct for case number ${index}?`,
    options: ['Correct', 'Incorrect one', 'Incorrect two', 'Incorrect three'], correctAnswer: invalid ? 'Not an option' : 'Correct',
    explanation: 'The first option is the correct answer in this test.', takeaway: 'Read the full question before choosing an answer.',
  }));
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ questions }) } }] }));
});
await new Promise((resolve) => upstream.listen(3101, '127.0.0.1', resolve));
const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '3100', HOST: '127.0.0.1', GROQ_BASE_URL: 'http://127.0.0.1:3101/openai/v1', GROQ_API_KEY: 'test-only-secret', GROQ_MODEL: 'test-model' }, stdio: 'ignore' });
try {
  let ready = false;
  for (let i = 0; i < 30; i += 1) { try { await fetch('http://127.0.0.1:3100/'); ready = true; break; } catch { await delay(100); } }
  assert.ok(ready, 'server started');
  const request = (body, headers = {}) => fetch('http://127.0.0.1:3100/api/generate-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const valid = { topicId: 'voice', difficulty: 'hard', count: 15 };
  let response = await request(valid);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
  const result = await response.json();
  assert.equal(result.questions.length, 15);
  assert.equal(new Set(result.questions.map((item) => item.id)).size, 15);
  assert.equal(new Set(result.questions.map((item) => item.fingerprint)).size, 15);
  assert.ok(result.questions.every((item) => item.topicId === 'voice' && item.difficulty === 'hard' && item.options.includes(item.correctAnswer)));
  assert.ok(!JSON.stringify(result).includes('test-only-secret'));
  assert.equal((await request({ ...valid, count: 16 })).status, 400);
  assert.equal((await request({ ...valid, topicId: 'not-a-topic' })).status, 400);
  assert.equal((await request(valid, { Origin: 'https://unrelated.example' })).status, 403);
  invalid = true;
  const before = upstreamCalls;
  response = await request(valid);
  assert.equal(response.status, 502);
  assert.equal(upstreamCalls - before, 3);
  assert.ok((await response.json()).error);
  invalid = false; reviewReject = true;
  const beforeReview = upstreamCalls;
  response = await request(valid);
  assert.equal(response.status, 502);
  assert.equal(upstreamCalls - beforeReview, 6);
  console.log('PASS: Groq proxy validation, same-origin guard, secret handling, 15 questions, independent review and bounded retries');
} finally {
  child.kill();
  await new Promise((resolve) => upstream.close(resolve));
}