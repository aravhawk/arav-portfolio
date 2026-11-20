import localFont from 'next/font/local';

/**
 * The home page's own font request. This slot matches the home page only
 * and draws nothing: it exists so that the face the name is cut from is
 * preloaded there and on no other page. The layout declares the same file
 * for everyone (without a preload), so the two share one download.
 */
const ice = localFont({
  src: '../../fonts/TASAOrbiter-Ice.woff2',
  weight: '800',
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

export default function IcePreload() {
  void ice;
  return null;
}
