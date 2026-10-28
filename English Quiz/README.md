# English Studio

Developed by Venush. A Class 10 learning studio with browser-only student data; there is no database or account service. Progress is specific to the current browser and device.

## Run with AI quizzes

The existing project uses Vite and React. The included Node server serves the production build and the same-origin Groq endpoint, so the API key never enters the client bundle.

1. Run `npm install` and `npm run build`.
2. Set `GROQ_API_KEY`, `GROQ_MODEL` (for example, `llama-3.3-70b-versatile`) and optionally `GROQ_BASE_URL` on the server. See `.env.example`. Never use a `VITE_` or `NEXT_PUBLIC_` prefix for the key.
3. Run `node server.mjs` and open `http://localhost:3000`. You can use `PORT` and `HOST` to configure the listener. On supported Node versions, `node --env-file=.env server.mjs` loads a local `.env` file.

`npm run dev` is useful for front-end development, but Vite alone does not run the private API endpoint. Use the Node server above for quiz generation. Without a configured key, the interface reports the error and offers a retry; it never starts an incomplete quiz.

Backups are JSON files initiated by the student. Restore replaces local learning records in one IndexedDB transaction. Records are checked for structural and scoring consistency, but browser data and backups are not tamper-proof. Anti-cheat uses browser focus, visibility and lifecycle signals as a deterrent; browsers cannot detect every possible form of cheating or every shutdown. Generated questions receive structural checks and an independent AI review, but automated review cannot guarantee perfect semantic accuracy.

## Verification

Run `npx tsc --noEmit`, `npm run build`, and `node tests/server.mjs`. With the built app running on port 3000 and Playwright Chromium installed, run `xvfb-run -a node tests/e2e.mjs` on Linux. The tests use a mock Groq upstream and mock generated questions; a real Groq key is needed to verify live generation.