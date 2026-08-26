import { timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';

const DEFAULT_SLEEP_MIN_SECONDS = 90;
const DEFAULT_SLEEP_MAX_SECONDS = 120;
const DEFAULT_SECRET_HEADER = 'Authorization';

export const maxDuration = 300;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

function parseEnvNumber(name: string, fallback: number): number {
  const raw = env(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function randomInclusiveMs(minSeconds: number, maxSeconds: number): number {
  const minMs = Math.round(Math.max(0, minSeconds) * 1000);
  const maxMs = Math.round(Math.max(0, maxSeconds) * 1000);
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function secretsEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(request: Request): boolean {
  const secret = env('CALLER_SECRET');
  if (!secret) {
    return false;
  }

  const headerName = env('CALLER_SECRET_HEADER') ?? DEFAULT_SECRET_HEADER;
  const provided = request.headers.get(headerName);
  if (provided === null) {
    return false;
  }

  let match = secretsEqual(provided, secret);
  if (
    headerName.toLowerCase() === 'authorization' &&
    !secret.startsWith('Bearer ')
  ) {
    match = secretsEqual(provided, `Bearer ${secret}`) || match;
  }
  return match;
}

async function readPayload(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildWebhookHeaders(): Headers {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  const extra = env('WEBHOOK_HEADERS');
  if (extra) {
    try {
      const parsed: unknown = JSON.parse(extra);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (typeof value === 'string') {
            headers.set(key, value);
          } else if (value != null) {
            headers.set(key, String(value));
          }
        }
      } else {
        console.error('WEBHOOK_HEADERS must be a JSON object; ignoring');
      }
    } catch {
      console.error('WEBHOOK_HEADERS is not valid JSON; ignoring');
    }
  }

  const secret = env('WEBHOOK_SECRET');
  if (secret) {
    const headerName = env('WEBHOOK_SECRET_HEADER') ?? DEFAULT_SECRET_HEADER;
    const value =
      headerName.toLowerCase() === 'authorization' &&
      !secret.startsWith('Bearer ')
        ? `Bearer ${secret}`
        : secret;
    headers.set(headerName, value);
  }

  return headers;
}

async function runBackground(opts: {
  receivedAt: string;
  method: string;
  payload: unknown;
}): Promise<void> {
  const min = parseEnvNumber('SLEEP_MIN_SECONDS', DEFAULT_SLEEP_MIN_SECONDS);
  const max = parseEnvNumber('SLEEP_MAX_SECONDS', DEFAULT_SLEEP_MAX_SECONDS);
  const sleptMs = randomInclusiveMs(min, max);
  await delay(sleptMs);

  const url = env('WEBHOOK_URL');
  if (!url) {
    console.error('WEBHOOK_URL is missing; skipping POST');
    return;
  }

  const body = {
    source: 'grokbot-helper',
    sleptMs,
    receivedAt: opts.receivedAt,
    method: opts.method,
    payload: opts.payload,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildWebhookHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`webhook POST failed with status ${response.status}`);
    }
  } catch (err) {
    console.error('webhook POST failed', err);
  }
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    );
  }

  const receivedAt = new Date().toISOString();
  const payload = await readPayload(request);

  waitUntil(
    runBackground({
      receivedAt,
      method: request.method,
      payload,
    }),
  );

  return Response.json({ ok: true });
}

export function GET(request: Request): Promise<Response> {
  return handle(request);
}

export function POST(request: Request): Promise<Response> {
  return handle(request);
}
