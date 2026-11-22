/**
 * What the signup says, in one place: the form (scripts on), the pages the
 * route sends a plain form post to (scripts off) and the tests read these.
 * Nothing is sent to anyone yet, so no line promises a schedule.
 */

/** What the route can answer. */
export type Outcome = 'subscribed' | 'already' | 'invalid' | 'limited' | 'failed';

export const OUTCOMES: readonly Outcome[] = ['subscribed', 'already', 'invalid', 'limited', 'failed'];

/** Where a signup came from: the `source` column. */
export type Source = 'home' | 'blog' | 'page';
export const SOURCES: readonly Source[] = ['home', 'blog', 'page'];

/** What a subscriber gets. */
export const PROMISE = 'New posts by email, when there is something to send.';

/** One plain sentence for each answer, said by the field. (Each of the three reasons sets in one line under the
    field at 358 px, the width a phone gives it in the home page's ending.) */
export const SAY: Record<Outcome, string> = {
  subscribed: "You're subscribed. I'll write when there is a new post.",
  already: "You're already subscribed. Nothing more to do.",
  invalid: 'That address looks wrong. Please check it.',
  limited: 'Too many tries. Please wait a few minutes.',
  failed: 'Something went wrong. Please try again.',
};

/** While the address is on its way. */
export const SENDING = 'Subscribing…';

/** The same check in the form and in the route: something before the @, and a domain of non-empty labels with a dot
    between them. It is not the RFC's grammar: delivery is the real test. */
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
export const EMAIL_MAX = 254;

/** An address as it is stored: trimmed and in lower case. */
export const normalizeEmail = (raw: unknown): string => (typeof raw === 'string' ? raw.trim().toLowerCase() : '');

export const isValidEmail = (email: string): boolean => email.length > 0 && email.length <= EMAIL_MAX && EMAIL_RE.test(email);

/** The hidden field no reader fills. */
export const HONEYPOT = 'homepage_url';
