import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Users, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { Booking, Ride } from '../types';

export function MyTrips() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'passenger' | 'driver'>('passenger');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        setLoading(true);
        const [bookingResponse, rideResponse] = await Promise.all([
          api.get<Booking[]>('/api/bookings/my'),
          api.get<Ride[]>('/api/rides/my').catch(() => ({ data: [] as Ride[] })),
        ]);

        setBookings(bookingResponse.data);
        setDriverRides(rideResponse.data);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6">
        <h1 className="text-3xl mb-1">My Trips</h1>
        <p className="text-gray-600">View and manage your bookings</p>
      </div>

      {/* Tabs */}
      <div className="bg-white px-6 pb-4 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('passenger')}
            className={`flex-1 py-3 rounded-xl transition-all ${
              activeTab === 'passenger'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            As Passenger
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`flex-1 py-3 rounded-xl transition-all ${
              activeTab === 'driver'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            As Driver
          </button>
        </div>
      </div>

      {loading && <div className="px-6 py-4 text-sm text-gray-600">Loading trips...</div>}

      <div className="px-6 py-4 space-y-3">
        {!loading && activeTab === 'passenger' && bookings.length > 0
          ? bookings.map((trip) => (
              <TripCard
                key={trip._id}
                trip={trip}
                onClick={() => navigate(`/ride/${trip.ride._id}`)}
              />
            ))
          : null}

        {!loading && activeTab === 'driver' && driverRides.length > 0
          ? driverRides.map((ride) => (
              <DriverTripCard key={ride._id} ride={ride} onClick={() => navigate(`/ride/${ride._id}`)} />
            ))
          : null}

        {!loading && ((activeTab === 'passenger' && bookings.length === 0) || (activeTab === 'driver' && driverRides.length === 0)) ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl mb-2">No trips yet</h2>
            <p className="text-gray-600 mb-6">
              {activeTab === 'passenger'
                ? 'Book your first ride to get started'
                : 'Post a ride to start earning'}
            </p>
            <button
              onClick={() => navigate('/home')}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl"
            >
              {activeTab === 'passenger' ? 'Find a Ride' : 'Post a Ride'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface TripCardProps {
  trip: Booking;
  onClick: () => void;
}

function TripCard({ trip, onClick }: TripCardProps) {
  const navigate = useNavigate();
  const { ride } = trip;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer border border-gray-100"
    >
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`px-3 py-1 rounded-full text-xs ${
            trip.status === 'booked'
              ? 'bg-blue-100 text-blue-600'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/chat/${ride._id}`);
          }}
          className="p-2 bg-gray-100 rounded-xl"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Route */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <div className="w-0.5 h-8 bg-gray-300" />
          <MapPin className="w-3 h-3 text-blue-600" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="text-sm">{ride.fromCity}</div>
            <div className="text-xs text-gray-500">
              {new Date(ride.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}{' '}
              at {ride.time}
            </div>
          </div>
          <div>
            <div className="text-sm">{ride.toCity}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
            {ride.driver.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="text-sm">{ride.driver.name}</div>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{trip.seatsBooked}</span>
          </div>
          <div className="text-blue-600">${trip.totalPrice}</div>
        </div>
      </div>
    </motion.div>
  );
}

function DriverTripCard({ ride, onClick }: { ride: Ride; onClick: () => void }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer border border-gray-100"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-600">Driver Ride</span>
        <span className="text-sm text-gray-500">{ride.date} {ride.time}</span>
      </div>
      <div className="text-base mb-2">{ride.fromCity} → {ride.toCity}</div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{ride.availableSeats}/{ride.totalSeats} seats left</span>
        <span className="text-blue-600">${ride.pricePerSeat}/seat</span>
      </div>
    </motion.div>
  );
}
