/** Only a reviewed HTTPS origin may produce a source-admin link. */
export function nexAdminUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return `${url.origin}/admin`;
  } catch { return null; }
}
