import { useState } from 'react';
import { getUnits, getOutletsByUnit } from '../../api/mockApi';
import { useApp } from '../../store/AppContext';

const DEVICE_KEY = import.meta.env.VITE_DEVICE_KEY ?? '';

// forced=true: no close button, no backdrop dismiss, skip auth step (first-run setup)
export default function SettingsModal({ onClose, forced = false }) {
  const { state, dispatch } = useApp();

  // Skip auth on first-run forced setup; require it when admin manually opens settings
  const [step, setStep] = useState(forced ? 'config' : 'auth');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [units, setUnits] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(state.deviceConfig.unit);
  const [selectedOutlet, setSelectedOutlet] = useState(state.deviceConfig.outlet);
  const [helpNumber, setHelpNumber] = useState(state.deviceConfig.helpNumber ?? '');

  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load units when config step first mounts
  useState(() => {
    if (forced) fetchUnits();
  });

  function handleAuth(e) {
    e.preventDefault();
    if (password === DEVICE_KEY) {
      setStep('config');
      fetchUnits();
    } else {
      setAuthError('Kode perangkat salah.');
    }
  }

  async function fetchUnits() {
    setLoadingUnits(true);
    setError('');
    try {
      const data = await getUnits();
      setUnits(data);
      if (selectedUnit) fetchOutlets(selectedUnit.id);
    } catch {
      setError('Gagal memuat daftar unit.');
    } finally {
      setLoadingUnits(false);
    }
  }

  async function fetchOutlets(unitId) {
    setLoadingOutlets(true);
    setOutlets([]);
    setError('');
    try {
      const data = await getOutletsByUnit(unitId);
      setOutlets(data);
    } catch {
      setError('Gagal memuat daftar outlet.');
    } finally {
      setLoadingOutlets(false);
    }
  }

  function handleUnitChange(e) {
    const unit = units.find((u) => u.id === e.target.value) ?? null;
    setSelectedUnit(unit);
    setSelectedOutlet(null);
    if (unit) fetchOutlets(unit.id);
  }

  function handleOutletChange(e) {
    const outlet = outlets.find((o) => o.id === e.target.value) ?? null;
    setSelectedOutlet(outlet);
  }

  async function handleSave() {
    if (!selectedUnit || !selectedOutlet) return;
    setSaving(true);
    dispatch({ type: 'SET_DEVICE_CONFIG', payload: { unit: selectedUnit, outlet: selectedOutlet, helpNumber } });
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setSaved(true);
    setTimeout(() => onClose(), 800);
  }

  const canSave = selectedUnit && selectedOutlet && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (!forced && e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl"
        style={{ background: '#fff' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          <span className="font-bold text-xl">
            {forced ? 'Konfigurasi Awal Perangkat' : 'Pengaturan Perangkat'}
          </span>
          {!forced && (
            <button
              onClick={onClose}
              className="text-white opacity-70 hover:opacity-100 text-2xl leading-none"
              aria-label="Tutup"
            >
              ×
            </button>
          )}
        </div>

        {forced && (
          <div
            className="px-6 pt-4 text-sm"
            style={{ color: 'var(--color-neutral-600)' }}
          >
            Pilih unit dan outlet untuk memulai menggunakan aplikasi.
          </div>
        )}

        <div className="px-6 py-6">
          {/* ── Step 1: Auth ── */}
          {step === 'auth' && (
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>
                Masukkan kode perangkat untuk membuka pengaturan.
              </p>
              <input
                type="password"
                placeholder="Kode perangkat"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                autoFocus
                autoComplete="off"
                className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2"
                style={{
                  borderColor: authError ? 'var(--color-error)' : 'var(--color-neutral-300)',
                  '--tw-ring-color': 'var(--color-primary)',
                }}
              />
              {authError && (
                <p className="text-sm" style={{ color: 'var(--color-error)' }}>{authError}</p>
              )}
              <button
                type="submit"
                className="btn-primary w-full py-3 rounded-lg font-semibold text-base"
              >
                Buka Pengaturan
              </button>
            </form>
          )}

          {/* ── Step 2: Config ── */}
          {step === 'config' && (
            <div className="flex flex-col gap-5">
              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--color-error-50)', color: 'var(--color-error)' }}>
                  {error}
                </p>
              )}

              {/* Unit selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                  Unit
                </label>
                {loadingUnits ? (
                  <div className="text-sm py-2" style={{ color: 'var(--color-neutral-400)' }}>Memuat unit…</div>
                ) : (
                  <select
                    value={selectedUnit?.id ?? ''}
                    onChange={handleUnitChange}
                    className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2"
                    style={{
                      borderColor: 'var(--color-neutral-300)',
                      '--tw-ring-color': 'var(--color-primary)',
                    }}
                  >
                    <option value="">— Pilih Unit —</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}
                {selectedUnit && (
                  <p className="text-xs" style={{ color: 'var(--color-neutral-500)' }}>{selectedUnit.location}</p>
                )}
              </div>

              {/* Outlet selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                  Outlet
                </label>
                {loadingOutlets ? (
                  <div className="text-sm py-2" style={{ color: 'var(--color-neutral-400)' }}>Memuat outlet…</div>
                ) : (
                  <select
                    value={selectedOutlet?.id ?? ''}
                    onChange={handleOutletChange}
                    disabled={!selectedUnit || outlets.length === 0}
                    className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2 disabled:opacity-50"
                    style={{
                      borderColor: 'var(--color-neutral-300)',
                      '--tw-ring-color': 'var(--color-primary)',
                    }}
                  >
                    <option value="">
                      {!selectedUnit ? '— Pilih unit dahulu —' : outlets.length === 0 ? '— Tidak ada outlet —' : '— Pilih Outlet —'}
                    </option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Help number */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                  Nomor Bantuan / Pengaduan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 0811-2345-6789"
                  value={helpNumber}
                  onChange={(e) => setHelpNumber(e.target.value)}
                  className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--color-neutral-300)',
                    '--tw-ring-color': 'var(--color-primary)',
                  }}
                />
              </div>

              {/* Current saved info (only when editing, not forced) */}
              {!forced && state.deviceConfig.unit && state.deviceConfig.outlet && (
                <div
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                >
                  Tersimpan: <strong>{state.deviceConfig.unit.name}</strong> / <strong>{state.deviceConfig.outlet.name}</strong>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={!canSave}
                className="btn-primary w-full py-3 rounded-lg font-semibold text-base disabled:opacity-50"
              >
                {saved ? 'Tersimpan ✓' : saving ? 'Menyimpan…' : 'Simpan Konfigurasi'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
