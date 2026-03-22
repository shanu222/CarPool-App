import { Check } from 'lucide-react';

export function VerifiedBadge({ isVerified, className = '' }) {
  if (!isVerified) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white ${className}`.trim()}
      title="Verified"
      aria-label="Verified user"
    >
      <Check className="h-3 w-3" />
      <span>Verified</span>
    </span>
  );
}
