import { describe, it, expect } from 'vitest';
import { copiesOf, setCopies, setCopiesForAll, addCollage, printTotals, MAX_COPIES } from './printLines';

const P = 25000;

describe('print lines', () => {
  it('keeps one line per (photo, product) — more prints are copies', () => {
    let lines = setCopies([], { printType: 'primary', photoId: 'a', copies: 1, price: P });
    lines = setCopies(lines, { printType: 'primary', photoId: 'a', copies: 3, price: P });
    expect(lines).toHaveLength(1);
    expect(copiesOf(lines, 'primary', 'a')).toBe(3);
    expect(lines[0].totalPrice).toBe(3 * P);
  });

  it('removes the line at 0 and clamps to MAX_COPIES', () => {
    let lines = setCopies([], { printType: 'primary', photoId: 'a', copies: 99, price: P });
    expect(lines[0].copies).toBe(MAX_COPIES);
    lines = setCopies(lines, { printType: 'primary', photoId: 'a', copies: 0, price: P });
    expect(lines).toEqual([]);
  });

  it('keeps the line id (and source) when copies change', () => {
    const one = setCopies([], { printType: 'primary', photoId: 'a', source: 'edited', copies: 1, price: P });
    const two = setCopies(one, { printType: 'primary', photoId: 'a', source: 'original', copies: 2, price: P });
    expect(two[0].id).toBe(one[0].id);
    expect(two[0].sources).toEqual({ a: 'edited' });
  });

  it('Print 4R × 2 with three photos = 2 of each, and leaves other products alone', () => {
    const strip = addCollage([], { printType: 'secondary', photos: [{ photoId: 'a', source: 'original' }], slotCount: 3, price: 20000 });
    const lines = setCopiesForAll(strip, {
      printType: 'primary',
      photos: ['a', 'b', 'c'].map((photoId) => ({ photoId, source: 'original' })),
      copies: 2,
      price: P,
    });
    expect(printTotals(lines, 'primary')).toEqual({ copies: 6, price: 6 * P });
    expect(printTotals(lines, 'secondary')).toEqual({ copies: 1, price: 20000 });
  });

  it('a collage line is billable at once, repeating photos to fill its slots', () => {
    const [line] = addCollage([], { printType: 'secondary', photos: [{ photoId: 'a', source: 'original' }, { photoId: 'b', source: 'edited' }], slotCount: 3, price: 20000 });
    expect(line.photoIds).toEqual(['a', 'b', 'a']);
    expect(line.canSubmit).toBe(true);
    expect(copiesOf([line], 'secondary', 'a')).toBe(0); // collage lines are not per-photo copies
  });
});
