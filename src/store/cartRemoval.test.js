import { describe, it, expect } from 'vitest';
import { reducer } from './AppContext';

// The bug this guards: a frame collage is priced 0 because the photos it is
// built from are paid for in the same order. Deleting those and keeping the
// collage checked the whole cart out for Rp 0.
const paid = (id) => ({ id, photo_id: `P${id}`, price: 10000 });
const frame = (id, sourceIds) => ({ id, photo_id: `P${id}`, price: 0, isComposite: true, sourceIds });

const cart = (selectedPhotos, printItems = []) => ({ selectedPhotos, printItems });
const remove = (state, id) => reducer(state, { type: 'TOGGLE_PHOTO', payload: { id } });
const total = (state) => state.selectedPhotos.reduce((n, p) => n + p.price, 0);

describe('TOGGLE_PHOTO removal', () => {
  it('drops a collage when its last source photo leaves the cart', () => {
    let s = cart([paid('a'), paid('b'), frame('f', ['a', 'b'])]);
    s = remove(s, 'a');
    s = remove(s, 'b');
    expect(s.selectedPhotos).toEqual([]);
    expect(total(s)).toBe(0);
  });

  it('keeps a photo the customer brought themselves (no sources)', () => {
    const s = remove(cart([paid('a'), frame('u', [])]), 'a');
    expect(s.selectedPhotos.map((p) => p.id)).toEqual(['u']);
  });

  it('cascades through a derivative of a derivative', () => {
    const s = remove(cart([paid('a'), frame('f', ['a']), frame('g', ['f'])]), 'a');
    expect(s.selectedPhotos).toEqual([]);
  });

  it('prunes print lines for every photo that left, from state not payload', () => {
    const s = remove(
      cart([paid('a'), frame('f', ['a'])], [{ id: 'l1', photoIds: ['Pf'] }, { id: 'l2', photoIds: ['Pz'] }]),
      'a',
    );
    expect(s.printItems.map((i) => i.id)).toEqual(['l2']);
  });

  it('still adds an unselected photo', () => {
    const s = reducer(cart([]), { type: 'TOGGLE_PHOTO', payload: paid('a') });
    expect(s.selectedPhotos.map((p) => p.id)).toEqual(['a']);
  });
});
