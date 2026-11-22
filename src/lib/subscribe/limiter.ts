import { createHash, randomBytes } from 'node:crypto';

/**
 * A small brake on one requester hammering the signup: a few tries a minute
 * and a few dozen a day.
 *
 * Its limits, plainly: the counts live in the memory of one warm function
 * instance. On a serverless platform there may be several instances at once
 * and each is forgotten when it goes cold, so a determined sender gets more
 * than these numbers. It blunts a loop from one address; it is not a durable
 * limit. Sustained abuse needs a rule at the platform's edge.
 *
 * No network address is kept: the key is a SHA-256 of the address with a salt
 * that is made when the instance starts, lives only in its memory and is
 * never written anywhere. The hash cannot be turned back or matched across
 * instances, and it goes with the instance.
 */

export interface LimiterOptions {
  perMinute?: number;
  perDay?: number;
  /** Distinct requesters remembered at once. */
  maxTracked?: number;
  salt?: string;
}

export interface Limiter {
  /** Counts one try. `ok: false` when the requester is over a limit, with the seconds until a try will pass. */
  take(address: string, now?: number): { ok: true } | { ok: false; retryAfter: number };
  /** How many requesters are remembered (for the tests). */
  size(): number;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function createLimiter({ perMinute = 5, perDay = 30, maxTracked = 5000, salt = randomBytes(16).toString('hex') }: LimiterOptions = {}): Limiter {
  // Insertion order is the order of each requester's last counted try: the first key is the stalest.
  const tries = new Map<string, number[]>();
  const keyOf = (address: string) => createHash('sha256').update(salt).update(address).digest('base64url');

  return {
    take(address, now = Date.now()) {
      const key = keyOf(address);
      const day = (tries.get(key) ?? []).filter((t) => now - t < DAY);
      const minute = day.filter((t) => now - t < MINUTE);
      // Only a try that passes is counted: hammering after a refusal cannot grow the history or push the wait out.
      if (day.length >= perDay) {
        tries.set(key, day);
        return { ok: false, retryAfter: Math.max(1, Math.ceil((day[0] + DAY - now) / 1000)) };
      }
      if (minute.length >= perMinute) {
        tries.set(key, day);
        return { ok: false, retryAfter: Math.max(1, Math.ceil((minute[0] + MINUTE - now) / 1000)) };
      }
      day.push(now);
      tries.delete(key);
      tries.set(key, day);
      // A hard bound on memory: when a flood of distinct requesters fills the map, the stalest are forgotten first.
      while (tries.size > maxTracked) {
        const oldest = tries.keys().next().value;
        if (oldest === undefined) break;
        tries.delete(oldest);
      }
      return { ok: true };
    },
    size: () => tries.size,
  };
}
