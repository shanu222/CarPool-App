import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Star, MapPin, Navigation, Users, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { Ride } from '../types';

export function RideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const routePreviewUrl = mapsApiKey
    ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(mapsApiKey)}&origin=${encodeURIComponent(
        ride.fromCity
      )}&destination=${encodeURIComponent(ride.toCity)}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl">Ride Details</h1>
        </div>
      </div>

      {/* Map Preview */}
      <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden">
        {routePreviewUrl ? (
          <iframe
            title="Route preview"
            src={routePreviewUrl}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Navigation className="w-12 h-12 text-blue-600 mx-auto mb-2" />
              <div className="text-sm text-gray-600">{ride.fromCity} to {ride.toCity}</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-6 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl">
              {ride.driver.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg">{ride.driver.name}</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{ride.driver.rating}</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/chat/${ride._id}`)}
              className="p-3 bg-blue-50 text-blue-600 rounded-xl"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <h3 className="text-base mb-3">Route</h3>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <div className="w-0.5 h-12 bg-gray-300" />
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-base">{ride.fromCity}</div>
                <div className="text-sm text-gray-500">
                  {new Date(ride.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  at {ride.time}
                </div>
              </div>
              <div>
                <div className="text-base">{ride.toCity}</div>
                <div className="text-sm text-gray-500">
                  Price ${ride.pricePerSeat} per seat
                </div>
                {(ride.distanceText || ride.durationText) && (
                  <div className="text-xs text-gray-500 mt-1">
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
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <h3 className="text-base mb-3">Select Seats</h3>
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">Number of seats</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
                disabled={selectedSeats === 1}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center disabled:opacity-50"
              >
                -
              </button>
              <span className="text-xl w-8 text-center">{selectedSeats}</span>
              <button
                onClick={() =>
                  setSelectedSeats(Math.min(ride.availableSeats, selectedSeats + 1))
                }
                disabled={selectedSeats === ride.availableSeats}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center disabled:opacity-50"
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
                    : 'bg-gray-100'
                }`}
              >
                <Users className="w-6 h-6" />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''} available
          </p>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-600">Total Price</div>
            <div className="text-2xl text-blue-600">${totalPrice}</div>
          </div>
          <button
            onClick={() => navigate(`/booking/${ride._id}?seats=${selectedSeats}`)}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-lg shadow-blue-600/30"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
