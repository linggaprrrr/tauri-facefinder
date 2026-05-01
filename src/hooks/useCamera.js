import { useRef, useCallback } from 'react';

// Thin wrapper around react-webcam's ref API.
export function useCamera() {
  const webcamRef = useRef(null);

  // Returns a base64 PNG screenshot or null if camera isn't ready
  const capture = useCallback(() => {
    if (!webcamRef.current) return null;
    return webcamRef.current.getScreenshot();
  }, []);

  return { webcamRef, capture };
}
