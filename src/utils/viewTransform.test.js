import { describe, it, expect } from 'vitest';
import { clampPan, nextView } from './viewTransform';

const W = 800, H = 600, MIN = 1, MAX = 4;
const at = (v, focal) => ({ x: (focal.x - v.x) / v.scale, y: (focal.y - v.y) / v.scale });

describe('nextView', () => {
  it('keeps the point under the cursor under the cursor', () => {
    const from = { scale: 1, x: 0, y: 0 };
    const focal = { x: 200, y: 150 };
    const to = nextView(from, 2, focal, W, H, MIN, MAX);
    expect(at(to, focal)).toEqual(at(from, focal));
  });

  it('compounds smoothly — many small steps land where one big one does', () => {
    const focal = { x: 610, y: 90 };
    let stepped = { scale: 1, x: 0, y: 0 };
    for (let i = 0; i < 20; i++) stepped = nextView(stepped, 2 ** (1 / 20), focal, W, H, MIN, MAX);
    const once = nextView({ scale: 1, x: 0, y: 0 }, 2, focal, W, H, MIN, MAX);
    expect(stepped.scale).toBeCloseTo(once.scale, 6);
    expect(stepped.x).toBeCloseTo(once.x, 6);
    expect(stepped.y).toBeCloseTo(once.y, 6);
  });

  it('clamps to the zoom range and never leaves a gap at 1:1', () => {
    expect(nextView({ scale: 1, x: 0, y: 0 }, 0.5, { x: 400, y: 300 }, W, H, MIN, MAX))
      .toEqual({ scale: 1, x: 0, y: 0 });
    expect(nextView({ scale: 1, x: 0, y: 0 }, 99, { x: 400, y: 300 }, W, H, MIN, MAX).scale).toBe(MAX);
  });

  it('never lets the artwork drift off its frame', () => {
    const v = nextView({ scale: 1, x: 0, y: 0 }, 3, { x: 0, y: 0 }, W, H, MIN, MAX);
    expect(v.x).toBeLessThanOrEqual(0);
    expect(v.x).toBeGreaterThanOrEqual(W - W * v.scale);
    expect(clampPan({ x: 500, y: 500 }, 2, W, H)).toEqual({ x: 0, y: 0 });
    expect(clampPan({ x: -9999, y: -9999 }, 2, W, H)).toEqual({ x: -W, y: -H });
  });
});
