import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Shows a screen's mini tour once per phone: the first time the screen opens
// (after a short delay so the layout has settled). `enabled` lets a screen
// wait until its content has loaded.
export function useScreenTour(key, enabled = true) {
  const [visible, setVisible] = useState(false);
  const storageKey = `gumacart:tour:${key}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const seen = await AsyncStorage.getItem(storageKey);
        if (!seen && !cancelled) setVisible(true);
      } catch (e) {}
    }, 700);
    return () => { cancelled = true; clearTimeout(id); };
  }, [enabled, storageKey]);

  const finish = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(storageKey, '1').catch(() => {});
  }, [storageKey]);

  return [visible, finish];
}

// Settings → App Tour also resets these, so every mini tour shows again.
export function resetScreenTours() {
  return AsyncStorage.multiRemove(['create', 'product', 'productOwner', 'chat'].map((k) => `gumacart:tour:${k}`));
}
