import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';

// Mobile customers don't configure a kiosk device — they arrive via a QR code
// that carries the outlet context in the URL, e.g.:
//   https://app.example.com/?outlet_id=<uuid>&outlet_name=Jakarta&help=628123...
//
// This hook reads those params on load (and whenever they change) and writes
// them into deviceConfig, so the app is "configured" without the admin setup
// modal. Only `outlet_id` is required; everything else is optional.
//
// On the kiosk (no params) this is a no-op, so desktop behavior is untouched.
export function useOutletFromURL() {
  const [params] = useSearchParams();
  const { state, dispatch } = useApp();

  const outletId = params.get('outlet_id');

  useEffect(() => {
    if (!outletId) return;
    // Avoid redundant dispatches (which would re-write localStorage every render).
    if (state.deviceConfig?.outlet?.id === outletId) return;

    const config = {
      // Unit is not sent to the backend for transactions (only outlet.id is),
      // but deviceConfig requires a truthy unit to count as "configured".
      unit: {
        id: params.get('unit_id') ?? outletId,
        name: params.get('unit_name') ?? 'Mobile',
      },
      outlet: {
        id: outletId,
        name: params.get('outlet_name') ?? 'Mobile',
      },
      helpNumber: params.get('help') ?? state.deviceConfig?.helpNumber ?? '',
    };
    dispatch({ type: 'SET_DEVICE_CONFIG', payload: config });
  }, [outletId, params, state.deviceConfig, dispatch]);
}
