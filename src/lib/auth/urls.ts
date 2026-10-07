function httpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function passwordRecoveryUrl(requestOrigin: string | null, siteUrl?: string): string {
  // Next.js validates Server Action Origin against Host before invoking the action.
  // Prefer that browser origin so a secondary deployment stays on its own host,
  // even when it inherits the production SITE_URL. Non-browser calls use config.
  const origin = httpOrigin(requestOrigin) ?? httpOrigin(siteUrl) ?? 'http://localhost:3000';
  return `${origin}/auth/callback?next=/account/password`;
}
