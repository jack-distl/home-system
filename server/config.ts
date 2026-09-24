import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

export const config = {
  root,
  port: Number(process.env.PORT ?? 3000),
  timeZone: process.env.TZ || 'Australia/Perth',
  dataDir: path.resolve(root, process.env.DATA_DIR ?? 'data'),
  artDir: path.resolve(root, 'art'),
  webDir: path.resolve(root, 'dist/web'),
  latitude: Number(process.env.LATITUDE ?? -31.95),
  longitude: Number(process.env.LONGITUDE ?? 115.86),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/oauth/google/callback',
  },
  /** How often every account is re-synced in the background. */
  syncIntervalMs: 5 * 60 * 1000,
  /** Events are cached from this many days ago ... */
  syncPastDays: 31,
  /** ... to this many days ahead. */
  syncFutureDays: 186,
}
