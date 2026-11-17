import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Home screen icon: the mark from icon.svg, an A cut through pale ice with meltwater in the cut. */
export default function AppleIcon() {
  const a = 'M25.5 11h13L54 53H42.6l-2.7-8.2H24.1L21.4 53H10zM32 21.6l-5 14.6h10z';
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: 'linear-gradient(135deg, #f6fafc 0%, #c4dde8 100%)', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="150" height="150" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#123247" />
              <stop offset="0.55" stopColor="#17617a" />
              <stop offset="1" stopColor="#1f9bb2" />
            </linearGradient>
          </defs>
          <path d={a} fill="#ffffff" fillRule="evenodd" transform="translate(0 1.4)" />
          <path d={a} fill="url(#water)" fillRule="evenodd" />
        </svg>
      </div>
    ),
    size,
  );
}
