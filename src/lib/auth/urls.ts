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

export function authCallbackUrl(path: string | null, requestUrl: string, renderUrl?: string, siteUrl?: string, publicHost?: string | null): URL {
  // Render terminates TLS at its proxy; Next may see localhost:10000 internally.
  // RENDER_EXTERNAL_URL is supplied by Render and keeps redirects on this service.
  const renderOrigin = httpOrigin(renderUrl);
  const siteOrigin = httpOrigin(siteUrl);
  // Only honor a proxy host that matches this service or its configured domain.
  // Arbitrary forwarded hosts cannot become authentication destinations.
  const matchingOrigin = [siteOrigin, renderOrigin].find(
    (candidate) => candidate && new URL(candidate).host === publicHost,
  );
  const origin = matchingOrigin ?? renderOrigin ?? httpOrigin(requestUrl);
  if (!origin) throw new Error('Missing auth callback origin');
  const destination = new URL(path && path.startsWith('/') && !path.startsWith('//') ? path : '/', origin);
  // URL parsing also treats backslashes as separators. Never allow an external next.
  return destination.origin === origin ? destination : new URL('/', origin);
}

export function passwordRecoveryUrl(requestOrigin: string | null, siteUrl?: string): string {
  // Next.js validates Server Action Origin against Host before invoking the action.
  // Prefer that browser origin so a secondary deployment stays on its own host,
  // even when it inherits the production SITE_URL. Non-browser calls use config.
  const origin = httpOrigin(requestOrigin) ?? httpOrigin(siteUrl) ?? 'http://localhost:3000';
  return `${origin}/auth/callback?next=/account/password`;
}
