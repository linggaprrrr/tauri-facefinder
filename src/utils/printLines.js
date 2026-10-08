// Print order lines — the shape AppContext.printItems holds and checkout sends:
//   { id, printType, copies, photoIds, sources, totalPrice, canSubmit }
//
// A single-slot product (a 4R of one photo) has at most ONE line per
// (photo, product); a second print of the same photo is `copies`, not a
// second line. These helpers are the only place that rule lives, so the
// editor's print stepper and the Pay page's product cards can never disagree
// about it. Multi-slot (collage/strip) lines are built by PrintAddonSelector
// and are left untouched here except where noted.
//
// The server recomputes every price from the template (transaction_service
// _resolve_print_item); totalPrice/canSubmit here only drive what the screen
// shows and which lines are sent.

export const MAX_COPIES = 20;

const isLineFor = (line, printType, photoId) =>
  line.printType === printType && line.photoIds?.length === 1 && line.photoIds[0] === photoId;

// How many prints of this photo this product has (0 = none).
export function copiesOf(lines, printType, photoId) {
  return lines.find((l) => isLineFor(l, printType, photoId))?.copies ?? 0;
}

// Set the prints of one photo for a single-slot product. 0 removes the line;
// the line keeps its id and source if it already existed.
export function setCopies(lines, { printType, photoId, source = 'original', copies, price }) {
  const n = Math.max(0, Math.min(MAX_COPIES, Math.round(copies)));
  const existing = lines.find((l) => isLineFor(l, printType, photoId));
  if (!n) return lines.filter((l) => l !== existing);
  const line = {
    id: existing?.id ?? crypto.randomUUID(),
    printType,
    copies: n,
    photoIds: [photoId],
    sources: existing?.sources ?? { [photoId]: source },
    totalPrice: n * price,
    canSubmit: true,
  };
  return existing ? lines.map((l) => (l === existing ? line : l)) : [...lines, line];
}

// "Print 4R × n" on the Pay page: n copies of EACH of the given photos.
export function setCopiesForAll(lines, { printType, photos, copies, price }) {
  return photos.reduce(
    (acc, { photoId, source }) => setCopies(acc, { printType, photoId, source, copies, price }),
    lines,
  );
}

// A new collage line pre-filled from `photos` in order (repeating if there
// are fewer photos than slots), so it is billable the moment it is added; the
// customer can still re-pick slots in PrintAddonSelector.
export function addCollage(lines, { printType, photos, slotCount, price }) {
  if (!photos.length) return lines;
  const picks = Array.from({ length: slotCount }, (_, i) => photos[i % photos.length]);
  return [...lines, {
    id: crypto.randomUUID(),
    printType,
    copies: 1,
    photoIds: picks.map((p) => p.photoId),
    sources: Object.fromEntries(picks.map((p) => [p.photoId, p.source])),
    totalPrice: price,
    canSubmit: true,
  }];
}

// Prints counted the way the order summary shows them.
export function printTotals(lines, printType) {
  const billable = lines.filter((l) => l.printType === printType && l.canSubmit);
  return {
    copies: billable.reduce((n, l) => n + (l.copies ?? 0), 0),
    price: billable.reduce((n, l) => n + (l.totalPrice ?? 0), 0),
  };
}
