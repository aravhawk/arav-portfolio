'use client';

interface GridBackgroundProps {
  className?: string;
  fade?: 'none' | 'top' | 'bottom' | 'both';
  vignette?: boolean;
}

export default function GridBackground({ className = '', fade = 'none', vignette = false }: GridBackgroundProps) {
  const fadeStyles = {
    none: '',
    top: 'linear-gradient(to bottom, transparent, black 35%)',
    bottom: 'linear-gradient(to top, transparent, black 35%)',
    both: 'linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)'
  };

  const getMaskImage = () => {
    const fadeMask = fade !== 'none' ? fadeStyles[fade] : '';
    const vignetteMask = vignette ? 'radial-gradient(ellipse at center, black 40%, transparent 80%)' : '';

    if (fadeMask && vignetteMask) {
      return `${fadeMask}, ${vignetteMask}`;
    }
    return fadeMask || vignetteMask || undefined;
  };

  const maskImage = getMaskImage();

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px',
        maskImage,
        WebkitMaskImage: maskImage,
        maskComposite: vignette && fade !== 'none' ? 'intersect' : undefined,
        WebkitMaskComposite: vignette && fade !== 'none' ? 'source-in' : undefined
      }}
    />
  );
}
