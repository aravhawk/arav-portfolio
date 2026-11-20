import { OG_SIZE, OG_TYPE, ogAlt, renderOg } from '@/lib/og';

export const alt = ogAlt('Writing by Arav Jain: notes from the work');
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ kicker: 'Writing', title: 'Notes from the work', line: 'What I learn building agents and the tools around them.' });
}
