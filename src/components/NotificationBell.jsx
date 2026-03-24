import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Check, X, Loader2, ExternalLink } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import {
  fetchNotifications,
  subscribeToChannel,
  unsubscribeFromChannel,
  isPushConfigured,
  PUSH_CHANNEL,
} from '../utils/push';
import { BrowserProvider } from 'ethers';

export default function NotificationBell() {
  const { account } = useWallet();
  const [open,           setOpen]          = useState(false);
  const [notifications,  setNotifications] = useState([]);
  const [subscribed,     setSubscribed]    = useState(false);
  const [subLoading,     setSubLoading]    = useState(false);
  const [loading,        setLoading]       = useState(false);
  const configured = isPushConfigured();

  const unread = notifications.length;

  const loadNotifications = useCallback(async () => {
    if (!account || !configured) return;
    setLoading(true);
    const notifs = await fetchNotifications(account);
    // Filter to only MediProof channel notifications
    setNotifications(notifs.filter(n => n.sender === PUSH_CHANNEL).slice(0, 10));
    setLoading(false);
  }, [account, configured]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function handleSubscribe() {
    if (!account) return;
    setSubLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      if (subscribed) {
        await unsubscribeFromChannel(signer);
        setSubscribed(false);
      } else {
        await subscribeToChannel(signer);
        setSubscribed(true);
      }
    } catch (err) {
      console.error('Push subscription error:', err);
    } finally {
      setSubLoading(false);
    }
  }

  if (!account) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative btn-ghost p-2 rounded-lg"
        title={configured ? 'Notifications' : 'Push Protocol not configured'}
      >
        {configured ? <Bell size={18} /> : <BellOff size={18} className="text-surface-600" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger rounded-full
                           flex items-center justify-center text-white text-[9px] font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-10 z-50 w-80 bg-surface-900 border border-surface-700
                          rounded-xl shadow-2xl overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-primary-400" />
                <span className="font-semibold text-sm text-surface-100">Notifications</span>
              </div>
              <div className="flex items-center gap-2">
                {configured && (
                  <button
                    onClick={handleSubscribe}
                    disabled={subLoading}
                    className={`text-xs px-2 py-1 rounded-md transition-colors duration-200 flex items-center gap-1
                      ${subscribed
                        ? 'bg-success/10 text-success border border-success/20 hover:bg-danger/10 hover:text-danger hover:border-danger/20'
                        : 'bg-primary-600/10 text-primary-400 border border-primary-500/20 hover:bg-primary-600/20'
                      }`}
                  >
                    {subLoading
                      ? <Loader2 size={10} className="animate-spin" />
                      : subscribed
                        ? <><Check size={10} /> Subscribed</>
                        : <><Bell size={10} /> Subscribe</>
                    }
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-surface-500 hover:text-surface-300">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-72 overflow-y-auto">
              {!configured ? (
                <div className="px-4 py-6 text-center">
                  <BellOff size={24} className="text-surface-600 mx-auto mb-2" />
                  <p className="text-xs text-surface-400 mb-1 font-medium">Push Protocol not configured</p>
                  <p className="text-xs text-surface-600">
                    Set <code className="bg-surface-800 px-1 rounded">VITE_PUSH_CHANNEL_ADDRESS</code> to enable recall alerts.
                  </p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-surface-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs">Loading…</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={24} className="text-surface-700 mx-auto mb-2" />
                  <p className="text-xs text-surface-500">No notifications yet</p>
                  {!subscribed && (
                    <p className="text-xs text-surface-600 mt-1">Subscribe to get recall alerts.</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-surface-800">
                  {notifications.map((n, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-surface-800/50 transition-colors">
                      <p className="text-xs font-medium text-surface-100 mb-0.5">{n.title || n.notification?.title}</p>
                      <p className="text-xs text-surface-400 leading-relaxed">
                        {n.message || n.notification?.body}
                      </p>
                      {n.cta && (
                        <a
                          href={n.cta}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-400 flex items-center gap-1 mt-1 hover:text-primary-300"
                        >
                          View <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {configured && (
              <div className="px-4 py-2 border-t border-surface-800 flex justify-end">
                <button
                  onClick={loadNotifications}
                  disabled={loading}
                  className="text-xs text-surface-500 hover:text-surface-300 flex items-center gap-1"
                >
                  <Loader2 size={10} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
