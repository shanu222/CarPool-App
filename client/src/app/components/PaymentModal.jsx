import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';

const AMOUNTS = {
  ride_post: 200,
  booking_unlock: 100,
};

export function PaymentModal({ open, onClose, paymentType = 'booking_unlock', onSubmitted }) {
  const [method, setMethod] = useState('easypaisa');
  const [proof, setProof] = useState(null);
  const [settings, setSettings] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const copy = useMemo(() => {
    if (paymentType === 'ride_post') {
      return {
        title: 'Unlock Ride Posting',
        description: 'Driver payment is PKR 200. Upload your screenshot for admin approval.',
        cta: 'Submit Ride Post Payment',
      };
    }

    return {
      title: 'Unlock Booking and Chat',
      description: 'Passenger payment is PKR 100. Upload your screenshot for admin approval.',
      cta: 'Submit Booking Unlock Payment',
    };
  }, [paymentType]);

  useEffect(() => {
    if (!open) {
      return;
    }

    api
      .get('/api/payments/settings')
      .then((response) => setSettings(response.data))
      .catch(() => setSettings(null));
  }, [open]);

  if (!open) {
    return null;
  }

  const submitPayment = async () => {
    if (!proof) {
      toast.error('Upload payment proof image to continue');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('type', paymentType);
      formData.append('method', method);
      formData.append('amount', String(AMOUNTS[paymentType] || 0));
      formData.append('proof', proof);

      await api.post('/api/payments/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Payment proof submitted. Admin review is pending.');
      onSubmitted?.();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not submit payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">{copy.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{copy.description}</p>

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
          <p>Easypaisa: {settings?.easypaisaNumber || '-'}</p>
          <p>JazzCash: {settings?.jazzcashNumber || '-'}</p>
          <p>Bank: {settings?.bankAccount || '-'}</p>
          <p>Title: {settings?.accountTitle || '-'}</p>
        </div>

        <div className="mt-4 space-y-3">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="bank">Bank</option>
          </select>

          <input
            type="file"
            accept="image/*"
            onChange={(event) => setProof(event.target.files?.[0] || null)}
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
              onClick={submitPayment}
              disabled={submitting}
              className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : copy.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
