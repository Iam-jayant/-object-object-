const EMAILJS_SERVICE_ID = (import.meta.env.VITE_EMAILJS_SERVICE_ID || '').trim();
const EMAILJS_TEMPLATE_ID = (import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '').trim();
const EMAILJS_PUBLIC_KEY = (import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '').trim();
const APP_URL = (import.meta.env.VITE_APP_URL || window.location.origin || '').trim();

export function isMailConfigured() {
  return Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
}

export async function sendReportEmail({
  toEmail,
  batchId,
  reason,
  reporter,
  manufacturerName,
  manufacturerWallet,
  txHash,
}) {
  if (!isMailConfigured()) {
    throw new Error('Mail service is not configured');
  }

  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: toEmail,
      batch_id: batchId,
      report_reason: reason,
      reporter_wallet: reporter,
      manufacturer_name: manufacturerName || 'Manufacturer',
      manufacturer_wallet: manufacturerWallet,
      tx_hash: txHash || '',
      verify_url: `${APP_URL.replace(/\/$/, '')}/verify`,
    },
  };

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Email send failed (${res.status})`);
  }
}
