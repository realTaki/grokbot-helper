# grokbot-helper

Private Vercel Function. Do not touch MAGI / FoMON3D / Clawboard. No real webhook URLs or secrets in any file.

## Behavior
- HTTP handler (GET and POST) at `/api/defer`.
- Return **200 immediately** with JSON `{ "ok": true }`.
- Use `waitUntil` from `@vercel/functions` for background work. Do not await the sleep/POST on the request path.
- Background: sleep a random duration in `[SLEEP_MIN_SECONDS, SLEEP_MAX_SECONDS]` (defaults **90** and **120**), then POST `WEBHOOK_URL`.
- Function `maxDuration` **300** (Hobby Fluid default/max is 300s; 90–120s sleep must fit).

## Env (no real values in repo)
| Name | Required | Default | Meaning |
|---|---|---|---|
| WEBHOOK_URL | yes (runtime) | | Target POST URL |
| WEBHOOK_SECRET | no | | Secret value |
| WEBHOOK_SECRET_HEADER | no | `Authorization` | Header that carries the secret. If the header is Authorization and the secret does not already start with `Bearer `, prefix `Bearer `. |
| WEBHOOK_HEADERS | no | | Optional JSON object of extra headers, e.g. `{"X-Custom":"value"}` |
| SLEEP_MIN_SECONDS | no | 90 | Inclusive lower bound |
| SLEEP_MAX_SECONDS | no | 120 | Inclusive upper bound |

If WEBHOOK_URL is missing, log an error in the background task and skip the POST. Still return 200 to the caller.

POST body to the target (JSON): `{ "source": "grokbot-helper", "sleptMs": <number>, "receivedAt": <ISO>, "method": <GET|POST>, "payload": <parsed JSON or null> }`.

## Files to create
- `api/defer.ts` — Node runtime Vercel Function as above
- `package.json` — name grokbot-helper, private, module, dep `@vercel/functions` (current major)
- `tsconfig.json` — enough for Vercel to compile the function
- `vercel.json` — `maxDuration` 300 for the function if not exported
- `.gitignore` — `.env`, `.vercel`, `node_modules`, `.DS_Store`
- `.env.example` — placeholder keys only, empty values, short comments
- `README.md` — what it does; how to set env in Vercel (Hobby team `myvercel`, do **not** put team IDs or secrets in the README); local `vercel dev`; curl examples using placeholders like `https://<project>.vercel.app/api/defer`; note that Taki fills env in the Vercel project UI
- `SPEC.md` already exists — leave it, or fold into README and delete if redundant. Prefer keeping README as the user-facing doc.

Do not commit `.env`. Do not invent example secrets that look real. Do not deploy. Do not `git commit` unless asked.

After writing, print the file list.

## Inbound auth (required)

`/api/defer` is not public. Gate every GET/POST before waitUntil:

| Name | Required | Default | Meaning |
|---|---|---|---|
| CALLER_SECRET | yes (runtime) | | Shared secret callers must present |
| CALLER_SECRET_HEADER | no | `Authorization` | Incoming header that carries the secret |

- If `CALLER_SECRET` is missing, or the request header value does not match, return **401** `{ "ok": false, "error": "unauthorized" }` and **do not** call `waitUntil`.
- This is independent of outbound `WEBHOOK_SECRET` / `WEBHOOK_SECRET_HEADER`.
- If the header is `Authorization` and the env secret does not start with `Bearer `, accept either the raw secret or `Bearer <secret>`.
- Compare in constant time (`crypto.timingSafeEqual` on equal-length buffers).
- Update `.env.example` and README (curl examples must include the caller header). Keep GET and POST as Vercel web-handler exports (`export function GET` / `export function POST`, or a shared handler both use). Export `maxDuration = 300`.
- Do not git commit. Do not write real secrets. Do not recreate a filled `.env`.
