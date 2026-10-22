import * as Sentry from '@sentry/react-native';

// Crash reports from real users' phones via Sentry (https://sentry.io).
// Disabled unless EXPO_PUBLIC_SENTRY_DSN is set, and never sends reports
// while developing. No personal data (names, emails, messages) is attached.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const enabled = !!DSN && !__DEV__;

export function initCrashReporting() {
  if (!enabled) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0, // errors only, no performance tracing
  });
}

export function reportError(error, extra) {
  if (!enabled) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
