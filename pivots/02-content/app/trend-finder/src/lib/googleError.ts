import { t, type Key } from './i18n.ts'

// The server sends people back to /?google_error=<reason> when Google sign-in fails.
const MESSAGES: Record<string, Key> = {
  expired: 'find.google.expired',
  rejected: 'find.google.rejected',
  unverified: 'find.google.unverified',
  no_account: 'find.google.noAccount',
}

export function googleErrorMessage(search: string): string | null {
  const reason = new URLSearchParams(search).get('google_error')
  return reason && Object.prototype.hasOwnProperty.call(MESSAGES, reason) ? t(MESSAGES[reason]) : null
}
