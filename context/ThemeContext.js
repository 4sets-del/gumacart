import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS, ACTIVE_THEME } from '../constants/theme';

// Light / dark theme for the whole app. The user picks System, Light or Dark
// in Settings; "system" follows the phone's own setting.
const STORAGE_KEY = 'gumacart:themeMode';

const ThemeContext = createContext({
  mode: 'system',
  setMode: () => {},
  isDark: false,
  colors: LIGHT_COLORS,
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved); })
      .catch(() => {});
  }, []);

  const setMode = (next) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  // Plain helpers (price colors, type badges) read this; it must be set
  // before children render, so it's updated here rather than in an effect.
  // eslint-disable-next-line react-hooks/immutability
  ACTIVE_THEME.colors = colors;

  const value = useMemo(() => ({ mode, setMode, isDark, colors }), [mode, isDark, colors]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Each screen's styles are built once per palette and shared by every
// instance (e.g. hundreds of listing cards), not rebuilt per component.
const styleCache = new WeakMap(); // createStyles -> { light, dark }

function stylesFor(createStyles, colors) {
  let entry = styleCache.get(createStyles);
  if (!entry) { entry = {}; styleCache.set(createStyles, entry); }
  const key = colors.isDark ? 'dark' : 'light';
  if (!entry[key]) entry[key] = createStyles(colors);
  return entry[key];
}

// Usage in a component:
//   const { COLORS, styles } = useTheme(createStyles);
// `createStyles` is `(COLORS) => StyleSheet.create({...})`; omit it if the
// component only needs colors.
export function useTheme(createStyles) {
  const ctx = useContext(ThemeContext);
  const styles = createStyles ? stylesFor(createStyles, ctx.colors) : undefined;
  return { ...ctx, COLORS: ctx.colors, styles };
}
