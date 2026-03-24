import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ScanLine, LayoutDashboard, ArrowRight, Lock, Database, Zap } from 'lucide-react';
import { useI18n } from '../context/i18nContext';

function useScrollAnimation() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.animate-on-scroll').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

const FEATURE_KEYS = [
  {
    icon: Lock,
    titleKey: 'landing_feature_traceability_title',
    descKey: 'landing_feature_traceability_desc',
  },
  {
    icon: Database,
    titleKey: 'landing_feature_storage_title',
    descKey: 'landing_feature_storage_desc',
  },
  {
    icon: ScanLine,
    titleKey: 'landing_feature_verify_title',
    descKey: 'landing_feature_verify_desc',
  },
];

const STEP_KEYS = [
  { step: '01', titleKey: 'landing_step_1_title', descKey: 'landing_step_1_desc' },
  { step: '02', titleKey: 'landing_step_2_title', descKey: 'landing_step_2_desc' },
  { step: '03', titleKey: 'landing_step_3_title', descKey: 'landing_step_3_desc' },
  { step: '04', titleKey: 'landing_step_4_title', descKey: 'landing_step_4_desc' },
];

export default function Landing() {
  useScrollAnimation();
  const { t } = useI18n();

  const features = FEATURE_KEYS.map((f) => ({
    ...f,
    title: t(f.titleKey),
    desc: t(f.descKey),
  }));

  const steps = STEP_KEYS.map((s) => ({
    ...s,
    title: t(s.titleKey),
    desc: t(s.descKey),
  }));

  return (
    <div className="min-h-screen w-full">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-36 px-4 text-center overflow-hidden">

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full opacity-90"
            style={{ background: 'radial-gradient(circle, rgba(52,163,220,0.2) 0%, rgba(255,255,255,0) 72%)' }}
          />
          <div
            className="absolute top-48 -left-24 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #19A974 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-20 -right-16 w-80 h-80 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #0E5E9C 0%, #34A3DC 60%, transparent 100%)' }}
          />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle, #85C79A 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />
        </div>

        <div className="relative w-full mx-auto px-2">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-xs font-medium"
            style={{
              background: 'rgba(14,94,156,0.08)',
              border: '1px solid rgba(14,94,156,0.18)',
              color: '#0E5E9C',
            }}
          >
            <ShieldCheck size={13} />
            {t('landing_badge')}
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6 text-balance">
            <span style={{ color: '#0E1D2B' }}>{t('landing_hero_line_1')}</span>{' '}
            <span className="grad-text">{t('landing_hero_line_2')}</span>{' '}
            <span style={{ color: '#0E1D2B' }}>{t('landing_hero_line_3')}</span>
          </h1>

          <p className="text-lg leading-relaxed max-w-2xl mx-auto mb-10 text-balance" style={{ color: '#4C6478' }}>
            {t('landing_hero_desc')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/verify" className="btn-primary text-base px-7 py-3 w-full sm:w-auto justify-center">
              <ScanLine size={18} />
              {t('hero_verify_cta')}
            </Link>
            <Link to="/dashboard" className="btn-secondary text-base px-7 py-3 w-full sm:w-auto justify-center">
              <LayoutDashboard size={18} />
              {t('hero_dash_cta')}
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative w-full mx-auto mt-20 px-2">
          <div
            className="card-glass flex flex-col sm:flex-row items-center justify-around gap-4 sm:gap-0
                       divide-y sm:divide-y-0 divide-teal-800/30 px-6 py-5"
            style={{ borderColor: 'rgba(78,141,156,0.2)' }}
          >
            {[
              { label: t('landing_stat_1_label'), value: t('landing_stat_1_value') },
              { label: t('landing_stat_2_label'), value: t('landing_stat_2_value') },
              { label: t('landing_stat_3_label'), value: t('landing_stat_3_value') },
            ].map(({ label, value }) => (
              <div key={label} className="text-center px-6 py-1 w-full sm:w-auto">
                <p className="text-xl font-bold" style={{ color: '#0E5E9C' }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#70899F' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="py-24 px-4" style={{ borderTop: '1px solid rgba(14,94,156,0.12)' }}>
        <div className="w-full mx-auto">
          <div className="text-center mb-14 animate-on-scroll">
            <h2 className="section-title mb-3">{t('landing_features_title')}</h2>
            <p style={{ color: '#70899F' }}>{t('landing_features_sub')}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="card animate-on-scroll group hover:border-primary-400/30 transition-all duration-300"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(14,94,156,0.1)', border: '1px solid rgba(14,94,156,0.2)' }}
                >
                  <Icon size={20} style={{ color: '#0E5E9C' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: '#0E1D2B' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#4C6478' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section className="py-24 px-4" style={{ borderTop: '1px solid rgba(14,94,156,0.12)' }}>
        <div className="w-full mx-auto">
          <div className="text-center mb-14 animate-on-scroll">
            <h2 className="section-title mb-3">{t('landing_workflow_title')}</h2>
            <p style={{ color: '#70899F' }}>{t('landing_workflow_sub')}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {steps.map(({ step, title, desc }, i) => (
              <div
                key={step}
                className="card-sm flex gap-4 animate-on-scroll group hover:border-primary-400/20 transition-all duration-300"
                style={{ transitionDelay: `${i * 80}ms`, borderColor: 'rgba(78,141,156,0.18)' }}
              >
                <span
                  className="text-3xl font-extrabold shrink-0 leading-none pt-0.5"
                  style={{ color: 'rgba(14,94,156,0.28)' }}
                >
                  {step}
                </span>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#0E1D2B' }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#4C6478' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-4" style={{ borderTop: '1px solid rgba(14,94,156,0.12)' }}>
        <div className="w-full mx-auto text-center animate-on-scroll">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 glow-teal"
            style={{ background: 'linear-gradient(135deg, #0E5E9C, #34A3DC)' }}
          >
            <Zap size={26} className="text-white" />
          </div>
          <h2 className="section-title mb-3">Deploy trusted verification in your supply chain</h2>
          <p className="mb-8" style={{ color: '#4C6478' }}>
            {t('landing_cta_desc')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/dashboard" className="btn-primary px-7 py-3 text-base justify-center">
              {t('landing_cta_primary')} <ArrowRight size={16} />
            </Link>
            <Link to="/verify" className="btn-secondary px-7 py-3 text-base justify-center">
              {t('landing_cta_secondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center" style={{ borderTop: '1px solid rgba(14,94,156,0.12)' }}>
        <p className="text-sm" style={{ color: '#70899F' }}>
          {t('landing_footer')}
        </p>
      </footer>
    </div>
  );
}
