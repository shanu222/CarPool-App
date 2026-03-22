import { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, MapPin, Calendar, Clock, DollarSign, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PaymentModal } from '../components/PaymentModal';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { Button } from '../components/Button';
import { pakistanCities } from '../../data/pakistanCities';

export function PostRide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [formData, setFormData] = useState({
    fromCity: '',
    toCity: '',
    date: '',
    time: '',
    pricePerSeat: '',
    totalSeats: '3',
  });

  useEffect(() => {
    if (user?.role && user.role !== 'driver') {
      setError('Switch to Driver to post a ride');
    }
  }, [user?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user?.role !== 'driver') {
      setError('Switch to Driver to post a ride');
      return;
    }

    if (!user?.isVerified) {
      setError('Driver verification is required before posting rides. Upload your CNIC and profile in Profile.');
      return;
    }

    if (user?.canPostRide !== true) {
      setError('Payment approval is required before posting rides.');
      setShowPaymentModal(true);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.post('/api/rides/create', {
        fromCity: formData.fromCity,
        toCity: formData.toCity,
        date: formData.date,
        time: formData.time,
        pricePerSeat: Number(formData.pricePerSeat),
        totalSeats: Number(formData.totalSeats),
      });

      window.dispatchEvent(new CustomEvent('trips:refresh'));
      toast.success('Ride published successfully');
      navigate('/trips');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not publish ride');
      toast.error(requestError?.response?.data?.message || 'Could not publish ride');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = Object.values(formData).every((value) => value.trim() !== '');

  return (
    <div className="min-h-screen bg-gray-50 pb-10 overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-3 py-3 md:px-5 md:py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg md:text-xl">Offer Ride</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-3 py-4 md:px-5 md:py-5 space-y-4">
        {/* Route */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="responsive-card bg-white rounded-2xl shadow-md space-y-4"
        >
          <h3 className="text-sm md:text-base">Route Details</h3>

          <div>
            <CityAutocomplete
              label="From"
              value={formData.fromCity}
              onChange={(value) => updateField('fromCity', value)}
              placeholder="Departure city"
              icon={<MapPin className="w-5 h-5 text-gray-400" />}
              cities={pakistanCities}
            />
          </div>

          <div>
            <CityAutocomplete
              label="To"
              value={formData.toCity}
              onChange={(value) => updateField('toCity', value)}
              placeholder="Destination city"
              icon={<MapPin className="w-5 h-5 text-blue-600" />}
              cities={pakistanCities}
            />
          </div>
        </motion.div>

        {/* Date & Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="responsive-card bg-white rounded-2xl shadow-md space-y-4"
        >
          <h3 className="text-sm md:text-base">Departure</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-700">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-3 py-3 md:py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => updateField('time', e.target.value)}
                  className="w-full pl-10 pr-3 py-3 md:py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pricing & Seats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="responsive-card bg-white rounded-2xl shadow-md space-y-4"
        >
          <h3 className="text-sm md:text-base">Pricing & Capacity</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-700">Price per seat</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  value={formData.pricePerSeat}
                  onChange={(e) => updateField('pricePerSeat', e.target.value)}
                  placeholder="500"
                  className="w-full pl-10 pr-3 py-3 md:py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Available seats</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={formData.totalSeats}
                  onChange={(e) => updateField('totalSeats', e.target.value)}
                  className="w-full pl-10 pr-3 py-3 md:py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm md:text-base appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">1 seat</option>
                  <option value="2">2 seats</option>
                  <option value="3">3 seats</option>
                  <option value="4">4 seats</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          variant="success"
          loading={loading}
          loadingText="Processing..."
          disabled={!isFormValid || user?.role !== 'driver' || user?.canPostRide !== true}
          className="responsive-action"
        >
          Post Ride
        </Button>

        {user?.role === 'driver' && user?.canPostRide !== true ? (
          <Button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            variant="secondary"
            className="responsive-action border border-green-300 text-green-700"
          >
            Pay now to unlock ride posting
          </Button>
        ) : null}
      </form>

      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        paymentType="ride_post"
      />
    </div>
  );
}
