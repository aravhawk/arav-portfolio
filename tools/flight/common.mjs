/** What the renderer and the encoder share. */
import { execFileSync } from 'node:child_process';

/** The two shapes: the window the page is laid out in, and how dense its pixels are. */
export const SHAPES = {
  wide: { w: 1920, h: 1080, dpr: 4 / 3, mobile: false },
  tall: { w: 390, h: 844, dpr: 2, mobile: true },
};

/** ffmpeg: FFMPEG if set, else the one `uv run --with imageio-ffmpeg` brings. It is never a dependency of the site. */
export function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  return execFileSync('uv', ['run', '--quiet', '--with', 'imageio-ffmpeg', 'python', '-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
}
