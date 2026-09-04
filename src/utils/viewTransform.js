// Canvas view transform for the editor stage. Pure so the focal-point maths —
// the part that decides whether the picture stays put under the cursor — can
// be tested without a Konva stage.

// Hold the artwork inside its own frame: never a gap at the top/left, never a
// scroll past the bottom/right.
export function clampPan(pos, scale, w, h) {
  return {
    x: Math.min(0, Math.max(w - w * scale, pos.x)),
    y: Math.min(0, Math.max(h - h * scale, pos.y)),
  };
}

// Where the view lands when scaled by `factor` about `focal` (stage pixels).
// The point under the cursor stays under the cursor — that is the whole trick.
export function nextView(v, factor, focal, w, h, min, max) {
  const scale = Math.min(max, Math.max(min, v.scale * factor));
  const worldX = (focal.x - v.x) / v.scale;
  const worldY = (focal.y - v.y) / v.scale;
  return {
    scale,
    ...clampPan({ x: focal.x - worldX * scale, y: focal.y - worldY * scale }, scale, w, h),
  };
}
