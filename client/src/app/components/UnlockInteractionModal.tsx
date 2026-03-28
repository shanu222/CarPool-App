import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Payment } from '../types';
import { toast } from 'sonner';

type PaymentsApiResponse = Payment[] | { payments?: Payment[] };

const extractPayments = (payload: PaymentsApiResponse | undefined): Payment[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.payments)) {
    return payload.payments;
  }

  return [];
};

interface UnlockInteractionModalProps {
  open: boolean;
  rideId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function UnlockInteractionModal({ open, rideId, onClose, onSubmitted }: UnlockInteractionModalProps) {
  const [method, setMethod] = useState<'easypaisa' | 'jazzcash' | 'bank'>('easypaisa');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [amount, setAmount] = useState('');
  const [latestStatus, setLatestStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const paymentAccounts = {
    easypaisa: {
      title: 'Shahnawaz',
      number: '03403318127',
    },
    jazzcash: {
      title: 'Shahnawaz',
      number: '03403318127',
    },
    bank: {
      label: 'HBL Bank',
      title: 'Shahnawaz',
      number: '24897000279603',
    },
  };

  useEffect(() => {
    if (!open || !rideId) {
      return;
    }

    const loadStatus = async () => {
      try {
        const paymentsResponse = await api.get<PaymentsApiResponse>(`/api/payments/my?rideId=${rideId}`);

        const latest = extractPayments(paymentsResponse.data)
          .filter((payment) => payment.type === 'interaction_unlock')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setLatestStatus(latest?.status || null);
      } catch {
        setLatestStatus(null);
      }
    };

    loadStatus();
  }, [open, rideId]);

  if (!open) {
    return null;
  }

  const submitUnlock = async () => {
    if (!rideId) {
      toast.error('Ride is required for interaction payment');
      return;
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }

    if (!screenshot) {
      toast.error('Upload payment proof file to continue');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('rideId', rideId);
      formData.append('method', method);
      formData.append('amount', String(parsedAmount));
      formData.append('proof', screenshot);

      await api.post('/api/payments/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Payment submitted for admin approval');
      setLatestStatus('pending');
      setScreenshot(null);
      onSubmitted?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Pay & Unlock Chat</h3>
        <p className="mt-1 text-sm text-slate-600">
          Use these payment methods to submit your proof.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">Easypaisa</p>
            <p className="mt-1">Title: {paymentAccounts.easypaisa.title}</p>
            <p>Number: {paymentAccounts.easypaisa.number}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">JazzCash</p>
            <p className="mt-1">Title: {paymentAccounts.jazzcash.title}</p>
            <p>Number: {paymentAccounts.jazzcash.number}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">{paymentAccounts.bank.label}</p>
            <p className="mt-1">Title: {paymentAccounts.bank.title}</p>
            <p>Account Number: {paymentAccounts.bank.number}</p>
          </div>
        </div>

        {latestStatus ? (
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {latestStatus === 'pending'
              ? 'Payment review is pending'
              : latestStatus === 'approved'
              ? 'Payment approved for this ride'
              : 'Payment rejected. Submit again to unlock chat'}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Enter amount"
          />

          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as 'easypaisa' | 'jazzcash' | 'bank')}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="bank">Bank</option>
          </select>

          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(event) => setScreenshot(event.target.files?.[0] || null)}
            className="w-full text-sm"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitUnlock}
              disabled={submitting}
              className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Pay & Unlock Chat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
