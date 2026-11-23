import { useMemo } from 'react';

export default function FxBackground() {
  const flakes = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: (i * 37) % 100,
    delay: (i * 0.7) % 12,
    dur: 8 + (i % 7) * 2,
    size: 2 + (i % 3),
    opacity: 0.15 + (i % 5) * 0.08,
  })), []);
  const sparks = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i, left: (i * 53) % 100, top: (i * 29) % 100, delay: (i * 0.9) % 8, dur: 4 + (i % 4),
  })), []);

  return (
    <div className="fx-bg" aria-hidden="true">
      <div className="fx-grid" />
      <div className="fx-orb fx-orb-a" />
      <div className="fx-orb fx-orb-b" />
      <div className="fx-orb fx-orb-c" />
      <div className="fx-scanlines" />
      {flakes.map(f => (
        <span key={f.id} className="fx-flake" style={{
          left: `${f.left}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`,
          width: f.size, height: f.size, opacity: f.opacity
        }} />
      ))}
      {sparks.map(s => (
        <span key={`s${s.id}`} className="fx-spark" style={{
          left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`
        }} />
      ))}
    </div>
  );
}