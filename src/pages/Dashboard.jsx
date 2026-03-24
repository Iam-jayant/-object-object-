import { useState, useEffect } from 'react';
import {
  Building2, PackagePlus, QrCode, Upload, CheckCircle, AlertCircle,
  Loader2, Download, X, MapPin, History, RefreshCw,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/i18nContext';
import WalletConnect from '../components/WalletConnect';
import { getWriteContract, getReadContract } from '../utils/contract';
import { uploadJSONToIPFS, uploadMultipleToIPFS, getIPFSUrl } from '../utils/ipfs';
import { generateQR } from '../utils/qr';
import { sendRecallNotification, isPushConfigured } from '../utils/push';
import { fetchManufacturerBatches, isGraphConfigured } from '../utils/graph';
import { upsertManufacturerContact } from '../utils/manufacturerDirectory';
import { BrowserProvider } from 'ethers';

const MANUFACTURER_BATCH_CACHE_KEY = 'mediproof_manufacturer_batches_v1';

function readBatchCache(account) {
  if (!account) return [];
  try {
    const raw = localStorage.getItem(MANUFACTURER_BATCH_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const items = parsed[account.toLowerCase()] || [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function storeBatchInCache(account, batchId) {
  if (!account || !batchId) return;
  try {
    const key = account.toLowerCase();
    const raw = localStorage.getItem(MANUFACTURER_BATCH_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const existing = Array.isArray(parsed[key]) ? parsed[key] : [];
    parsed[key] = [batchId, ...existing.filter((id) => id !== batchId)].slice(0, 50);
    localStorage.setItem(MANUFACTURER_BATCH_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Cache is best-effort only.
  }
}

async function fetchBatchMetadata(ipfsHash) {
  if (!ipfsHash) return null;
  try {
    const res = await fetch(getIPFSUrl(ipfsHash));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const current = idx;
      idx += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── Reusable alert ────────────────────────────────────────────────────────

function StatusAlert({ type, message }) {
  if (!message) return null;
  const styles = {
    error:   'bg-danger/10 border-danger/30 text-danger',
    success: 'bg-success/10 border-success/30 text-success',
    info:    'bg-primary-500/10 border-primary-500/20 text-primary-300',
  };
  const Icon = type === 'error' ? AlertCircle : CheckCircle;
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${styles[type]}`}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function formatDateFromSeconds(seconds) {
  const ts = Number(seconds || 0) * 1000;
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function BatchStatusBadge({ batch }) {
  const { t } = useI18n();
  if (batch.isRecalled) {
    return <span className="badge-recalled text-xs">{t('status_recalled')}</span>;
  }
  if (batch.isExpired && batch.isSuspicious) {
    return <span className="badge-recalled text-xs">{t('status_exp_sus')}</span>;
  }
  if (batch.isExpired) {
    return <span className="badge-expired text-xs">{t('status_expired')}</span>;
  }
  if (batch.isSuspicious) {
    return <span className="badge-expired text-xs">{t('status_suspicious')}</span>;
  }
  return <span className="badge-valid text-xs">{t('status_valid')}</span>;
}

function ManufacturerHistory({ account, refreshKey, onSelectBatch }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [batches, setBatches] = useState([]);

  async function loadFromChain() {
    const contract = getReadContract();
    const cachedIds = readBatchCache(account);

    // Avoid eth_getLogs scans on constrained RPC endpoints (can return HTTP 413).
    // History in chain-fallback mode is sourced from local cache + direct contract reads.
    const batchIds = [...new Set(cachedIds)].slice(0, 25);

    if (batchIds.length === 0) {
      const mfr = await contract.getManufacturer(account).catch(() => null);
      setProfile({
        name: mfr?.name || t('dashboard_manufacturer_fallback'),
        licenseNumber: mfr?.licenseNumber || '—',
        registeredAt: Number(mfr?.registeredAt || 0),
        totalBatches: 0,
      });
      setBatches([]);
      return;
    }

    const rows = await mapWithConcurrency(batchIds, 4, async (batchId) => {
        const batchState = await contract.getBatch(batchId).catch(() => null);
        const ipfsHash = batchState?.ipfsHash || '';
        const expiryDate = Number(batchState?.expiryDate || 0);
        const createdAt = Number(batchState?.createdAt || 0);

        const reportCountRaw = await contract.reportCount(batchId).catch(() => 0n);

        const reportCount = Number(reportCountRaw || 0);
        const isRecalled = Boolean(batchState?.isRecalled);
        const isExpired = expiryDate > 0 && expiryDate * 1000 < Date.now();
        const isSuspicious = reportCount >= 3;
        const metadata = await fetchBatchMetadata(ipfsHash);

        return {
          id: batchId,
          createdAt,
          expiryDate,
          ipfsHash,
          metadata,
          reportCount,
          isRecalled,
          isSuspicious,
          isExpired,
        };
      });

    const mfr = await contract.getManufacturer(account).catch(() => null);

    setProfile({
      name: mfr?.name || 'Manufacturer',
      licenseNumber: mfr?.licenseNumber || '—',
      registeredAt: Number(mfr?.registeredAt || 0),
      totalBatches: rows.length,
    });
    setBatches(rows);
  }

  async function loadFromGraph() {
    const mfr = await fetchManufacturerBatches(account, 25);
    if (!mfr) {
      setProfile(null);
      setBatches([]);
      return;
    }

    const normalized = (mfr.batches || []).map((batch) => {
      const expiryDate = Number(batch.expiryDate || 0);
      const createdAt = Number(batch.createdAt || 0);
      const reportCount = Number(batch.reportCount || 0);

      return {
        id: batch.id,
        createdAt,
        expiryDate,
        ipfsHash: batch.ipfsHash || '',
        reportCount,
        isRecalled: Boolean(batch.isRecalled),
        isSuspicious: Boolean(batch.isSuspicious),
        isExpired: expiryDate > 0 && expiryDate * 1000 < Date.now(),
      };
    });

    const withMeta = await mapWithConcurrency(normalized, 6, async (batch) => ({
      ...batch,
      metadata: await fetchBatchMetadata(batch.ipfsHash),
    }));

    setProfile({
      name: mfr.name || t('dashboard_manufacturer_fallback'),
      licenseNumber: mfr.licenseNumber || '—',
      registeredAt: Number(mfr.registeredAt || 0),
      totalBatches: Number(mfr.totalBatches || normalized.length),
    });
    setBatches(withMeta);
  }

  async function loadHistory() {
    if (!account) return;
    setLoading(true);
    setError('');
    try {
      if (isGraphConfigured()) {
        try {
          await loadFromGraph();
        } catch {
          await loadFromChain();
        }
      } else {
        await loadFromChain();
      }
    } catch (err) {
      setError(err?.message || t('dashboard_history_load_error'));
      setProfile(null);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, refreshKey]);

  const recalledCount = batches.filter((b) => b.isRecalled).length;
  const suspiciousCount = batches.filter((b) => b.isSuspicious).length;

  return (
    <div className="card space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <History size={18} className="text-primary-600" /> {t('dashboard_batch_history_title')}
          </h2>
          <p className="text-xs text-surface-600 mt-0.5">
            {t('dashboard_batch_history_sub')}
          </p>
        </div>
        <button type="button" onClick={loadHistory} className="btn-secondary" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {t('refresh')}
        </button>
      </div>

      {profile && (
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="card-sm">
            <p className="text-xs text-surface-600 mb-1">{t('dashboard_manufacturer_label')}</p>
            <p className="text-sm font-semibold text-surface-900 truncate">{profile.name}</p>
            <p className="text-xs text-surface-700 font-mono truncate mt-0.5">{profile.licenseNumber}</p>
          </div>
          <div className="card-sm">
            <p className="text-xs text-surface-600 mb-1">{t('dashboard_registered_on')}</p>
            <p className="text-sm font-semibold text-surface-900">{formatDateFromSeconds(profile.registeredAt)}</p>
          </div>
          <div className="card-sm">
            <p className="text-xs text-surface-600 mb-1">{t('dashboard_total_batches')}</p>
            <p className="text-sm font-semibold text-surface-900">{profile.totalBatches}</p>
          </div>
          <div className="card-sm">
            <p className="text-xs text-surface-600 mb-1">{t('dashboard_flags')}</p>
            <p className="text-sm font-semibold text-surface-900">{t('dashboard_flags_summary', { recalled: String(recalledCount), suspicious: String(suspiciousCount) })}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-surface-600 text-sm py-3">
          <Loader2 size={16} className="animate-spin" /> {t('dashboard_loading_history')}
        </div>
      ) : error ? (
        <StatusAlert type="error" message={error} />
      ) : batches.length === 0 ? (
        <div className="card-sm text-sm text-surface-700">
          {t('dashboard_empty_history')}
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map((batch) => (
            <div key={batch.id} className="card-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm text-primary-700 truncate">{batch.id}</p>
                <p className="text-xs text-surface-600 mt-0.5">
                  {t('dashboard_registered')}: {formatDateFromSeconds(batch.createdAt)} · {t('dashboard_expiry')}: {formatDateFromSeconds(batch.expiryDate)}
                </p>
                <p className="text-xs text-surface-600 mt-1">{t('dashboard_reports')}: {batch.reportCount}</p>
                {batch.metadata && (
                  <p className="text-xs text-surface-600 mt-1">
                    IPFS: {Array.isArray(batch.metadata.images) ? batch.metadata.images.length : 0} {t('dashboard_images_suffix')}
                    {batch.metadata.registeredAt ? ` · ${t('dashboard_meta_time')}: ${new Date(Number(batch.metadata.registeredAt)).toLocaleDateString('en-IN')}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <BatchStatusBadge batch={batch} />
                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => onSelectBatch(batch.id)}>
                  {t('dashboard_use_for_checkpoint')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Register Manufacturer ────────────────────────────────────────────────

function RegisterManufacturer({ onRegistered }) {
  const { t } = useI18n();
  const { account } = useWallet();
  const [name, setName]       = useState('');
  const [license, setLicense] = useState('');
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState(null);

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setStatus({ type: 'error', message: t('dashboard_error_invalid_email') });
      return;
    }

    setLoading(true); setStatus(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.registerManufacturer(name.trim(), license.trim());
      setStatus({ type: 'info', message: t('dashboard_tx_submitted_wait') });
      await tx.wait();

      let contactWarning = '';
      try {
        await upsertManufacturerContact(account, {
          email: email.trim(),
          name: name.trim(),
          licenseNumber: license.trim(),
        });
      } catch (contactErr) {
        contactWarning = contactErr?.message || 'Contact directory sync failed.';
      }

      setStatus({
        type: 'success',
        message: contactWarning
          ? t('dashboard_registered_with_warning', { warning: contactWarning })
          : t('dashboard_registered_success'),
      });
      onRegistered();
    } catch (err) {
      const msg = err?.reason || err?.message || 'Transaction failed';
      setStatus({ type: 'error', message: msg.includes('AlreadyRegistered') ? t('dashboard_already_registered') : msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-primary-600/10 border border-primary-500/20 rounded-lg flex items-center justify-center">
          <Building2 size={18} className="text-primary-400" />
        </div>
        <div>
          <h2 className="font-semibold text-surface-900">{t('register_mfr')}</h2>
          <p className="text-xs text-surface-500">{t('dashboard_register_once_hint')}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('dashboard_company_name')}</label>
          <input className="input" placeholder="e.g. PharmaCorp Ltd." value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t('dashboard_license_number')}</label>
          <input className="input" placeholder="e.g. MFG-2024-001892" value={license} onChange={e => setLicense(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t('dashboard_manufacturer_email')}</label>
          <input
            type="email"
            className="input"
            placeholder="e.g. qa@pharmacorp.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <p className="text-xs text-surface-600 mt-1">{t('dashboard_email_usage_hint')}</p>
        </div>
        <StatusAlert {...(status || {})} />
        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? <><Loader2 size={16} className="animate-spin" /> {t('dashboard_registering')}</> : t('register_mfr')}
        </button>
      </form>
    </div>
  );
}

// ─── Register Batch ───────────────────────────────────────────────────────

function RegisterBatch({ onBatchRegistered, onClose }) {
  const { t } = useI18n();
  const { account } = useWallet();
  const [batchId, setBatchId] = useState('');
  const [expiry, setExpiry]   = useState('');
  const [files, setFiles]     = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState(null);

  function handleFiles(e) {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    setPreviews(selected.map(f => URL.createObjectURL(f)));
  }
  function removeFile(i) {
    setFiles(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setStatus(null);
    try {
      let imageHashes = [];
      if (files.length > 0) {
        setStatus({ type: 'info', message: t('dashboard_uploading_images') });
        imageHashes = await uploadMultipleToIPFS(files);
      }
      setStatus({ type: 'info', message: t('dashboard_uploading_metadata') });
      const expiryTimestamp = Math.floor(new Date(expiry).getTime() / 1000);
      const metaHash = await uploadJSONToIPFS({ batchId, expiryDate: expiryTimestamp, images: imageHashes, registeredAt: Date.now() });

      setStatus({ type: 'info', message: t('dashboard_submitting_tx') });
      const contract = await getWriteContract();
      const tx = await contract.registerBatch(batchId.trim(), metaHash, BigInt(expiryTimestamp));
      setStatus({ type: 'info', message: t('dashboard_waiting_confirmation') });
      await tx.wait();
      setStatus({ type: 'success', message: t('dashboard_batch_registered') });
      storeBatchInCache(account, batchId.trim());
      onBatchRegistered(batchId.trim());
      setBatchId(''); setExpiry(''); setFiles([]); setPreviews([]);
      onClose?.();
    } catch (err) {
      const msg = err?.reason || err?.message || 'Transaction failed';
      setStatus({ type: 'error', message: msg.includes('BatchAlreadyExists') ? t('dashboard_batch_exists') : msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-primary-600/10 border border-primary-500/20 rounded-lg flex items-center justify-center">
          <PackagePlus size={18} className="text-primary-400" />
        </div>
        <div>
          <h2 className="font-semibold text-surface-900">{t('register_batch')}</h2>
          <p className="text-xs text-surface-500">{t('dashboard_batch_register_hint')}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('dashboard_batch_id')}</label>
          <input className="input font-mono" placeholder="e.g. BATCH-2024-PC-001" value={batchId} onChange={e => setBatchId(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t('dashboard_expiry_date')}</label>
          <input className="input" type="date" value={expiry} min={new Date().toISOString().split('T')[0]} onChange={e => setExpiry(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t('dashboard_batch_images_optional')}</label>
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-surface-400 rounded-lg cursor-pointer hover:border-primary-500/50 transition-colors bg-surface-100">
            <Upload size={18} className="text-surface-500 mb-1" />
            <span className="text-xs text-surface-500">{t('dashboard_click_upload_images')}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          </label>
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="w-14 h-14 object-cover rounded-lg border border-surface-400" />
                  <button type="button" onClick={() => removeFile(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={9} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <StatusAlert {...(status || {})} />
        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? <><Loader2 size={16} className="animate-spin" /> {t('dashboard_processing')}</> : t('register_batch')}
        </button>
      </form>
    </div>
  );
}

function RegisterBatchModal({ open, onClose, onBatchRegistered }) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="wallet-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wallet-modal-card w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <PackagePlus size={18} className="text-primary-500" /> {t('dashboard_register_new_batch')}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost px-2 py-1">
            <X size={16} />
          </button>
        </div>
        <RegisterBatch onBatchRegistered={onBatchRegistered} onClose={onClose} />
      </div>
    </div>
  );
}

// ─── Add Checkpoint ───────────────────────────────────────────────────────

function AddCheckpoint({ batchId }) {
  const { t } = useI18n();
  const [location, setLocation] = useState('');
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setStatus(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.addCheckpoint(batchId, location.trim(), note.trim());
      setStatus({ type: 'info', message: t('dashboard_tx_submitted') });
      await tx.wait();
      setStatus({ type: 'success', message: t('dashboard_checkpoint_added') });
      setLocation(''); setNote('');
    } catch (err) {
      const msg = err?.reason || err?.message || 'Transaction failed';
      setStatus({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-primary-600/10 border border-primary-500/20 rounded-lg flex items-center justify-center">
          <MapPin size={18} className="text-primary-400" />
        </div>
        <div>
          <h2 className="font-semibold text-surface-900">{t('checkpoint_add')}</h2>
          <p className="text-xs text-surface-500 font-mono">{batchId}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('checkpoint_location')}</label>
          <input className="input" placeholder="e.g. Mumbai Warehouse, Transit Hub Delhi…" value={location} onChange={e => setLocation(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t('checkpoint_note')} ({t('dashboard_optional')})</label>
          <input className="input" placeholder="e.g. Quality inspection passed" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <StatusAlert {...(status || {})} />
        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? <><Loader2 size={16} className="animate-spin" /> {t('dashboard_adding')}</> : <><MapPin size={15} /> {t('checkpoint_submit')}</>}
        </button>
      </form>
    </div>
  );
}

// ─── QR Display ──────────────────────────────────────────────────────────

function QRDisplay({ batchId }) {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    if (!batchId) return;
    generateQR(batchId).then(setQrDataUrl);
  }, [batchId]);

  // Recall with Push notification
  const { account } = useWallet();
  const [recalling, setRecalling] = useState(false);
  const [recallStatus, setRecallStatus] = useState(null);

  async function handleRecall() {
    if (!window.confirm(t('dashboard_recall_confirm', { batchId }))) return;
    setRecalling(true); setRecallStatus(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.recallBatch(batchId);
      setRecallStatus({ type: 'info', message: t('dashboard_recall_submitted') });
      await tx.wait();

      // Send Push notification (if configured)
      if (isPushConfigured()) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const signer   = await provider.getSigner();
          await sendRecallNotification(signer, { batchId, manufacturer: account });
        } catch { /* non-fatal */ }
      }
      setRecallStatus({ type: 'success', message: t('dashboard_recall_success') });
    } catch (err) {
      const msg = err?.reason || err?.message || '';
      setRecallStatus({ type: 'error', message: msg.includes('AlreadyRecalled') ? t('dashboard_recall_already') : msg });
    } finally {
      setRecalling(false);
    }
  }

  if (!batchId || !qrDataUrl) return null;

  function download() {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `mediproof-${batchId}.png`;
    a.click();
  }

  return (
    <div className="card text-center animate-fade-in space-y-4">
      <div className="flex items-center gap-3 justify-center">
        <div className="w-9 h-9 bg-primary-600/10 border border-primary-500/20 rounded-lg flex items-center justify-center">
          <QrCode size={18} className="text-primary-400" />
        </div>
        <h2 className="font-semibold text-surface-900">{t('dashboard_qr_generated')}</h2>
      </div>
      <div className="inline-block p-4 bg-white rounded-2xl border border-surface-300 shadow-sm">
        <img src={qrDataUrl} alt={`QR for ${batchId}`} className="w-44 h-44 bg-white rounded-md" />
      </div>
      <p className="font-mono text-primary-700 text-sm bg-primary-50 rounded-lg px-3 py-2 inline-block border border-primary-200">{batchId}</p>
      <div className="flex gap-2 justify-center flex-wrap">
        <button onClick={download} className="btn-secondary">
          <Download size={15} /> {t('download_qr')}
        </button>
        <button onClick={handleRecall} disabled={recalling} className="btn-danger">
          {recalling ? <Loader2 size={15} className="animate-spin" /> : t('dashboard_recall_batch')}
        </button>
      </div>
      {recallStatus && <div className="text-left"><StatusAlert {...recallStatus} /></div>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────

export default function Dashboard() {
  const { account } = useWallet();
  const { t } = useI18n();
  const [isRegistered, setIsRegistered] = useState(false);
  const [checking, setChecking]         = useState(false);
  const [lastBatch, setLastBatch]       = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  useEffect(() => {
    if (!account) { setIsRegistered(false); return; }
    setChecking(true);
    getReadContract()
      .isManufacturer(account)
      .then(setIsRegistered)
      .catch(() => setIsRegistered(false))
      .finally(() => setChecking(false));
  }, [account]);

  if (!account) {
    return (
      <div className="w-full xl:w-[75%] mx-auto px-6 py-24 text-center">
        <div className="w-14 h-14 bg-primary-600/10 border border-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Building2 size={28} className="text-primary-400" />
        </div>
        <h1 className="section-title mb-3">{t('dash_title')}</h1>
        <p className="text-surface-400 mb-6">{t('dash_sub')}</p>
        <WalletConnect />
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-surface-400">
        <Loader2 size={20} className="animate-spin" />
        <span>{t('dashboard_checking_status')}</span>
      </div>
    );
  }

  return (
    <div className="w-full xl:w-[75%] mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="section-title mb-1">{t('dash_title')}</h1>
        <p className="text-surface-400 text-sm">{t('dash_sub')}</p>
      </div>

      <div className="space-y-6">
        {!isRegistered ? (
          <RegisterManufacturer onRegistered={() => setIsRegistered(true)} />
        ) : (
          <>
            <div className="card-sm flex items-center gap-2 border-success/20 bg-success/5">
              <CheckCircle size={16} className="text-success" />
              <span className="text-sm text-success font-medium">{t('dashboard_account_verified')}</span>
            </div>

            <div className="card-sm flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-surface-900">{t('dashboard_batch_operations_title')}</p>
                <p className="text-xs text-surface-600">{t('dashboard_batch_operations_sub')}</p>
              </div>
              <button type="button" className="btn-primary" onClick={() => setBatchModalOpen(true)}>
                <PackagePlus size={16} /> {t('dashboard_new_register_batch')}
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <div className="space-y-6 lg:col-span-2">
                {lastBatch ? (
                  <div className="grid lg:grid-cols-2 gap-6 items-start">
                    <QRDisplay batchId={lastBatch} />
                    <AddCheckpoint batchId={lastBatch} />
                  </div>
                ) : (
                  <div className="card-sm text-sm text-surface-700">
                    {t('dashboard_select_batch_hint')}
                  </div>
                )}
              </div>
            </div>

            <ManufacturerHistory
              account={account}
              refreshKey={historyRefreshKey}
              onSelectBatch={(id) => setLastBatch(id)}
            />

            <RegisterBatchModal
              open={batchModalOpen}
              onClose={() => setBatchModalOpen(false)}
              onBatchRegistered={(id) => {
                setLastBatch(id);
                setHistoryRefreshKey((n) => n + 1);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
