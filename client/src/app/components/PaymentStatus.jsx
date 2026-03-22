import { CheckCircle2, Hourglass } from 'lucide-react';

export function PaymentStatus({ status }) {
  if (status === 'approved') {
    return (
      <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-800">Payment Approved</p>
            <p className="mt-1 text-xs text-green-700">You can now chat and book rides</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-3">
          <Hourglass className="mt-0.5 h-5 w-5 animate-pulse text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Waiting for Approval</p>
            <p className="mt-1 text-xs text-amber-700">
              Your payment is being reviewed. It will be approved shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
