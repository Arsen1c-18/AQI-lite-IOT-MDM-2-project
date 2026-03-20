import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { DEVICE_ID } from '../utils/constants';

export const useRealtime = (onUpdate) => {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    // Don't subscribe if Supabase isn't configured
    if (!isSupabaseConfigured() || !DEVICE_ID || DEVICE_ID === 'your-device-uuid-here') {
      return;
    }

    const channel = supabase
      .channel(`aqi_realtime_${DEVICE_ID}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'aqi_results',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload) => {
          console.log('[AQI Lite] New realtime data:', payload.new);
          onUpdateRef.current?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'device_status_logs',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        () => {
          // Refresh device online/offline status when a new log is inserted
          onUpdateRef.current?.();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AQI Lite] Realtime connected ✓');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[AQI Lite] Realtime subscription error — will rely on polling.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // intentionally empty — ref keeps onUpdate stable
};
