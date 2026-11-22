import type { Limiter } from './limiter';
import { isValidEmail, normalizeEmail, SOURCES, type Outcome, type Source } from './messages';

/**
 * The signup's decisions, with the database and the limiter handed in: the
 * route gives it the real ones, the tests give it their own.
 */

export interface SubscribeInput {
  /** The address as it was typed. */
  email: unknown;
  /** The hidden field's value. Real readers leave it empty. */
  honeypot?: unknown;
  /** Where the form stands. */
  source?: unknown;
  /** The requester's network address, for the limiter only. */
  address: string;
}

export interface SubscribeDeps {
  /** Stores the address if it is new. `exists` when it was already there. Throws when the database cannot be reached. */
  insert(email: string, source: Source): Promise<'inserted' | 'exists'>;
  limiter: Limiter;
  now?: () => number;
}

export interface SubscribeResult {
  outcome: Outcome;
  /** Seconds until another try will pass (only with `limited`). */
  retryAfter?: number;
}

export const sourceOf = (raw: unknown): Source => (SOURCES.includes(raw as Source) ? (raw as Source) : 'page');

export async function subscribe(input: SubscribeInput, deps: SubscribeDeps): Promise<SubscribeResult> {
  const took = deps.limiter.take(input.address, deps.now?.());
  if (!took.ok) return { outcome: 'limited', retryAfter: took.retryAfter };

  // A filled trap gets the answer a new reader gets, and nothing is stored: a robot learns nothing from it.
  if (typeof input.honeypot === 'string' && input.honeypot.trim() !== '') return { outcome: 'subscribed' };

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { outcome: 'invalid' };

  try {
    const stored = await deps.insert(email, sourceOf(input.source));
    return { outcome: stored === 'inserted' ? 'subscribed' : 'already' };
  } catch {
    // Not configured, unreachable, or the table is not there: fail closed, and say only that it failed.
    return { outcome: 'failed' };
  }
}
