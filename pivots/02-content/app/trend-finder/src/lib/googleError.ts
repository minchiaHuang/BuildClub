// The server sends people back to /?google_error=<reason> when Google sign-in fails.
const MESSAGES: Record<string, string> = {
  expired: 'The Google sign-in expired. Try again.',
  rejected: 'Google did not accept that sign-in.',
  unverified: 'Google has not verified that email.',
  no_account: 'No Remake account for that Google email.',
}

export function googleErrorMessage(search: string): string | null {
  const reason = new URLSearchParams(search).get('google_error')
  return reason && Object.prototype.hasOwnProperty.call(MESSAGES, reason) ? MESSAGES[reason] : null
}
