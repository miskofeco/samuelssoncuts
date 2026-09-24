// Only browser-managed push services are valid delivery destinations. This is
// checked both when accepting a subscription and immediately before delivery:
// authenticated users can also write their own subscription rows through the
// Supabase Data API, and old rows may predate validation.
const PUSH_ENDPOINT = /^https:\/\/(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)+push\.apple\.com)\/[^?#\s]+$/;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (!endpoint || endpoint.length > 4096 || /[\u0000-\u001f\u007f]/.test(endpoint)
    || !PUSH_ENDPOINT.test(endpoint)) {
    return false;
  }

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:"
      && url.port === ""
      && !url.username
      && !url.password
      && url.pathname.length > 1;
  } catch {
    return false;
  }
}
