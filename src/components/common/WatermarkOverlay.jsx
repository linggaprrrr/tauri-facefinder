import { useEffect, useState } from 'react';

// Moving "OWNIZE PHOTO" watermark over any unpaid preview: the editor canvas,
// print/soft-file previews, the gallery's enlarged photo. A DOM overlay, never
// drawn into the image — so canvas exports, print jobs and downloads stay
// clean, while a phone photo of the kiosk screen does not.
//
// The band jumps between a 3×3 grid of positions and its opacity pulses, so
// no single still frame shows the photo unmarked in the same place twice.
// Positions are percentages, so it fits any box; `scale` shrinks the text for
// small previews.
export default function WatermarkOverlay({ scale = 1 }) {
  const [pos, setPos] = useState({ col: 0, row: 0 });
  const [opacity, setOpacity] = useState(0.35);

  useEffect(() => {
    const iv = setInterval(() => {
      setPos({ col: Math.floor(Math.random() * 3), row: Math.floor(Math.random() * 3) });
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let t = 0;
    const iv = setInterval(() => {
      t += 0.12;
      setOpacity(0.25 + 0.15 * Math.abs(Math.sin(t)));
    }, 80);
    return () => clearInterval(iv);
  }, []);

  const offsets = [-240, -120, 0, 120, 240, 360];
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6, overflow: 'hidden' }}>
      {offsets.map((offset) => (
        <span
          key={offset}
          style={{
            position: 'absolute',
            left: `calc(${pos.col * 33.33}% + ${(20 + offset * 0.9) * scale}px)`,
            top: `calc(${pos.row * 33.33}% + ${(20 + offset * 0.5) * scale}px)`,
            transform: 'rotate(-28deg)',
            transformOrigin: '0 0',
            fontSize: 32 * scale,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            color: 'white',
            opacity,
            textShadow: '0 0 6px rgba(0,0,0,0.6)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          OWNIZE PHOTO
        </span>
      ))}
    </div>
  );
}
