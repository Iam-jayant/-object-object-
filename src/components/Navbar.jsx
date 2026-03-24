import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, ScanLine, MessagesSquare, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import WalletConnect from './WalletConnect';
import LanguageToggle from './LanguageToggle';
import NotificationBell from './NotificationBell';
import { useI18n } from '../context/i18nContext';

export default function Navbar() {
  const { pathname } = useLocation();
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const NAV_LINKS = [
    { to: '/',          label: t('nav_home'),      icon: ShieldCheck },
    { to: '/dashboard', label: t('nav_dashboard'), icon: LayoutDashboard },
    { to: '/verify',    label: t('nav_verify'),    icon: ScanLine },
    { to: '/forum',     label: t('nav_forum'),     icon: MessagesSquare },
  ];

  return (
    <>
      {/* ── Floating Navbar ──────────────────────────────────────── */}
      <div className="sticky top-4 z-50 flex justify-center px-4 pointer-events-none">
        <nav
          className={`pointer-events-auto w-full max-w-4xl transition-all duration-300 rounded-2xl
            ${scrolled
              ? 'shadow-2xl shadow-primary-900/15'
              : 'shadow-lg shadow-primary-900/8'
            }`}
          style={{
            background: scrolled
              ? 'rgba(255,255,255,0.97)'
              : 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(14,94,156,0.16)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <div className="px-4 sm:px-5">
            <div className="flex items-center justify-between h-14">

              {/* Logo */}
              <Link to="/" className="flex items-center gap-2.5 group shrink-0">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, #0E5E9C, #34A3DC)' }}
                >
                  <ShieldCheck size={17} className="text-white" />
                </div>
                <span className="font-bold text-base tracking-tight" style={{ color: '#0E1D2B' }}>
                  Medi<span style={{ color: '#0E5E9C' }}>Proof</span>
                </span>
              </Link>

              {/* Desktop Links */}
              <div className="hidden md:flex items-center gap-0.5">
                {NAV_LINKS.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                    style={pathname === to
                      ? { color: '#0E5E9C', background: 'rgba(14,94,156,0.1)' }
                      : { color: '#4C6478' }
                    }
                    onMouseEnter={e => { if (pathname !== to) e.currentTarget.style.color = '#0E1D2B'; e.currentTarget.style.background = 'rgba(14,94,156,0.08)'; }}
                    onMouseLeave={e => { if (pathname !== to) { e.currentTarget.style.color = '#4C6478'; e.currentTarget.style.background = 'transparent'; } }}
                  >
                    {label}
                  </Link>
                ))}
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <NotificationBell />
                <div className="hidden md:block">
                  <WalletConnect />
                </div>
                <button
                  className="md:hidden btn-ghost p-2 rounded-lg"
                  onClick={() => setOpen(!open)}
                  aria-label="Toggle menu"
                >
                  {open ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Dropdown */}
          {open && (
            <div
              className="md:hidden px-4 pb-4 pt-1"
              style={{ borderTop: '1px solid rgba(14,94,156,0.15)' }}
            >
              <div className="flex flex-col gap-1 pt-2">
                {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={pathname === to
                      ? { color: '#0E5E9C', background: 'rgba(14,94,156,0.1)' }
                      : { color: '#4C6478' }
                    }
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                ))}
                <div className="pt-3 mt-1" style={{ borderTop: '1px solid rgba(14,94,156,0.15)' }}>
                  <WalletConnect />
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
