import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import type { TrackableActivityKind } from '@engie/shared';
import { api, getCurrentToken } from './config';

/** Tell the API the customer did something it can't see on its own (staff get it live). Fire and forget. */
export function trackActivity(kind: TrackableActivityKind) {
  if (!getCurrentToken()) return;
  api.trackActivity({ kind }).catch(() => {
    // tracking is best effort
  });
}

/** Report a screen view each time the screen gains focus (the API drops quick repeats). */
export function useTrackView(kind: TrackableActivityKind) {
  useFocusEffect(
    useCallback(() => {
      trackActivity(kind);
    }, [kind]),
  );
}
