import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.05,
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies
    return event
  },
})
