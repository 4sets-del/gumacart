// Light palette. Also exported as COLORS for module-level constants that
// only use colors which are the same in both palettes (accents, badges).
export const LIGHT_COLORS = {
  // Primary green palette
  primary: '#1B6B3A',
  primaryDark: '#145530',
  primaryLight: '#2F8A50',
  primaryLighter: '#A9D8B6',
  primaryPale: '#E8F4EC',

  // Accent
  accent: '#F4A100',
  accentLight: '#FFE7A8',
  star: '#F5B923',

  // Neutrals
  white: '#FFFFFF',
  background: '#F6F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F4F2',

  // Text
  textPrimary: '#1A1D1B',
  textSecondary: '#59645C',
  textMuted: '#98A29A',
  textOnPrimary: '#FFFFFF',

  // Borders
  border: '#E6EBE7',
  borderStrong: '#C9D3CB',

  // Semantic
  success: '#1B6B3A',
  error: '#D64545',
  errorLight: '#FDECEC',
  warning: '#D9822B',
  warningLight: '#FFF3E0',
  info: '#2F6FB5',
  infoLight: '#E6F0FA',

  // Transaction type badges
  sell: '#1B6B3A',
  sellBg: '#E8F4EC',
  buy: '#2F6FB5',
  buyBg: '#E6F0FA',
  barter: '#D9822B',
  barterBg: '#FDF0E2',
  donate: '#D64545',
  donateBg: '#FDECEC',

  // Chat
  bubbleSent: '#1B6B3A',
  bubbleReceived: '#F1F4F2',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.08)',

  // Status bar icons for screens with a plain (surface-colored) header
  statusBar: 'dark-content',
  isDark: false,
};


// Dark palette: green-tinted greys (not pure black) so it still feels like
// GumaCart; a brighter green and softer text keep things readable.
export const DARK_COLORS = {
  ...LIGHT_COLORS,
  primary: '#3BAF6A',
  primaryDark: '#8FD8A8',      // used as a "brand" text color
  primaryLight: '#4CC27C',
  primaryLighter: '#2C5A3C',
  primaryPale: '#1B3325',

  accentLight: '#4A3A12',

  background: '#0E1310',
  surface: '#171D19',
  surfaceAlt: '#222A25',

  textPrimary: '#E7ECE8',
  textSecondary: '#AAB5AD',
  textMuted: '#76837A',

  border: '#29322C',
  borderStrong: '#3A453E',

  success: '#3BAF6A',
  errorLight: '#3A1F1F',
  warningLight: '#3A2C15',
  infoLight: '#172B40',

  sell: '#3BAF6A',
  sellBg: '#1B3325',
  buyBg: '#172B40',
  barterBg: '#3A2C15',
  donateBg: '#3A1F1F',

  bubbleSent: '#2E9A5A',
  bubbleReceived: '#252E28',

  overlay: 'rgba(0,0,0,0.65)',
  overlayLight: 'rgba(255,255,255,0.06)',

  statusBar: 'light-content',
  isDark: true,
};

export const COLORS = LIGHT_COLORS;

// The palette currently in use, for plain helper functions (not components)
// that pick colors at call time. Kept up to date by ThemeProvider.
export const ACTIVE_THEME = { colors: LIGHT_COLORS };

// Dark green used behind the status bar on green headers (same in both modes).
export const BRAND_DEEP = '#14532B';

// Colorful two-stop gradients for headers, banners and main buttons.
export const GRADIENTS = {
  primary: ['#1B6B3A', '#2E9A5A'],
  primaryDeep: ['#14532B', '#1F7A44'],
  sunset: ['#F59E0B', '#F97316'],
  ocean: ['#2563EB', '#0EA5E9'],
  berry: ['#7C3AED', '#C026D3'],
  rose: ['#E11D48', '#F43F5E'],
  teal: ['#0D9488', '#14B8A6'],
};

// Bright accents used to give icons and avatars their own color.
export const ACCENTS = ['#16A34A', '#F59E0B', '#2563EB', '#7C3AED', '#E11D48', '#0D9488', '#EA580C', '#DB2777'];

// Stable color for a name, so each person's avatar always gets the same color.
export function colorForName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  // Poppins (loaded in App.js) for headings, titles and prices.
  heading: 'Poppins_700Bold',
  headingHeavy: 'Poppins_800ExtraBold',
  headingSemi: 'Poppins_600SemiBold',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
};
