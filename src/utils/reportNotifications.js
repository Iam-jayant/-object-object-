const NOTIFY_API_URL = (import.meta.env.VITE_NOTIFY_API_URL || '').trim();

function requireNotifyApi() {
  if (!NOTIFY_API_URL) {
    throw new Error('VITE_NOTIFY_API_URL is not configured');
  }
  return NOTIFY_API_URL.replace(/\/$/, '');
}

export async function notifyManufacturerReport(payload) {
  const baseUrl = requireNotifyApi();
  const res = await fetch(`${baseUrl}/reports/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.error || `Notify API failed (${res.status})`);
  }

  return body;
}
