import { ProfileSwitch } from '@/components/home/ProfileSwitch';
import type { SiteMetrics } from '@/lib/metrics';

/**
 * The project beds that are drawn from data. Each is a box the water owns:
 * the labels are DOM (and so stay dry), the shapes are carved around them
 * by the scene in src/water/scenes.ts.
 */

export function Tributaries({ repos }: { repos: SiteMetrics['mergedPrs']['byRepo'] }) {
  return (
    <div className="feat feat-trib" data-bed="feat:tributaries">
      <ul className="tribs">
        {repos.map((r, i) => (
          <li key={r.repo} className="trib" data-bed={`trib:${i}`} data-n={r.count}>
            <a className="trib-repo mono" href={r.url} target="_blank" rel="noopener noreferrer">
              {r.repo.split('/')[1]}
            </a>
            <span className="trib-n mono">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Basins({ models }: { models: SiteMetrics['ollama']['models'] }) {
  const max = Math.max(...models.map((x) => x.pulls), 1);
  return (
    <div className="feat feat-basins" data-bed="feat:basins">
      {models.map((x, i) => (
        <div key={x.name} className="model" style={{ '--d': Math.sqrt(x.pulls / max) } as React.CSSProperties}>
          <div className="model-disc" data-bed={`model:${i}`} data-basin />
          <a className="model-name mono" href={x.url} target="_blank" rel="noopener noreferrer">
            {x.name}
          </a>
        </div>
      ))}
    </div>
  );
}

export function Fork() {
  return (
    <div className="feat feat-fork" data-bed="feat:fork" data-active="0">
      <ProfileSwitch />
      <span className="sr-only" data-bed="branch:0" />
      <span className="sr-only" data-bed="branch:1" />
      <span className="sr-only" data-bed="branch:2" />
    </div>
  );
}
