import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies
    if (event.user) {
      event.user = { id: event.user.id }
    }
    return event
  },
  ignoreErrors: [
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    'AbortError',
    /ResizeObserver loop/,
  ],
})
