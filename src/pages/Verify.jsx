import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScanLine, Search, CheckCircle, AlertTriangle, XCircle, Loader2,
  Building2, Calendar, Package, Flag, Image as ImageIcon,
  ChevronRight, ShieldAlert, Clock, Mic, MicOff, MapPin,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/i18nContext';
import WalletConnect from '../components/WalletConnect';
import CheckpointTimeline from '../components/CheckpointTimeline';
import { getReadContract, getWriteContract } from '../utils/contract';
import { getIPFSUrl } from '../utils/ipfs';
import { scanQRFromImageData } from '../utils/qr';
import { createVoiceRecognizer, isVoiceSupported } from '../utils/voice';
import { notifyManufacturerReport } from '../utils/reportNotifications';

const SUSPICIOUS_THRESHOLD = 3;

// ─── Status helpers ───────────────────────────────────────────────────────

function deriveBatchStatus(batch, reportCount, t) {
  const expired    = Number(batch.expiryDate) * 1000 < Date.now();
  const recalled   = batch.isRecalled;
  const suspicious = Number(reportCount) >= SUSPICIOUS_THRESHOLD;

  if (recalled)             return { key: 'recalled',    label: t('status_recalled'),    badgeClass: 'badge-recalled', Icon: XCircle,     description: t('status_recalled_d') };
  if (expired && suspicious) return { key: 'exp-sus',    label: t('status_exp_sus'),     badgeClass: 'badge-recalled', Icon: ShieldAlert,  description: t('status_exp_sus_d') };
  if (expired)              return { key: 'expired',     label: t('status_expired'),     badgeClass: 'badge-expired',  Icon: Clock,        description: t('status_expired_d') };
  if (suspicious)           return { key: 'suspicious',  label: t('status_suspicious'),  badgeClass: 'badge-expired',  Icon: ShieldAlert,  description: t('status_suspicious_d') };
  return                         { key: 'valid',         label: t('status_valid'),       badgeClass: 'badge-valid',    Icon: CheckCircle,  description: t('status_valid_d') };
}

function StatusBanner({ status }) {
  const colorMap = {
    valid:       'bg-success/5 border-success/20 text-success',
    expired:     'bg-warning/5 border-warning/20 text-warning',
    suspicious:  'bg-warning/5 border-warning/20 text-warning',
    recalled:    'bg-danger/5 border-danger/20 text-danger',
    'exp-sus':   'bg-danger/5 border-danger/20 text-danger',
  };
  const { Icon } = status;
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${colorMap[status.key]}`}>
      <Icon size={20} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-sm">{status.label}</p>
        <p className="text-xs opacity-75 mt-0.5 leading-relaxed">{status.description}</p>
      </div>
    </div>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────

function ReportModal({ batchId, onClose, onReported }) {
  const { account } = useWallet();
  const { t } = useI18n();
  const [reason, setReason]   = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function handleReport(e) {
    e.preventDefault();
    if (!account) return;
    if (!isValidEmail(reporterEmail)) {
      setError(t('verify_report_invalid_email'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const readContract = getReadContract();
      try {
        await readContract.getBatch(batchId.trim());
      } catch {
        setError(t('verify_report_unregistered_batch'));
        return;
      }

      const alreadyReported = await readContract.hasReported(batchId.trim(), account).catch(() => false);
      if (alreadyReported) {
        setError(t('verify_report_already_reported'));
        return;
      }

      const contract = await getWriteContract();
      const tx = await contract.reportBatch(batchId.trim(), reason.trim());
      await tx.wait();

      const notifyResult = await onReported?.({
        batchId: batchId.trim(),
        reason: reason.trim(),
        reporter: account,
        reporterEmail: reporterEmail.trim(),
        txHash: tx.hash,
      });

      setDeliveryStatus(notifyResult?.message || '');
      setDone(true);
    } catch (err) {
      const msg = err?.reason || err?.message || '';
      if (msg.includes('AlreadyReported') || msg.includes('already reported'))
        setError(t('verify_report_already_reported'));
      else if (msg.includes('BatchDoesNotExist') || msg.includes('does not exist'))
        setError(t('verify_report_missing_batch'));
      else if (msg.includes('user rejected'))
        setError(t('verify_report_rejected'));
      else setError(msg || t('verify_report_tx_failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-xl animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-danger/10 border border-danger/20 rounded-lg flex items-center justify-center">
            <Flag size={18} className="text-danger" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-100">{t('report_title')}</h3>
            <p className="text-xs text-surface-500 font-mono">{batchId}</p>
          </div>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-success" />
            </div>
            <p className="font-medium text-surface-100">{t('report_success')}</p>
            <button onClick={onClose} className="btn-secondary mt-5 mx-auto">{t('report_cancel')}</button>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 rounded-lg bg-surface-800/50 border border-surface-700 text-xs text-surface-400">
              <span className="text-surface-300 font-medium">{t('report_one_per_wallet')}</span>{' '}
              {t('verify_report_wallet_onchain')}
            </div>
            {!account && (
              <div className="mb-4">
                <p className="text-sm text-surface-400 mb-3">{t('verify_report_connect_wallet')}</p>
                <WalletConnect />
              </div>
            )}
            <form onSubmit={handleReport} className="space-y-4">
              <div>
                <label className="label">{t('verify_report_your_email')}</label>
                <input
                  type="email"
                  className="input"
                  placeholder={t('verify_report_email_placeholder')}
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  required
                  disabled={!account || loading}
                />
                <p className="text-xs text-surface-600 mt-1">{t('verify_report_email_hint')}</p>
              </div>
              <div>
                <label className="label">{t('report_reason')}</label>
                <textarea className="input resize-none h-24"
                  placeholder={t('verify_report_reason_placeholder')}
                  value={reason} onChange={e => setReason(e.target.value)}
                  required minLength={10} disabled={!account || loading}
                />
                <p className="text-xs text-surface-600 mt-1">{t('verify_report_min_chars')}</p>
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
                  <XCircle size={14} className="shrink-0 mt-0.5" />{error}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">{t('report_cancel')}</button>
                <button type="submit" disabled={loading || !account || reason.trim().length < 10} className="btn-danger flex-1 justify-center">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> {t('loading')}</> : <><Flag size={14} /> {t('report_submit')}</>}
                </button>
              </div>
            </form>
          </>
        )}
        {done && deliveryStatus && (
          <div className="mt-4 p-3 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-200 text-xs">
            {deliveryStatus}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Batch Info Panel ─────────────────────────────────────────────────────

function BatchInfoPanel({ batch, manufacturer, reportCount, checkpoints, checkpointLoading, onReport }) {
  const { t } = useI18n();
  const status     = deriveBatchStatus(batch, reportCount, t);
  const expiryMs   = Number(batch.expiryDate) * 1000;
  const expiryDate = new Date(expiryMs).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const createdAt  = new Date(Number(batch.createdAt) * 1000).toLocaleDateString();

  const [meta, setMeta]     = useState(null);
  const [metaLoading, setML] = useState(false);
  useEffect(() => {
    if (!batch.ipfsHash) return;
    setML(true);
    fetch(getIPFSUrl(batch.ipfsHash)).then(r => r.json()).then(setMeta).catch(() => {}).finally(() => setML(false));
  }, [batch.ipfsHash]);

  const images = meta?.images || [];

  return (
    <div className="card space-y-5 animate-slide-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-surface-500 mb-1 uppercase tracking-wider font-medium">Batch ID</p>
          <p className="font-mono text-primary-300 font-semibold text-lg">{batch.batchId}</p>
        </div>
        <span className={status.badgeClass}><status.Icon size={12} className="inline mr-1" />{status.label}</span>
      </div>

      <StatusBanner status={status} />
      <div className="divider" />

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="card-sm">
          <div className="flex items-center gap-1.5 text-surface-400 text-xs mb-2 uppercase tracking-wider font-medium"><Building2 size={11} /> Manufacturer</div>
          <p className="text-sm font-semibold text-surface-100">{manufacturer?.name || '—'}</p>
          <p className="text-xs text-surface-500 font-mono mt-0.5">{manufacturer?.licenseNumber || '—'}</p>
        </div>
        <div className="card-sm">
          <div className="flex items-center gap-1.5 text-surface-400 text-xs mb-2 uppercase tracking-wider font-medium"><Calendar size={11} /> Expiry</div>
          <p className={`text-sm font-semibold ${expiryMs < Date.now() ? 'text-warning' : 'text-surface-100'}`}>{expiryDate}</p>
          {expiryMs < Date.now() && <p className="text-xs text-warning/70 mt-0.5">Expired {Math.floor((Date.now() - expiryMs) / 86400000)}d ago</p>}
        </div>
        <div className="card-sm">
          <div className="flex items-center gap-1.5 text-surface-400 text-xs mb-2 uppercase tracking-wider font-medium"><Package size={11} /> Registered</div>
          <p className="text-sm font-semibold text-surface-100">{createdAt}</p>
        </div>
        <div className="card-sm">
          <div className="flex items-center gap-1.5 text-surface-400 text-xs mb-2 uppercase tracking-wider font-medium"><Flag size={11} /> Reports</div>
          <p className={`text-sm font-semibold ${Number(reportCount) >= SUSPICIOUS_THRESHOLD ? 'text-warning' : 'text-surface-100'}`}>
            {reportCount?.toString() || '0'}
            {Number(reportCount) >= SUSPICIOUS_THRESHOLD && <span className="ml-1.5 text-xs text-warning/70">(threshold)</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <ImageIcon size={12} className="text-surface-500" />
        <a href={getIPFSUrl(batch.ipfsHash)} target="_blank" rel="noopener noreferrer"
           className="font-mono text-primary-400 hover:text-primary-300 transition-colors truncate">
          IPFS: {batch.ipfsHash.slice(0, 24)}…
        </a>
      </div>

      {metaLoading && <div className="flex items-center gap-2 text-xs text-surface-500"><Loader2 size={12} className="animate-spin" /> Loading images…</div>}
      {images.length > 0 && (
        <div>
          <p className="text-xs text-surface-500 mb-2 uppercase tracking-wider font-medium">Batch Images</p>
          <div className="flex flex-wrap gap-2">
            {images.map((hash, i) => (
              <a key={i} href={getIPFSUrl(hash)} target="_blank" rel="noopener noreferrer">
                <img src={getIPFSUrl(hash)} alt={`Batch image ${i + 1}`}
                     className="w-20 h-20 object-cover rounded-lg border border-surface-700 hover:border-primary-500 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Supply Chain Timeline ── */}
      <div className="divider" />
      <div>
        <p className="text-xs text-surface-400 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
          <MapPin size={12} /> {t('supply_chain')} — {t('checkpoints')}
        </p>
        <CheckpointTimeline checkpoints={checkpoints} loading={checkpointLoading} />
      </div>

      <div className="divider" />
      <button onClick={onReport} className="btn-danger w-full justify-center">
        <Flag size={15} /> {t('report_title')}
      </button>
    </div>
  );
}

// ─── QR Scanner ──────────────────────────────────────────────────────────

function QRScanner({ onDetect }) {
  const { t } = useI18n();
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr]         = useState('');
  const [scanned, setScanned] = useState(false);
  const [scanNonce, setScanNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function stopStream() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    function mapCameraError(error) {
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return t('verify_camera_permission_blocked');
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return t('verify_camera_not_found');
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        return t('verify_camera_in_use');
      }
      if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        return t('verify_camera_constraint_failed');
      }
      return t('verify_camera_denied');
    }

    async function getStreamWithFallback() {
      const constraintsList = [
        { video: { facingMode: { ideal: 'environment' } } },
        { video: { facingMode: 'environment' } },
        { video: { facingMode: 'user' } },
        { video: true },
      ];

      let lastError = null;
      for (const constraints of constraintsList) {
        try {
          // eslint-disable-next-line no-await-in-loop
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError || new Error('Unable to initialize camera');
    }

    async function start() {
      try {
        setErr('');
        setScanned(false);

        const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const isSecure = window.isSecureContext || isLocalHost;
        if (!isSecure) {
          setErr(t('verify_camera_secure_context'));
          return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          setErr(t('verify_camera_not_supported'));
          return;
        }

        const stream = await getStreamWithFallback();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play().catch(() => {});
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setErr(mapCameraError(e));
      }
    }

    function tick() {
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) { rafRef.current = requestAnimationFrame(tick); return; }
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = scanQRFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (code) { setScanned(true); onDetect(code); return; }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      stopStream();
    };
  }, [onDetect, scanNonce]);

  if (err) return (
    <div className="card border-danger/20 bg-danger/5 text-center py-8">
      <XCircle size={28} className="text-danger mx-auto mb-3" />
      <p className="text-sm text-danger font-medium mb-4">{err}</p>
      <button type="button" className="btn-secondary mx-auto" onClick={() => setScanNonce((n) => n + 1)}>
        {t('verify_retry_camera')}
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-surface-700 bg-black aspect-square max-w-xs mx-auto">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-44 h-44 border-2 rounded-2xl transition-colors duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]
            ${scanned ? 'border-success' : 'border-primary-400'}`} />
        </div>
        {scanned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-success/20 backdrop-blur-sm rounded-2xl p-3">
              <CheckCircle size={32} className="text-success" />
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-surface-500">
        {scanned ? t('verify_qr_detected') : t('verify_qr_align')}
      </p>
    </div>
  );
}

// ─── Voice Button ─────────────────────────────────────────────────────────

function VoiceButton({ lang, onResult, onError }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const { t } = useI18n();

  const voiceLang = lang === 'hi' ? 'hi-IN' : 'en-US';

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = createVoiceRecognizer({
      lang: voiceLang,
      onResult: (text) => { setListening(false); onResult(text); },
      onError:  (err)  => { setListening(false); onError(err); },
      onEnd:    ()     => setListening(false),
    });
    if (!rec) { onError(t('verify_voice_not_supported')); return; }
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  if (!isVoiceSupported()) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={t('verify_voice')}
      className={`btn p-2.5 rounded-lg transition-all duration-200 shrink-0
        ${listening
          ? 'bg-danger/20 text-danger border border-danger/40 animate-pulse-slow'
          : 'bg-surface-800 text-surface-400 border border-surface-700 hover:text-surface-100 hover:border-surface-600'
        }`}
    >
      {listening ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
}

// ─── Main Verify Page ────────────────────────────────────────────────────

export default function Verify() {
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab]         = useState('manual');
  const [batchInput, setBatchInput]       = useState('');
  const [loading, setLoading]             = useState(false);
  const [batch, setBatch]                 = useState(null);
  const [manufacturer, setManuf]          = useState(null);
  const [reportCount, setReportCount]     = useState(0);
  const [checkpoints, setCheckpoints]     = useState([]);
  const [cpLoading, setCpLoading]         = useState(false);
  const [error, setError]                 = useState('');
  const [reportTargetBatchId, setReportTargetBatchId] = useState('');
  const [voiceError, setVoiceError]       = useState('');

  async function lookup(id) {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setBatch(null); setManuf(null); setReportCount(0); setCheckpoints([]);
    try {
      const contract = getReadContract();
      const [b, rc] = await Promise.all([
        contract.getBatch(trimmed),
        contract.reportCount(trimmed).catch(() => 0),
      ]);
      const m = await contract.getManufacturer(b.manufacturer);
      setBatch(b); setManuf(m); setReportCount(rc);

      // Load checkpoints separately (non-blocking)
      setCpLoading(true);
      contract.getCheckpoints(trimmed)
        .then(cp => setCheckpoints(cp))
        .catch(() => setCheckpoints([]))
        .finally(() => setCpLoading(false));
    } catch (err) {
      const msg = err?.reason || err?.message || '';
      if (msg.includes('BatchDoesNotExist') || msg.includes('does not exist'))
        setError(t('verify_error_batch_not_found')); 
      else if (!import.meta.env.VITE_CONTRACT_ADDRESS)
        setError(t('verify_error_contract_not_configured'));
      else
        setError(t('verify_error_retrieve_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function refreshReportCount() {
    if (!batch) return;
    try {
      const rc = await getReadContract().reportCount(batch.batchId);
      setReportCount(rc);
    } catch {}
  }

  async function notifyManufacturerByEmail(payload) {
    try {
      const contract = getReadContract();
      const batchInfo = await contract.getBatch(payload.batchId);
      const manufacturerWallet = batchInfo.manufacturer;
      const manufacturer = await contract.getManufacturer(manufacturerWallet).catch(() => null);

      const result = await notifyManufacturerReport({
        batchId: payload.batchId,
        reason: payload.reason,
        reporter: payload.reporter,
        reporterEmail: payload.reporterEmail,
        manufacturerWallet,
        manufacturerName: manufacturer?.name || 'Manufacturer',
        txHash: payload.txHash,
      });

      return {
        ok: true,
        message: result?.message || t('verify_report_delivered'),
      };
    } catch (err) {
      return {
        ok: false,
        message: t('verify_report_notify_failed', { error: err?.message || t('verify_unknown_error') }),
      };
    }
  }

  const handleScanDetect = useCallback((result) => {
    setBatchInput(result);
    setActiveTab('manual');
    lookup(result);
  }, []);

  return (
    <div className="w-full xl:w-[75%] mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="section-title mb-1">{t('verify_title')}</h1>
        <p className="text-surface-400 text-sm">{t('verify_sub')}</p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-surface-900 border border-surface-800 rounded-xl p-1 mb-6">
        {[
          { key: 'manual', label: t('verify_manual'), icon: Search },
          { key: 'scan',   label: t('verify_scan'),   icon: ScanLine },
          { key: 'report', label: t('report_title'),  icon: Flag },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === key ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-surface-200'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Manual input + Voice */}
      {activeTab === 'manual' && (
        <div className="mb-6">
          <form onSubmit={e => { e.preventDefault(); lookup(batchInput); }} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={t('verify_placeholder')}
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
            />
            <VoiceButton
              lang={lang}
              onResult={(text) => { setBatchInput(text); lookup(text); setVoiceError(''); }}
              onError={(err) => setVoiceError(err)}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={loading || !batchInput.trim()}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
            </button>
          </form>
          {voiceError && <p className="text-xs text-warning mt-1.5">{voiceError}</p>}
        </div>
      )}

      {/* QR Scanner */}
      {activeTab === 'scan' && (
        <div className="mb-6"><QRScanner onDetect={handleScanDetect} /></div>
      )}

      {/* Direct report tab */}
      {activeTab === 'report' && (
        <div className="card mb-6 space-y-4">
          <div>
            <h3 className="font-semibold text-surface-100">{t('verify_report_tab_title')}</h3>
            <p className="text-xs text-surface-500 mt-1">
              {t('verify_report_tab_sub')}
            </p>
          </div>
          <div>
            <label className="label">{t('dashboard_batch_id')}</label>
            <input
              className="input"
              placeholder={t('verify_placeholder')}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-danger"
            disabled={!batchInput.trim()}
            onClick={() => setReportTargetBatchId(batchInput.trim())}
          >
            <Flag size={14} /> {t('report_submit')}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-16 text-surface-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">{t('verify_querying')}</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-danger/30 bg-danger/5 text-danger mb-4">
          <XCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">{t('batch_not_found')}</p>
            <p className="text-xs opacity-80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Batch result */}
      {batch && !loading && (
        <BatchInfoPanel
          batch={batch}
          manufacturer={manufacturer}
          reportCount={reportCount}
          checkpoints={checkpoints}
          checkpointLoading={cpLoading}
          onReport={() => setReportTargetBatchId(batch.batchId)}
        />
      )}

      {/* Report modal */}
      {Boolean(reportTargetBatchId) && (
        <ReportModal
          batchId={reportTargetBatchId}
          onClose={() => setReportTargetBatchId('')}
          onReported={async (payload) => {
            const notify = await notifyManufacturerByEmail(payload);
            if (batch?.batchId === reportTargetBatchId) {
              refreshReportCount();
            }
            return notify;
          }}
        />
      )}
    </div>
  );
}
