import { OG_SIZE, OG_TYPE, ogAlt, renderOg } from '@/lib/og';

export const alt = ogAlt('Work by Arav Jain: everything I have built', 'work');
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ kicker: 'Work', title: 'Everything I have built', line: 'Eight things I would point you to first, then the rest.', picture: 'work' });
}
