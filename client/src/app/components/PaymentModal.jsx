import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { PaymentStatus } from './PaymentStatus';
import { Button } from './Button';

const AMOUNTS = {
  ride_post: 200,
  booking_unlock: 100,
};

export function PaymentModal({ open, onClose, paymentType = 'booking_unlock', onSubmitted }) {
  const [method, setMethod] = useState('easypaisa');
  const [proof, setProof] = useState(null);
  const [settings, setSettings] = useState(null);
  const [latestStatus, setLatestStatus] = useState(null);
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

    const loadModalData = async () => {
      try {
        const [settingsResponse, paymentsResponse] = await Promise.all([
          api.get('/api/payments/settings'),
          api.get('/api/payments/my'),
        ]);

        setSettings(settingsResponse.data);
        const paymentRows = Array.isArray(paymentsResponse.data)
          ? paymentsResponse.data
          : paymentsResponse.data?.payments || [];
        const latest = paymentRows
          .filter((payment) => payment.type === paymentType)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        setLatestStatus(latest?.status || null);
      } catch {
        setSettings(null);
        setLatestStatus(null);
      }
    };

    loadModalData();
  }, [open, paymentType]);

  if (!open) {
    return null;
  }

  const submitPayment = async () => {
    if (latestStatus === 'pending' || latestStatus === 'approved') {
      return;
    }

    if (!proof) {
      toast.error('Upload payment proof file to continue');
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
      setLatestStatus('pending');
      onSubmitted?.();
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

        <PaymentStatus status={latestStatus} />

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
            disabled={latestStatus === 'pending' || latestStatus === 'approved'}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="bank">Bank</option>
          </select>

          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(event) => setProof(event.target.files?.[0] || null)}
            disabled={latestStatus === 'pending' || latestStatus === 'approved'}
            className="w-full text-sm disabled:cursor-not-allowed"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitPayment}
              loading={submitting}
              loadingText="Processing..."
              disabled={latestStatus === 'pending' || latestStatus === 'approved'}
              variant="primary"
              className="flex-1"
            >
              {latestStatus === 'pending'
                ? 'Waiting for Approval'
                : latestStatus === 'approved'
                ? 'Payment Approved'
                : copy.cta}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
