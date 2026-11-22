import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SubscribeForm } from '@/components/subscribe/SubscribeForm';
import { PageShell } from '@/components/PageShell';
import { OUTCOMES, type Outcome } from '@/lib/subscribe/messages';

/**
 * Where a reader without scripts lands after the newsletter's form: the
 * browser posts the form to /api/subscribe, which stores the address and
 * sends it here (303) to be told what happened. With scripts on the form
 * says the same in place and these pages are not met. One page for each
 * answer, made at build time; none carries an address.
 */

const WORDS: Record<Outcome, { title: string; line: string }> = {
  subscribed: { title: "You're subscribed.", line: "I'll write when there is a new post. Nothing is sent on a schedule." },
  already: { title: "You're already subscribed.", line: 'That address was on the list. Nothing more to do.' },
  invalid: { title: 'That address looks wrong.', line: 'Please check it and send it again.' },
  limited: { title: 'Too many tries.', line: 'Please wait a few minutes and try again.' },
  failed: { title: 'Something went wrong.', line: 'Nothing was saved. Please try again.' },
};

export const dynamicParams = false;
export const generateStaticParams = () => OUTCOMES.map((state) => ({ state }));

export const metadata: Metadata = {
  title: 'Newsletter',
  description: 'New posts by email.',
  robots: { index: false, follow: false },
};

export default async function NewsletterState({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  if (!OUTCOMES.includes(state as Outcome)) notFound();
  const outcome = state as Outcome;
  const words = WORDS[outcome];
  const again = outcome === 'invalid' || outcome === 'limited' || outcome === 'failed';
  return (
    <PageShell head={{ label: 'Newsletter', title: words.title, lead: words.line, back: { href: '/blog', label: 'Writing' } }}>
      {again ? (
        <section className="sec wrap" aria-label="Try again">
          <SubscribeForm source="page" label="Email address" />
        </section>
      ) : null}
    </PageShell>
  );
}
