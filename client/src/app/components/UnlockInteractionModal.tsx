import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Payment, PaymentQuote, PaymentSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface UnlockInteractionModalProps {
  open: boolean;
  rideId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function UnlockInteractionModal({ open, rideId, onClose, onSubmitted }: UnlockInteractionModalProps) {
  const { user } = useAuth();
  const [method, setMethod] = useState<'easypaisa' | 'jazzcash' | 'bank'>('easypaisa');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [latestStatus, setLatestStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roleLabel = useMemo(() => (user?.role === 'driver' ? 'Driver' : 'Passenger'), [user?.role]);

  useEffect(() => {
    if (!open || !rideId || !user?.role || (user.role !== 'driver' && user.role !== 'passenger')) {
      return;
    }

    const loadSettings = async () => {
      try {
        const [settingsResponse, quoteResponse, paymentsResponse] = await Promise.all([
          api.get<PaymentSettings>('/api/payments/settings'),
          api.get<PaymentQuote>(`/api/payments/quote/${rideId}`),
          api.get<Payment[]>(`/api/payments/my?rideId=${rideId}`),
        ]);

        setSettings(settingsResponse.data);
        setQuote(quoteResponse.data);

        const latest = (paymentsResponse.data || [])
          .filter((payment) => payment.type === 'interaction_unlock')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setLatestStatus(latest?.status || null);
      } catch {
        setSettings(null);
        setQuote(null);
        setLatestStatus(null);
      }
    };

    loadSettings();
  }, [open, rideId, user?.role]);

  if (!open) {
    return null;
  }

  const submitUnlock = async () => {
    if (!rideId) {
      toast.error('Ride is required for interaction payment');
      return;
    }

    if (latestStatus === 'pending' || latestStatus === 'approved') {
      return;
    }

    if (!screenshot) {
      toast.error('Upload payment screenshot to continue');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('rideId', rideId);
      formData.append('method', method);
      formData.append('proof', screenshot);

      await api.post('/api/payments/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Payment submitted for admin approval');
      setLatestStatus('pending');
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
          Interaction payment is required before joining this ride chat.
        </p>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>Distance: {quote ? `${Math.round(quote.distanceKm)} KM` : '-'}</p>
          <p>Price: {roleLabel} → PKR {quote?.amount ?? '-'}</p>
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

        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          <p>Easypaisa: {settings?.easypaisaNumber || '-'}</p>
          <p>JazzCash: {settings?.jazzcashNumber || '-'}</p>
          <p>Bank: {settings?.bankAccount || '-'}</p>
          <p>Title: {settings?.accountTitle || '-'}</p>
        </div>

        <div className="mt-4 space-y-3">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as 'easypaisa' | 'jazzcash' | 'bank')}
            disabled={latestStatus === 'pending' || latestStatus === 'approved'}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="bank">Bank</option>
          </select>

          <input
            type="file"
            accept="image/*"
            onChange={(event) => setScreenshot(event.target.files?.[0] || null)}
            disabled={latestStatus === 'pending' || latestStatus === 'approved'}
            className="w-full text-sm disabled:cursor-not-allowed"
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
              disabled={submitting || latestStatus === 'pending' || latestStatus === 'approved'}
              className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting
                ? 'Submitting...'
                : latestStatus === 'pending'
                ? 'Waiting for Approval'
                : latestStatus === 'approved'
                ? 'Unlocked'
                : 'Pay & Unlock Chat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
