import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { PaymentSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface UnlockInteractionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function UnlockInteractionModal({ open, onClose, onSubmitted }: UnlockInteractionModalProps) {
  const { user } = useAuth();
  const [method, setMethod] = useState<'easypaisa' | 'jazzcash' | 'bank'>('easypaisa');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unlockType = useMemo(() => {
    if (user?.role === 'driver') {
      return 'ride_post';
    }

    return 'booking_unlock';
  }, [user?.role]);

  const amount = unlockType === 'ride_post' ? 200 : 100;

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await api.get<PaymentSettings>('/api/payments/settings');
        setSettings(response.data);
      } catch {
        setSettings(null);
      }
    };

    loadSettings();
  }, [open]);

  if (!open) {
    return null;
  }

  const submitUnlock = async () => {
    if (!screenshot) {
      toast.error('Upload payment screenshot to continue');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('type', unlockType);
      formData.append('method', method);
      formData.append('amount', String(amount));
      formData.append('proof', screenshot);

      await api.post('/api/payments/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Payment submitted for admin approval');
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
        <h3 className="text-lg font-semibold text-slate-900">Pay to unlock interaction</h3>
        <p className="mt-1 text-sm text-slate-600">
          {unlockType === 'ride_post'
            ? 'Driver interaction unlock is PKR 200.'
            : 'Passenger interaction unlock is PKR 100.'}
        </p>

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
              {submitting ? 'Submitting...' : 'Unlock Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
