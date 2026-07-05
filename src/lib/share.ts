import { randomBytes, createHash, timingSafeEqual } from "crypto";

// ─── Public share-link helpers ────────────────────────────────────────────────
// A contact's ledger can be shared via an unguessable token + a short PIN.
// The token lives in the URL; the PIN is shared out-of-band. We store only a
// salted hash of the PIN, never the PIN itself.

export function generateShareToken(): string {
  // ~32 url-safe chars, 192 bits of entropy — not brute-forceable.
  return randomBytes(24).toString("base64url");
}

export function hashPin(pin: string, token: string): string {
  return createHash("sha256").update(`${token}:${pin}`).digest("hex");
}

export function verifyPin(pin: string, token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const candidate = hashPin(pin, token);
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(storedHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,6}$/.test(pin);
}

// ─── In-memory PIN-attempt throttle ──────────────────────────────────────────
// Guards against brute-forcing the PIN on a known token. Process-local, which is
// fine for a single self-hosted server; resets on restart.
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(token: string): { allowed: boolean; retryAfterMin: number } {
  const now = Date.now();
  const rec = attempts.get(token);
  if (!rec || rec.resetAt < now) return { allowed: true, retryAfterMin: 0 };
  if (rec.count >= MAX_ATTEMPTS)
    return { allowed: false, retryAfterMin: Math.ceil((rec.resetAt - now) / 60000) };
  return { allowed: true, retryAfterMin: 0 };
}

export function recordFailedAttempt(token: string): void {
  const now = Date.now();
  const rec = attempts.get(token);
  if (!rec || rec.resetAt < now) attempts.set(token, { count: 1, resetAt: now + WINDOW_MS });
  else rec.count += 1;
}

export function clearAttempts(token: string): void {
  attempts.delete(token);
}
