import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Home screen icon: the mark from icon.svg, a stream under a level line. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0c0e', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <path d="M14 40c6 0 6-6 12-6s6 6 12 6 6-6 12-6" fill="none" stroke="#7fd3e6" strokeWidth="5" strokeLinecap="round" />
          <path d="M22 24h20" stroke="#f1f4f5" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
