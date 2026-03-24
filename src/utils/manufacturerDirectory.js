const DIRECTORY_API_URL = (import.meta.env.VITE_DIRECTORY_API_URL || '').trim();

function normalizeWallet(wallet) {
  return (wallet || '').toLowerCase();
}

function requireDirectoryApi() {
  if (!DIRECTORY_API_URL) {
    throw new Error('VITE_DIRECTORY_API_URL is not configured');
  }
  return DIRECTORY_API_URL.replace(/\/$/, '');
}

export async function upsertManufacturerContact(wallet, contact) {
  const key = normalizeWallet(wallet);
  if (!key || !contact?.email) return;
  const baseUrl = requireDirectoryApi();

  const payload = {
    wallet: key,
    email: contact.email.trim(),
    name: contact.name?.trim() || '',
    licenseNumber: contact.licenseNumber?.trim() || '',
    updatedAt: Date.now(),
  };

  const res = await fetch(`${baseUrl}/manufacturers/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Directory upsert failed (${res.status})`);
  }
}

export async function getManufacturerContact(wallet) {
  const key = normalizeWallet(wallet);
  if (!key) return null;
  const baseUrl = requireDirectoryApi();
  const res = await fetch(`${baseUrl}/manufacturers/${key}`);

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Directory lookup failed (${res.status})`);
  }

  const data = await res.json();
  return data?.email ? data : null;
}
