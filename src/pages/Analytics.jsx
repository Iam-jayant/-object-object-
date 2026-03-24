import { useState, useEffect } from 'react';
import { BarChart3, Package, Building2, Flag, AlertTriangle, RefreshCw,
         TrendingUp, Loader2, ExternalLink, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { getReadContract } from '../utils/contract';
import {
  fetchGlobalStats,
  fetchRecentBatches,
  fetchRecentReports,
  fetchSuspiciousBatches,
  isGraphConfigured,
} from '../utils/graph';

// ─── Stat card ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent }) {
  const accentMap = {
    primary: 'bg-primary-600/10 border-primary-500/20 text-primary-400',
    danger:  'bg-danger/10 border-danger/20 text-danger',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    success: 'bg-success/10 border-success/20 text-success',
  };
  const iconClass = accentMap[accent] || accentMap.primary;

  return (
    <div className="card hover:border-surface-700 transition-colors duration-200">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${iconClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-surface-50">{value ?? '—'}</p>
      <p className="text-sm text-surface-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-surface-600 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Batch row ────────────────────────────────────────────────────────────

function BatchRow({ batch }) {
  const expiredTs = Number(batch.expiryDate) * 1000;
  const expired   = expiredTs < Date.now();
  let statusEl;

  if (batch.isRecalled)        statusEl = <span className="badge-recalled text-xs">Recalled</span>;
  else if (batch.isSuspicious) statusEl = <span className="badge-expired text-xs">Suspicious</span>;
  else if (expired)            statusEl = <span className="badge-expired text-xs">Expired</span>;
  else                         statusEl = <span className="badge-valid text-xs">Valid</span>;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surface-800 last:border-0 gap-3">
      <div className="min-w-0">
        <p className="font-mono text-sm text-primary-300 truncate">{batch.id}</p>
        <p className="text-xs text-surface-500 truncate">{batch.manufacturer?.name || batch.manufacturer}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {batch.reportCount > 0 && (
          <span className="text-xs text-surface-500 flex items-center gap-1">
            <Flag size={10} /> {batch.reportCount}
          </span>
        )}
        {statusEl}
      </div>
    </div>
  );
}

// ─── Report row ──────────────────────────────────────────────────────────

function ReportRow({ report }) {
  const ts = new Date(Number(report.timestamp) * 1000).toLocaleDateString();
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-800 last:border-0">
      <div className="w-7 h-7 bg-danger/10 border border-danger/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Flag size={12} className="text-danger" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-primary-300 truncate">{report.batch?.id || '—'}</p>
        <p className="text-xs text-surface-300 truncate mt-0.5">{report.reason}</p>
      </div>
      <p className="text-xs text-surface-500 shrink-0">{ts}</p>
    </div>
  );
}

// ─── Banner when graph not configured ─────────────────────────────────────

function GraphBanner() {
  return (
    <div className="card border-warning/20 bg-warning/5 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-surface-100">The Graph not configured</p>
          <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">
            Add <code className="bg-surface-800 px-1 rounded text-primary-300">VITE_GRAPH_URL</code> to
            your <code className="bg-surface-800 px-1 rounded text-primary-300">.env</code> to enable
            full analytics. Basic on-chain stats shown below.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── On-chain fallback stats ──────────────────────────────────────────────

async function fetchOnChainStats() {
  // On-chain we can only get aggregate data by counting events directly
  // Returns a minimal stats object — Graph gives richer data
  return {
    totalBatches:       '—',
    totalManufacturers: '—',
    totalReports:       '—',
    totalRecalls:       '—',
    suspiciousBatches:  '—',
  };
}

// ─── Main Analytics Page ─────────────────────────────────────────────────

export default function Analytics() {
  const graphEnabled = isGraphConfigured();

  const [stats, setStats]           = useState(null);
  const [batches, setBatches]       = useState([]);
  const [reports, setReports]       = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      if (graphEnabled) {
        const [s, b, r, sus] = await Promise.all([
          fetchGlobalStats(),
          fetchRecentBatches(8),
          fetchRecentReports(6),
          fetchSuspiciousBatches(6),
        ]);
        setStats(s);
        setBatches(b);
        setReports(r);
        setSuspicious(sus);
      } else {
        setStats(await fetchOnChainStats());
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="w-full xl:w-[75%] mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="section-title mb-1 flex items-center gap-2">
            <BarChart3 size={24} className="text-primary-400" />
            Analytics
          </h1>
          <p className="text-surface-400 text-sm">
            Real-time on-chain statistics for MediProof batches.
            {lastRefresh && (
              <span className="ml-2 text-surface-600 text-xs">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Graph banner */}
      {!graphEnabled && <GraphBanner />}

      {/* Error */}
      {error && (
        <div className="card mb-6 border-danger/20 bg-danger/5 text-danger text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Stats grid */}
      {loading && !stats ? (
        <div className="flex items-center justify-center gap-3 py-24 text-surface-400">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading analytics…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard icon={Package}     label="Total Batches"       value={stats?.totalBatches}       accent="primary" />
            <StatCard icon={Building2}   label="Manufacturers"        value={stats?.totalManufacturers}  accent="success" />
            <StatCard icon={Flag}        label="Total Reports"        value={stats?.totalReports}        accent="danger"  />
            <StatCard icon={RefreshCw}   label="Recalls"              value={stats?.totalRecalls}        accent="warning" />
            <StatCard icon={ShieldAlert} label="Suspicious Batches"   value={stats?.suspiciousBatches}   accent="danger"  />
          </div>

          {graphEnabled && (
            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              {/* Recent Batches */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-surface-100 flex items-center gap-2">
                    <Package size={16} className="text-primary-400" /> Recent Batches
                  </h2>
                  <span className="badge-neutral text-xs">{batches.length}</span>
                </div>
                {batches.length === 0
                  ? <p className="text-sm text-surface-500 text-center py-6">No batches yet</p>
                  : batches.map(b => <BatchRow key={b.id} batch={b} />)
                }
              </div>

              {/* Recent Reports */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-surface-100 flex items-center gap-2">
                    <Flag size={16} className="text-danger" /> Recent Reports
                  </h2>
                  <span className="badge-neutral text-xs">{reports.length}</span>
                </div>
                {reports.length === 0
                  ? <p className="text-sm text-surface-500 text-center py-6">No reports yet</p>
                  : reports.map(r => <ReportRow key={r.id} report={r} />)
                }
              </div>
            </div>
          )}

          {graphEnabled && suspicious.length > 0 && (
            <div className="card border-danger/20">
              <h2 className="font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <ShieldAlert size={16} className="text-danger" /> Suspicious Batches
                <span className="badge-recalled text-xs">{suspicious.length}</span>
              </h2>
              <div className="space-y-2">
                {suspicious.map(b => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                    <p className="font-mono text-sm text-primary-300">{b.id}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-surface-400">
                        <Flag size={10} className="inline mr-1" />{b.reportCount} reports
                      </span>
                      {b.isRecalled
                        ? <span className="badge-recalled text-xs">Recalled</span>
                        : <span className="badge-expired text-xs">Suspicious</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graph deployment guide when not configured */}
          {!graphEnabled && (
            <div className="card mt-5">
              <h2 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary-400" /> Enable Full Analytics
              </h2>
              <ol className="space-y-3">
                {[
                  'Deploy MediProof.sol and note the contract address',
                  'Update subgraph/subgraph.yaml with your contract address',
                  'Run: cd subgraph && npm install && graph init (in The Graph Studio)',
                  'Deploy the subgraph to The Graph Studio or hosted service',
                  'Add VITE_GRAPH_URL=<your-subgraph-endpoint> to .env',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-surface-300">
                    <span className="w-5 h-5 bg-primary-600/20 border border-primary-500/30 rounded-full
                                     flex items-center justify-center text-primary-400 text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <a
                href="https://thegraph.com/docs/en/developing/creating-a-subgraph/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary mt-5 w-fit"
              >
                <ExternalLink size={14} /> The Graph Docs
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
