import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet, LogOut, Copy, CheckCheck, AlertTriangle, ChevronDown,
  ExternalLink, RefreshCw, X,
} from 'lucide-react';
import { useWallet, detectWallets } from '../context/WalletContext';

function truncate(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ── Address Avatar (deterministic gradient from address) ────────────────────
function Avatar({ address, size = 24 }) {
  const hue = address
    ? parseInt(address.slice(2, 8), 16) % 360
    : 200;
  return (
    <div
      className="rounded-full shrink-0 border border-white/10"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${(hue + 120) % 360},70%,45%))`,
      }}
    />
  );
}

// ── Wallet-selection modal ───────────────────────────────────────────────────
function WalletModal({ onClose, onConnect }) {
  const wallets  = detectWallets();
  const overlayRef = useRef(null);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="wallet-modal"
    >
      <div className="wallet-modal-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#0E1D2B' }}>Connect Wallet</h2>
            <p className="text-xs mt-0.5" style={{ color: '#70899F' }}>Choose a wallet to continue securely</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: '#70899F' }}
            onMouseEnter={e => e.currentTarget.style.color = '#0E1D2B'}
            onMouseLeave={e => e.currentTarget.style.color = '#70899F'}
          >
            <X size={15} />
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto text-2xl"
              style={{ background: 'rgba(14,94,156,0.12)' }}
            >
              🔐
            </div>
            <p className="text-sm" style={{ color: '#70899F' }}>No wallet extension detected</p>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs inline-flex"
            >
              Install MetaMask <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => { onConnect(w); onClose(); }}
                className="wallet-option-btn"
              >
                <span className="text-xl">{w.icon}</span>
                <span className="font-medium text-sm" style={{ color: '#0E1D2B' }}>{w.label}</span>
                <span className="ml-auto text-xs" style={{ color: '#199B6A' }}>Detected</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs mt-5" style={{ color: '#9DB3C8' }}>
          By connecting you agree to the <span style={{ color: '#4C6478' }}>terms of use</span>
        </p>
      </div>
    </div>
  );
}


// ── Connected pill + dropdown ────────────────────────────────────────────────
function ConnectedBadge({ account, balance, isCorrectChain, onDisconnect, onSwitch }) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function copyAddress() {
    navigator.clipboard.writeText(account).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200"
        style={{ background: '#ffffff', border: '1px solid #c7d6e4' }}
      >
        {/* Status dot */}
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${!isCorrectChain ? 'animate-pulse' : ''}`}
          style={{ background: isCorrectChain ? '#85C79A' : '#f59e0b' }}
        />
        <Avatar address={account} size={20} />
        <span className="text-sm font-mono" style={{ color: '#0E1D2B' }}>{truncate(account)}</span>
        {balance && (
          <span className="text-xs font-mono hidden sm:block" style={{ color: '#70899F' }}>
            {balance} MON
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: '#70899F' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in"
          style={{ background: '#ffffff', border: '1px solid #d7e2ec', backdropFilter: 'blur(12px)' }}
        >
          {/* Account info */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #e1eaf2' }}>
            <div className="flex items-center gap-2 mb-1">
              <Avatar address={account} size={28} />
              <span className="font-mono text-xs" style={{ color: '#4C6478' }}>{truncate(account)}</span>
            </div>
            {balance && (
              <p className="text-xs ml-9" style={{ color: '#70899F' }}>{balance} MON</p>
            )}
          </div>

          {!isCorrectChain && (
            <button onClick={() => { onSwitch(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-warning
                         hover:bg-warning/10 transition-colors">
              <RefreshCw size={14} />
              Switch to Monad
            </button>
          )}

          <button onClick={() => { copyAddress(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700
                       hover:bg-surface-100 transition-colors">
            {copied ? <CheckCheck size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Address'}
          </button>

          <button onClick={() => { onDisconnect(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger
                       hover:bg-danger/10 transition-colors border-t border-surface-300">
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function WalletConnect() {
  const { account, balance, isCorrectChain, loading, error, connect, disconnect, switchNetwork } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  if (account) {
    return (
      <div className="flex items-center gap-2">
        {!isCorrectChain && (
          <span className="flex items-center gap-1 text-xs text-warning px-2 py-1
                           bg-warning/10 rounded-lg border border-warning/20">
            <AlertTriangle size={12} /> Wrong Network
          </span>
        )}
        <ConnectedBadge
          account={account}
          balance={balance}
          isCorrectChain={isCorrectChain}
          onDisconnect={disconnect}
          onSwitch={switchNetwork}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => setModalOpen(true)}
          disabled={loading}
          className="btn-primary text-sm"
          id="wallet-connect-btn"
        >
          <Wallet size={16} />
          {loading ? 'Connecting…' : 'Connect Wallet'}
        </button>
        {error && <p className="text-xs text-danger/80 max-w-xs">{error}</p>}
      </div>

      {modalOpen && (
        createPortal(
          <WalletModal
            onClose={() => setModalOpen(false)}
            onConnect={(wallet) => connect(wallet)}
          />,
          document.body,
        )
      )}
    </>
  );
}
