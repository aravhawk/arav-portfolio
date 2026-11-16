import { OG_SIZE, OG_TYPE, renderOg } from '@/lib/og';

export const alt = 'Work by Arav Jain: everything I have built.';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ kicker: 'Work', title: 'Everything I have built', line: 'Eight things I would point you to first, then the rest.', variant: 'page' });
}
