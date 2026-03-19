import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DEVICE_ID } from '../utils/constants';

export const useRealtime = (onUpdate) => {
  useEffect(() => {
    const subscription = supabase
      .channel('aqi_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'aqi_results',
          filter: `device_id=eq.${DEVICE_ID}`
        },
        (payload) => {
          console.log('New AQI data received:', payload);
          if (onUpdate) onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [onUpdate]);
};
