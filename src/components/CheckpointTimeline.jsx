import { MapPin, Package, Clock, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Renders a vertical timeline of supply-chain checkpoints for a batch.
 * @param {{ checkpoints: Array, loading: boolean }} props
 */
export default function CheckpointTimeline({ checkpoints, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-surface-500 py-3">
        <Loader2 size={12} className="animate-spin" /> Loading checkpoints…
      </div>
    );
  }

  if (!checkpoints || checkpoints.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-surface-600 py-2">
        <MapPin size={12} /> No supply chain checkpoints recorded yet.
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {checkpoints.map((cp, i) => {
        const ts     = new Date(Number(cp.timestamp) * 1000);
        const date   = ts.toLocaleDateString();
        const time   = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isLast = i === checkpoints.length - 1;

        return (
          <div key={i} className="flex gap-3 pb-4 last:pb-0">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10
                ${isLast
                  ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                  : 'bg-success/10 border-success/40 text-success'
                }`}>
                {isLast
                  ? <Package   size={13} />
                  : <CheckCircle2 size={13} />
                }
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-surface-700 mt-1 mb-0 min-h-[16px]" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-primary-400 shrink-0" />
                  <span className="text-sm font-medium text-surface-100">{cp.location}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-surface-500 shrink-0">
                  <Clock size={10} />
                  {date} {time}
                </div>
              </div>
              {cp.note && (
                <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{cp.note}</p>
              )}
              <p className="text-xs text-surface-600 font-mono mt-1 truncate">
                {cp.recorder?.slice(0, 8)}…{cp.recorder?.slice(-4)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
