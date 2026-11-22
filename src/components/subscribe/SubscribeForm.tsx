import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { haptic } from '@/lib/haptics';
import { EMAIL_MAX, HONEYPOT, OUTCOMES, PROMISE, SAY, SENDING, isValidEmail, normalizeEmail, type Outcome, type Source } from '@/lib/subscribe/messages';

/**
 * The newsletter's field: one address, one button, one line that says what
 * happened. The home page's ending and the blog's index both show this one.
 *
 * It is a real form. With scripts off the browser posts it to
 * /api/subscribe and is sent to a page that says the answer
 * (src/app/newsletter/[state]). With scripts on the same route is asked in
 * place and the answer is said here: the field is replaced by the
 * confirmation only once the server has said yes; every other answer leaves
 * the reader in the field with what was typed and the reason beside it.
 * Nothing is remembered in the browser: the server is the one that knows.
 *
 * This file has no 'use client' of its own, on purpose: it reaches the
 * browser through src/components/ending/Ending.tsx, which every page already
 * loads, and pages import it from there. As a client module of its own it was
 * one more script request before the first paint, which cost /blog a point
 * on a phone (docs/site-system/performance.md, "the first round").
 */

type Status = 'idle' | 'sending' | Outcome;

const isOutcome = (v: unknown): v is Outcome => OUTCOMES.includes(v as Outcome);

export function SubscribeForm({
  source,
  label = 'Newsletter',
  compact = false,
  split = false,
  className,
}: {
  /** Where this form stands: stored with the address. */
  source: Source;
  /** The field's visible label. The default names the thing; under a heading that already does, it names the field. */
  label?: string;
  /** The home page's ending: the label and the line of what a subscriber gets are said to assistive technology only, and what went wrong is said in the small print under the field. */
  compact?: boolean;
  /** On a wide page: what a subscriber gets at the left, the field at the right, on the page's two columns. */
  split?: boolean;
  className?: string;
}) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  /** A submit from the keys changes the words and moves nothing. */
  const [instant, setInstant] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLParagraphElement>(null);
  const pressed = useRef(false);

  // With scripts on, the form says its own sentences: the browser's bubbles are for the form without them.
  useEffect(() => {
    if (form.current) form.current.noValidate = true;
  }, []);

  const settled = status === 'subscribed' || status === 'already';
  const wrong = status === 'invalid' || status === 'limited' || status === 'failed';

  // The field is replaced by the confirmation: focus goes to it, which is also what announces it.
  useEffect(() => {
    if (settled) done.current?.focus({ preventScroll: true });
  }, [settled]);

  const backToField = () => requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // (The button is aria-disabled while sending, not disabled: a focused button must not lose its focus.)
    if (status === 'sending') return;
    setInstant(!pressed.current);
    pressed.current = false;

    const address = normalizeEmail(email);
    if (!isValidEmail(address)) {
      setStatus('invalid');
      input.current?.focus({ preventScroll: true });
      return;
    }

    setStatus('sending');
    const abort = new AbortController();
    // A request that hangs must not hang the form.
    const timer = window.setTimeout(() => abort.abort(), 10_000);
    const trap = form.current?.elements.namedItem(HONEYPOT);
    let answer: Status = 'failed';
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, source, [HONEYPOT]: trap instanceof HTMLInputElement ? trap.value : '' }),
        signal: abort.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      const said = body && typeof body === 'object' ? (body as { outcome?: unknown }).outcome : null;
      // Once the answer is a yes the address is saved: a body that cannot be read must not turn that into an error.
      answer = isOutcome(said) ? said : res.ok ? 'subscribed' : res.status === 429 ? 'limited' : 'failed';
    } catch {
      answer = 'failed';
    } finally {
      window.clearTimeout(timer);
    }
    setStatus(answer);
    if (answer === 'subscribed' || answer === 'already') haptic('success');
    else {
      haptic('error');
      backToField();
    }
  };

  const say = `${id}-say`;
  const hint = `${id}-hint`;

  return (
    <form
      ref={form}
      className={`sub${compact ? ' sub-compact' : ''}${split ? ' sub-split' : ''}${className ? ` ${className}` : ''}`}
      action="/api/subscribe"
      method="post"
      onSubmit={submit}
      aria-busy={status === 'sending'}
      data-state={status}
      data-instant={instant ? '' : undefined}
    >
      {/* What a subscriber gets, then the field's name over the field. (In the ending the field's own words say what
          it is for, and both of these are said to assistive technology only.) */}
      <p id={hint} className={compact ? 'sr-only' : 'sub-hint'}>
        {PROMISE}
      </p>
      <label className={compact ? 'sr-only' : 'sub-label label'} htmlFor={id}>
        {compact ? `${label}: your email address` : label}
      </label>
      <div className="sub-row">
        {settled ? (
          <p ref={done} className="sub-done" role="status" tabIndex={-1}>
            <svg className="sub-tick" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3.6 9.6 7.3 13.2 14.4 5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{SAY[status]}</span>
          </p>
        ) : (
          <div className="sub-field">
            <input
              ref={input}
              id={id}
              className="sub-input"
              type="email"
              name="email"
              required
              maxLength={EMAIL_MAX}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              placeholder={compact ? 'Email for new posts' : 'you@example.com'}
              value={email}
              readOnly={status === 'sending'}
              aria-invalid={status === 'invalid' || undefined}
              aria-describedby={wrong ? `${say} ${hint}` : hint}
              onKeyDown={(e) => {
                if (e.key === 'Enter') pressed.current = false;
              }}
              onChange={(e) => {
                setEmail(e.target.value);
                // Typing again takes the reason away: it was about the last try.
                if (wrong) setStatus('idle');
              }}
            />
            <input type="hidden" name="source" value={source} />
            {/* A field no reader meets: off the screen, out of the tab order, hidden from assistive technology (and without words of its own: the home page counts its visible words). A filled one is a robot's. */}
            <span className="sub-trap" aria-hidden="true">
              <input type="text" name={HONEYPOT} tabIndex={-1} autoComplete="off" defaultValue="" aria-label="Leave this empty" />
            </span>
            <button
              type="submit"
              className="sub-go"
              aria-disabled={status === 'sending' || undefined}
              data-state={status}
              onPointerDown={() => {
                pressed.current = true;
              }}
            >
              {status === 'sending' ? SENDING : status === 'failed' ? 'Try again' : 'Subscribe'}
            </button>
          </div>
        )}
      </div>
      {/* Always in the page, so what it comes to say is announced; it has its place kept, so nothing moves when it speaks. */}
      <p id={say} className="sub-say" aria-live="polite">
        {wrong ? <span className="sub-said">{SAY[status]}</span> : status === 'sending' ? <span className="sr-only">Subscribing</span> : null}
      </p>
    </form>
  );
}
