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
  const [isBooked, setIsBooked] = useState(false);
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
        seatsBooked: seats,
      });

      toast.success('Ride booked successfully');
      setIsProcessing(false);
      setIsBooked(true);
      setTimeout(() => {
        navigate('/trips');
      }, 2000);
    } catch (requestError: any) {
      setIsProcessing(false);
      setError(requestError?.response?.data?.message || 'Booking failed');
      toast.error(requestError?.response?.data?.message || 'Booking failed');
    }
  };

  if (isBooked) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center px-8"
        >
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-3xl mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600">
            Your ride has been successfully booked
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl">Booking Summary</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Ride Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <h3 className="text-base mb-3">Trip Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Route</span>
              <span>
                {ride.fromCity} → {ride.toCity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date</span>
              <span>
                {new Date(ride.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                at {ride.time}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Driver</span>
              <span>{ride.driver.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Seats</span>
              <span>{seats}</span>
            </div>
          </div>
        </motion.div>

        {/* Payment Method */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <h3 className="text-base mb-3">Payment Method</h3>
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
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <h3 className="text-base mb-3">Price Breakdown</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>
                ${ride.pricePerSeat} × {seats} seat{seats > 1 ? 's' : ''}
              </span>
              <span>${subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Service fee</span>
              <span>${serviceFee}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
              <span>Total</span>
              <span className="text-xl text-blue-600">${total}</span>
            </div>
          </div>
        </motion.div>

        {/* Cancellation Policy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-blue-50 rounded-2xl p-4"
        >
          <h4 className="text-sm mb-1">Cancellation Policy</h4>
          <p className="text-xs text-gray-600">
            Free cancellation up to 24 hours before departure. 50% refund within 24
            hours.
          </p>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-md mx-auto">
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
            <>Confirm Booking · ${total}</>
          )}
        </button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
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
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <Icon className={`w-5 h-5 ${selected ? 'text-blue-600' : 'text-gray-600'}`} />
      <span className="flex-1 text-left">{label}</span>
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-blue-600' : 'border-gray-300'
        }`}
      >
        {selected && <div className="w-3 h-3 rounded-full bg-blue-600" />}
      </div>
    </button>
  );
}
