import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, CreditCard, Wallet, Banknote, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Ride } from '../types';
import { useEffect } from 'react';

export function Booking() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | 'cash'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [ride, setRide] = useState<Ride | null>(null);
  const [error, setError] = useState('');

  const seats = parseInt(searchParams.get('seats') || '1');

  useEffect(() => {
    const loadRide = async () => {
      try {
        const response = await api.get<Ride>(`/api/rides/${id}`);
        setRide(response.data);
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || 'Could not load ride');
      }
    };

    if (id) {
      loadRide();
    }
  }, [id]);

  if (!ride) {
    return <div className="p-6">{error || 'Loading booking...'}</div>;
  }

  const subtotal = ride.pricePerSeat * seats;
  const serviceFee = 2;
  const total = subtotal + serviceFee;

  const handleBook = async () => {
    try {
      setIsProcessing(true);
      setError('');
      await api.post('/api/bookings/create', {
        rideId: ride._id,
        seatsRequested: seats,
      });

      toast.success('Booking request sent to driver');
      setIsProcessing(false);
      setIsRequested(true);
      setTimeout(() => {
        navigate('/trips');
      }, 2000);
    } catch (requestError: any) {
      setIsProcessing(false);
      setError(requestError?.response?.data?.message || 'Booking failed');
      toast.error(requestError?.response?.data?.message || 'Booking failed');
    }
  };

  if (isRequested) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="glass-panel rounded-3xl text-center px-8 py-10"
        >
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-3xl mb-2">Request Sent!</h1>
          <p className="text-slate-100">
            Your booking request is pending driver approval
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-transparent pb-28">
      {/* Header */}
      <div className="glass-panel mx-4 mt-4 px-6 py-4 rounded-3xl sticky top-2 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/90">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl text-white">Booking Summary</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Ride Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-4"
        >
          <h3 className="text-base mb-3 text-white">Trip Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-100">Route</span>
              <span className="text-white">
                {ride.fromCity} → {ride.toCity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-100">Date</span>
              <span className="text-white">
                {new Date(ride.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                at {ride.time}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-100">Driver</span>
              <span className="text-white">{ride.driver.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-100">Seats</span>
              <span className="text-white">{seats}</span>
            </div>
          </div>
        </motion.div>

        {/* Payment Method */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl p-4"
        >
          <h3 className="text-base mb-3 text-white">Payment Method</h3>
          <div className="space-y-2">
            <PaymentOption
              icon={CreditCard}
              label="Credit/Debit Card"
              value="card"
              selected={paymentMethod === 'card'}
              onSelect={() => setPaymentMethod('card')}
            />
            <PaymentOption
              icon={Wallet}
              label="Digital Wallet"
              value="wallet"
              selected={paymentMethod === 'wallet'}
              onSelect={() => setPaymentMethod('wallet')}
            />
            <PaymentOption
              icon={Banknote}
              label="Cash"
              value="cash"
              selected={paymentMethod === 'cash'}
              onSelect={() => setPaymentMethod('cash')}
            />
          </div>
        </motion.div>

        {/* Price Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl p-4"
        >
          <h3 className="text-base mb-3 text-white">Price Breakdown</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-slate-100">
              <span>
                ${ride.pricePerSeat} × {seats} seat{seats > 1 ? 's' : ''}
              </span>
              <span>${subtotal}</span>
            </div>
            <div className="flex justify-between text-slate-100">
              <span>Service fee</span>
              <span>${serviceFee}</span>
            </div>
            <div className="border-t border-white/30 pt-2 mt-2 flex justify-between">
              <span className="text-white">Total</span>
              <span className="text-xl text-blue-200">${total}</span>
            </div>
          </div>
        </motion.div>

        {/* Cancellation Policy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-subtle rounded-2xl p-4"
        >
          <h4 className="text-sm mb-1 text-white">Cancellation Policy</h4>
          <p className="text-xs text-slate-100">
            Free cancellation up to 24 hours before departure. 50% refund within 24
            hours.
          </p>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="absolute bottom-0 left-0 right-0 mx-3 mb-3 rounded-2xl glass-panel px-6 py-4">
        <button
          onClick={handleBook}
          disabled={isProcessing}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl shadow-lg shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>Send Request · ${total}</>
          )}
        </button>
        {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
      </div>
    </div>
  );
}

interface PaymentOptionProps {
  icon: React.ElementType;
  label: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
}

function PaymentOption({ icon: Icon, label, selected, onSelect }: PaymentOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
        selected ? 'border-white/70 bg-white/30' : 'border-white/30 bg-white/10 hover:bg-white/20'
      }`}
    >
      <Icon className={`w-5 h-5 ${selected ? 'text-white' : 'text-slate-100'}`} />
      <span className="flex-1 text-left text-white">{label}</span>
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-white' : 'border-white/50'
        }`}
      >
        {selected && <div className="w-3 h-3 rounded-full bg-white" />}
      </div>
    </button>
  );
}
