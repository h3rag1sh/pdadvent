import { useMemo } from 'react';

const COLORS = ['#00F5D4', '#FF007F', '#7B2CBF', '#FFFFFF', '#E0E0E0'];

export default function ConfettiBurst({ rarity = 'rare' }) {
  const pieces = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    const dist = 80 + (i * 17 % 160);
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 40,
      r: (i * 47) % 360,
      c: COLORS[i % COLORS.length],
      d: (i % 5) * 0.03,
      w: 6 + (i % 4) * 3,
      h: 4 + (i % 3) * 3,
    };
  }), []);

  return (
    <div className={`confetti confetti-${rarity}`}>
      {pieces.map(p => (
        <span key={p.id} className="confetti-piece" style={{
          '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, '--d': `${p.d}s`,
          background: p.c, width: p.w, height: p.h,
          boxShadow: `0 0 8px ${p.c}`
        }} />
      ))}
      <div className="confetti-ring" />
    </div>
  );
}