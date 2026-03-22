import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Star, MapPin, Users, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { Ride } from '../types';
import { useAuth } from '../context/AuthContext';
import { LiveRideMap } from '../components/LiveRideMap';

export function RideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRide = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get<Ride>(`/api/rides/${id}`);
        setRide(response.data);
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || 'Ride not found');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadRide();
    }
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading ride...</div>;
  }

  if (!ride) {
    return <div className="p-6">{error || 'Ride not found'}</div>;
  }

  const totalPrice = ride.pricePerSeat * selectedSeats;
  const currentUserId = user?.id || user?._id || '';
  const driverUserId = ride.driver.id || ride.driver._id || '';
  const isDriverOwner = Boolean(currentUserId && driverUserId && currentUserId === driverUserId);
  const canRequestBooking = ride.availableSeats > 0 && ['scheduled', 'ongoing'].includes(ride.status || 'scheduled');

  return (
    <div className="relative min-h-screen bg-transparent pb-28">
      {/* Header */}
      <div className="glass-panel mx-4 mt-4 px-6 py-4 rounded-3xl sticky top-2 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/90">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl text-white">Ride Details</h1>
        </div>
      </div>

      <div className="px-6 pt-4">
        <LiveRideMap ride={ride} currentUserId={currentUserId} isDriver={isDriverOwner} />
      </div>

      <div className="px-6 py-6 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl">
              {ride.driver.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg text-white">{ride.driver.name}</h2>
                {ride.driver.isVerified ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Verified ✓</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-100">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{ride.driver.rating}</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/chat/${ride._id}`)}
              className="p-3 bg-white/20 text-white rounded-xl"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl p-4"
        >
          <h3 className="text-base mb-3 text-white">Route</h3>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <div className="w-0.5 h-12 bg-gray-300" />
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-base text-white">{ride.fromCity}</div>
                <div className="text-sm text-slate-100">
                  {new Date(ride.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  at {ride.time}
                </div>
              </div>
              <div>
                <div className="text-base text-white">{ride.toCity}</div>
                <div className="text-sm text-slate-100">
                  Price ${ride.pricePerSeat} per seat
                </div>
                {(ride.distanceText || ride.durationText) && (
                  <div className="text-xs text-slate-200 mt-1">
                    {ride.distanceText || 'Distance unavailable'}
                    {ride.durationText ? ` • ${ride.durationText}` : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl p-4"
        >
          <h3 className="text-base mb-3 text-white">Select Seats</h3>
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-100">Number of seats</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
                disabled={selectedSeats === 1}
                className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center disabled:opacity-50"
              >
                -
              </button>
              <span className="text-xl w-8 text-center text-white">{selectedSeats}</span>
              <button
                onClick={() =>
                  setSelectedSeats(Math.min(ride.availableSeats, selectedSeats + 1))
                }
                disabled={selectedSeats === ride.availableSeats}
                className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            {Array.from({ length: ride.totalSeats }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-16 rounded-xl flex items-center justify-center ${
                  i < ride.totalSeats - ride.availableSeats
                    ? 'bg-gray-300'
                    : i < ride.totalSeats - ride.availableSeats + selectedSeats
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/20 text-white/90'
                }`}
              >
                <Users className="w-6 h-6" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-200 mt-2 text-center">
            {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''} available
          </p>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="absolute bottom-0 left-0 right-0 mx-3 mb-3 rounded-2xl glass-panel px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-slate-100">Total Price</div>
            <div className="text-2xl text-blue-600">${totalPrice}</div>
          </div>
          <button
            onClick={() => navigate(`/booking/${ride._id}?seats=${selectedSeats}`)}
            disabled={!canRequestBooking}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-lg shadow-blue-600/30 disabled:opacity-50"
          >
            {canRequestBooking ? 'Request Booking' : 'Ride Closed'}
          </button>
        </div>
      </div>
    </div>
  );
}
