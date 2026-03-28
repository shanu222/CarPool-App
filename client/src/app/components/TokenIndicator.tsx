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
    <div className="pointer-events-auto inline-flex max-w-full flex-col items-end gap-1">
      <div className="inline-flex max-w-full flex-wrap items-center justify-end gap-1 rounded-2xl border border-sky-200 bg-sky-100 px-2.5 py-1.5 text-xs text-sky-700 shadow-sm">
        <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold text-sky-800">{tokens} Tokens</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold text-sky-700">{tokensSpent} Used</span>
      </div>
      {showLowTokenWarning ? (
        <span className="max-w-full rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 shadow-sm text-wrap-safe">
          Insufficient tokens. Please recharge.
        </span>
      ) : null}
    </div>
  );
}
