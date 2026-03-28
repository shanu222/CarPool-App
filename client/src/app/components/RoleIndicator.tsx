import type { User } from '../types';

export function RoleIndicator({ role }: { role?: User['role'] }) {
  if (role !== 'driver' && role !== 'passenger') {
    return null;
  }

  const isDriver = role === 'driver';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm ${
        isDriver
          ? 'border-emerald-300/60 bg-emerald-100/95 text-emerald-800'
          : 'border-blue-300/60 bg-blue-100/95 text-blue-800'
      }`}
      aria-label={`Current role: ${isDriver ? 'Driver' : 'Passenger'}`}
      title={`Current role: ${isDriver ? 'Driver' : 'Passenger'}`}
    >
      {isDriver ? 'Driver' : 'Passenger'}
    </span>
  );
}
