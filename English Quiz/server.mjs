import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const topicNames = {
  'relative-pronouns': 'Combining Sentences with Relative Pronouns', voice: 'Active and Passive Voice', speech: 'Direct and Indirect Speech',
  prepositions: 'Prepositions', editing: 'Editing Passages and Error Correction', tenses: 'Tenses and Verb Forms',
  'past-actions': 'Repeated Past Actions using used to and would', 'noun-modifiers': 'Noun Modifiers', advice: 'Giving Advice and Language Functions',
  synonyms: 'Synonyms', antonyms: 'Antonyms', 'word-forms': 'Correct Word Forms and Word Formation',
  'prefixes-suffixes': 'Prefixes, Suffixes, and Incomplete Spellings', spelling: 'Spelling Correction', dictionary: 'Dictionary Skills and Word Lookup',
  'phrasal-verbs': 'Phrasal Verbs and Idioms', 'word-meanings': 'Matching Words with Their Meanings',
};
const requestSchema = z.object({ topicId: z.string().refine((value) => Object.hasOwn(topicNames, value)), difficulty: z.enum(['easy', 'medium', 'hard']), count: z.number().int().min(1).max(15) }).strict();
const itemSchema = z.object({
  type: z.enum(['multiple_choice', 'fill_blank', 'transformation', 'error_identification', 'word_form']),
  question: z.string().trim().min(8).max(1000), options: z.array(z.string().trim().min(1).max(300)).length(4),
  correctAnswer: z.string().trim().min(1).max(300), explanation: z.string().trim().min(8).max(1200), takeaway: z.string().trim().min(8).max(1200),
}).strict().superRefine((item, context) => {
  const normalized = item.options.map((option) => option.toLowerCase());
  if (new Set(normalized).size !== 4 || item.options.filter((option) => option === item.correctAnswer).length !== 1) context.addIssue({ code: 'custom', message: 'Options and correct answer are inconsistent.' });
  if (item.options.some((option) => /^(all|none|both) of the above[.!]?$/i.test(option))) context.addIssue({ code: 'custom', message: 'Ambiguous compound option.' });
});
const responseSchema = z.object({ questions: z.array(itemSchema).min(1).max(15) }).strict();
const reviewSchema = z.object({ verdicts: z.array(z.object({ index: z.number().int().min(0).max(14), valid: z.boolean(), reason: z.string().max(400) }).strict()).min(1).max(15) }).strict();
const normalize = (text) => text.toLowerCase().normalize('NFKC').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const rateLimit = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function bodyJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) throw new Error('Request is too large.');
  }
  return JSON.parse(body);
}

async function generate(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST for quiz generation.' });
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, { error: 'Cross-origin requests are not allowed.' }); }
    catch { return json(res, 403, { error: 'Invalid request origin.' }); }
  }
  const ip = req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const recent = (rateLimit.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 12) return json(res, 429, { error: 'Too many requests. Please wait a minute and try again.' });
  recent.push(now); rateLimit.set(ip, recent);
  let parsed;
  try { parsed = requestSchema.safeParse(await bodyJson(req)); }
  catch { return json(res, 400, { error: 'Invalid JSON request.' }); }
  if (!parsed.success) return json(res, 400, { error: 'Choose a valid topic and difficulty.' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return json(res, 503, { error: 'Quiz generation is not configured. The server needs GROQ_API_KEY and GROQ_MODEL.' });
  const { topicId, difficulty, count } = parsed.data;
  const base = (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  let lastMessage = 'The quiz could not be generated. Please try again.';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const upstream = await fetch(`${base}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({
          model, temperature: 0.85, max_completion_tokens: 6500, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are an expert Class 10 English teacher and question editor. Return only a JSON object. Every question must have one unambiguously correct answer, three plausible but clearly incorrect alternatives, a correct explanation, and a concise learning takeaway. Check grammar and answer consistency carefully. Never use all/none/both of the above.' },
            { role: 'user', content: `Write exactly ${count} fresh, substantially different ${difficulty} questions on ${topicNames[topicId]}. Use a varied mix of appropriate types: multiple_choice, fill_blank, transformation, error_identification, word_form. All types must have four answer options. Return JSON in this exact shape: {"questions":[{"type":"multiple_choice","question":"...","options":["...","...","...","..."],"correctAnswer":"the exact text of one option","explanation":"...","takeaway":"..."}]}. Variation seed: ${randomUUID()}.` },
          ],
        }),
      });
      if (!upstream.ok) { lastMessage = upstream.status === 429 ? 'Groq is busy right now. Please wait and try again.' : 'The AI service could not generate a quiz. Please try again.'; continue; }
      const payload = await upstream.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') continue;
      const result = responseSchema.safeParse(JSON.parse(content));
      if (!result.success || result.data.questions.length !== count) continue;
      const fingerprints = result.data.questions.map((item) => normalize(item.question));
      if (new Set(fingerprints).size !== count || fingerprints.some((item) => !item)) continue;
      const reviewResponse = await fetch(`${base}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({ model, temperature: 0, max_completion_tokens: 2500, response_format: { type: 'json_object' }, messages: [
          { role: 'system', content: 'You are an independent Class 10 English question reviewer. Return only JSON. Judge each question independently: reject it if more than one option could reasonably be correct, if the indicated answer is wrong, or if the explanation contradicts the answer. Be strict and do not rewrite questions.' },
          { role: 'user', content: `Review exactly ${count} questions. Return {"verdicts":[{"index":0,"valid":true,"reason":"brief reason"}]}, one verdict per zero-based question index. Questions: ${JSON.stringify(result.data.questions)}` },
        ] }),
      });
      if (!reviewResponse.ok) { lastMessage = 'The AI could not verify the quiz. Please try again.'; continue; }
      const reviewPayload = await reviewResponse.json();
      const reviewContent = reviewPayload?.choices?.[0]?.message?.content;
      if (typeof reviewContent !== 'string') continue;
      const review = reviewSchema.safeParse(JSON.parse(reviewContent));
      if (!review.success || review.data.verdicts.length !== count || new Set(review.data.verdicts.map((verdict) => verdict.index)).size !== count || review.data.verdicts.some((verdict) => !verdict.valid || verdict.index >= count)) {
        lastMessage = 'Some generated questions could not be verified. Please try again.';
        continue;
      }
      return json(res, 200, { questions: result.data.questions.map((item, index) => ({ ...item, id: randomUUID(), topicId, difficulty, fingerprint: fingerprints[index] })) });
    } catch { lastMessage = 'The AI service timed out or returned invalid questions. Please try again.'; }
  }
  return json(res, 502, { error: lastMessage });
}

const root = path.resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/api/generate-quiz') return generate(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
  try {
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) return json(res, 403, { error: 'Forbidden.' });
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    catch { file = path.join(root, 'index.html'); }
    const contents = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch { json(res, 404, { error: 'Build not found. Run npm run build first.' }); }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log(`English Studio listening on port ${process.env.PORT || 3000}`));