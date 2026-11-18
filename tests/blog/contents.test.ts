import { describe, expect, it } from 'vitest';
import { postContents } from '@/components/blog/contents';

describe('a post’s contents', () => {
  it('lists the second-level headings with the ids the page gives them', () => {
    const md = ['# Title', '', '## The headline numbers', 'text', '### A detail', '## Three failure modes, not one gradient', '## The orthogonal-strengths problem'].join('\n');
    expect(postContents(md)).toEqual([
      { id: 'the-headline-numbers', text: 'The headline numbers' },
      { id: 'three-failure-modes-not-one-gradient', text: 'Three failure modes, not one gradient' },
      { id: 'the-orthogonal-strengths-problem', text: 'The orthogonal-strengths problem' },
    ]);
  });

  it('numbers a repeated heading, drops marks of emphasis and code, and skips fenced code', () => {
    const md = ['## Setup', '```sh', '## not a heading', '```', '## `npm` and **more**', '## Setup', '### Setup'].join('\n');
    expect(postContents(md)).toEqual([
      { id: 'setup', text: 'Setup' },
      { id: 'npm-and-more', text: 'npm and more' },
      { id: 'setup-1', text: 'Setup' },
    ]);
  });

  it('has nothing to list for a post without headings', () => {
    expect(postContents('Just a paragraph.\n\nAnother.')).toEqual([]);
  });
});
