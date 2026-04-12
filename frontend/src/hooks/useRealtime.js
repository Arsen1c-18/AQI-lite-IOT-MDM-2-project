import { useEffect, useRef } from 'react';
import { getDeviceId, isValidDeviceId } from '../utils/deviceSettings';

export const useRealtime = (onUpdate) => {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const DEVICE_ID = getDeviceId();
    if (!isValidDeviceId(DEVICE_ID)) return;

    const interval = setInterval(() => {
      onUpdateRef.current?.();
    }, 20 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []); // intentionally empty — ref keeps onUpdate stable
};
