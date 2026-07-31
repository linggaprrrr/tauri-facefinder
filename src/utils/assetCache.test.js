import { describe, it, expect, beforeEach } from 'vitest';
import { clearAssetCache, writeCache, readCache } from './assetCache';

beforeEach(() => { globalThis.localStorage = (() => {
  let s = {};
  return { getItem: k => s[k] ?? null, setItem: (k,v) => { s[k] = String(v); },
           removeItem: k => { delete s[k]; }, get length(){ return Object.keys(s).length; },
           key: i => Object.keys(s)[i], _dump: () => ({...s}) };
})(); });

describe('clearAssetCache', () => {
  it('clears every ff_asset_* key but keeps device identity', () => {
    writeCache('branding_o1', { a: 1 });
    writeCache('stickers_o1', [1]);
    writeCache('print_templates_o1', [2]);
    localStorage.setItem('deviceConfig', '{"outlet":{"id":"o1"}}');
    localStorage.setItem('ff_kiosk_id', 'kiosk-123');
    localStorage.setItem('lang', 'id');
    localStorage.setItem('ff_pin_offline', '{"digest":"x"}');

    const removed = clearAssetCache();

    expect(removed).toBe(3);
    expect(readCache('branding_o1')).toBe(null);
    expect(readCache('stickers_o1')).toBe(null);
    // The whole point: syncing content must not re-trigger first-run setup.
    expect(localStorage.getItem('deviceConfig')).toBe('{"outlet":{"id":"o1"}}');
    expect(localStorage.getItem('ff_kiosk_id')).toBe('kiosk-123');
    expect(localStorage.getItem('lang')).toBe('id');
    expect(localStorage.getItem('ff_pin_offline')).toBe('{"digest":"x"}');
  });
});
