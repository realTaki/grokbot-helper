# grokbot-helper

Private Vercel Function. It acknowledges `GET` and `POST` at `/api/defer` immediately, then (in the background) sleeps a random interval and POSTs JSON to a configured webhook.

This repo is standalone. Do not wire it into MAGI, FoMON3D, or Clawboard.

## Behavior

- `/api/defer` is not public. Every `GET` and `POST` is gated on inbound caller auth **before** `waitUntil`.
- If `CALLER_SECRET` is missing, or the incoming header does not match, the function returns **401** `{ "ok": false, "error": "unauthorized" }` and does not start background work.
- Authorized requests return **200** right away with `{ "ok": true }`.
- Background work uses `waitUntil` from `@vercel/functions`. The request path does not wait for the sleep or the outbound POST.
- Sleep is a random duration in `[SLEEP_MIN_SECONDS, SLEEP_MAX_SECONDS]` (defaults **90** and **120**).
- Function `maxDuration` is **300** seconds so a 90–120s sleep fits on Hobby Fluid.

If `WEBHOOK_URL` is missing, the background task logs an error and skips the POST. An authorized caller still gets 200.

Inbound `CALLER_SECRET` / `CALLER_SECRET_HEADER` is independent of outbound `WEBHOOK_SECRET` / `WEBHOOK_SECRET_HEADER`.

Outbound POST body:

```json
{
  "source": "grokbot-helper",
  "sleptMs": 105000,
  "receivedAt": "2026-01-01T00:00:00.000Z",
  "method": "POST",
  "payload": null
}
```

`payload` is the parsed JSON body of the incoming request, or `null` if the body is empty or not JSON.

## Environment

Set env in the Vercel project UI for Hobby team `myvercel`. Taki fills env in the Vercel project UI. Do not commit `.env`. Do not put secrets or team IDs in this repo.

| Name | Required | Default | Meaning |
|---|---|---|---|
| `CALLER_SECRET` | yes (runtime) | | Shared secret callers must present |
| `CALLER_SECRET_HEADER` | no | `Authorization` | Incoming header that carries the secret. If the header is Authorization and the env secret does not already start with `Bearer `, accept either the raw secret or `Bearer <secret>`. |
| `WEBHOOK_URL` | yes (runtime) | | Target POST URL |
| `WEBHOOK_SECRET` | no | | Secret value |
| `WEBHOOK_SECRET_HEADER` | no | `Authorization` | Header that carries the secret. If the header is Authorization and the secret does not already start with `Bearer `, prefix `Bearer `. |
| `WEBHOOK_HEADERS` | no | | Optional JSON object of extra headers, e.g. `{"X-Custom":"value"}` |
| `SLEEP_MIN_SECONDS` | no | 90 | Inclusive lower bound |
| `SLEEP_MAX_SECONDS` | no | 120 | Inclusive upper bound |

Copy `.env.example` for local key names. Leave values empty in git.

## Local

```bash
npx vercel dev
```

```bash
curl -X GET "http://localhost:3000/api/defer" \
  -H "Authorization: Bearer <caller-secret>"
curl -X POST "http://localhost:3000/api/defer" \
  -H "Authorization: Bearer <caller-secret>" \
  -H "content-type: application/json" \
  -d '{"hello":"world"}'
```

## Deployed

```bash
curl -X GET "https://<project>.vercel.app/api/defer" \
  -H "Authorization: Bearer <caller-secret>"
curl -X POST "https://<project>.vercel.app/api/defer" \
  -H "Authorization: Bearer <caller-secret>" \
  -H "content-type: application/json" \
  -d '{"hello":"world"}'
```
