import type { User } from '../types';

const normalizeCount = (value?: number) => Math.max(0, Number(value || 0));

interface TokenIndicatorProps {
  user?: User | null;
}

export function TokenIndicator({ user }: TokenIndicatorProps) {
  if (!user || user.role === 'admin') {
    return null;
  }

  const tokens = normalizeCount(user.tokens ?? user.tokenBalance);
  const tokensSpent = normalizeCount(user.tokensSpent);
  const showLowTokenWarning = tokens < 2;

  return (
    <div className="pointer-events-auto inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-2 rounded-2xl border border-white/35 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm backdrop-blur-sm">
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">{tokens} Tokens</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{tokensSpent} Used</span>
      </div>
      {showLowTokenWarning ? (
        <span className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 shadow-sm">
          Insufficient tokens. Please recharge.
        </span>
      ) : null}
    </div>
  );
}
