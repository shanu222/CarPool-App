import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Users, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { Booking, Ride } from '../types';
import { toast } from 'sonner';

export function MyTrips() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'passenger' | 'driver'>('passenger');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const [driverRequests, setDriverRequests] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        setLoading(true);
        const [bookingResponse, rideResponse, requestResponse] = await Promise.all([
          api.get<Booking[]>('/api/bookings/my'),
          api.get<Ride[]>('/api/rides/my').catch(() => ({ data: [] as Ride[] })),
          api.get<Booking[]>('/api/bookings/driver-requests').catch(() => ({ data: [] as Booking[] })),
        ]);

        setBookings(bookingResponse.data);
        setDriverRides(rideResponse.data);
        setDriverRequests(requestResponse.data);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, []);

  const refreshTrips = async () => {
    const [bookingResponse, rideResponse, requestResponse] = await Promise.all([
      api.get<Booking[]>('/api/bookings/my'),
      api.get<Ride[]>('/api/rides/my').catch(() => ({ data: [] as Ride[] })),
      api.get<Booking[]>('/api/bookings/driver-requests').catch(() => ({ data: [] as Booking[] })),
    ]);
    setBookings(bookingResponse.data);
    setDriverRides(rideResponse.data);
    setDriverRequests(requestResponse.data);
  };

  const updateRideStatus = async (rideId: string, status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled') => {
    try {
      await api.patch(`/api/rides/${rideId}/status`, { status });
      toast.success(`Ride marked as ${status}`);
      await refreshTrips();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update ride status');
    }
  };

  const respondToRequest = async (bookingId: string, action: 'accepted' | 'rejected') => {
    try {
      await api.patch(`/api/bookings/${bookingId}/respond`, { action });
      toast.success(`Request ${action}`);
      await refreshTrips();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not update request');
    }
  };

  const submitReview = async (trip: Booking) => {
    const ratingRaw = window.prompt('Rate driver (1-5)');
    const rating = Number(ratingRaw);

    if (!rating || rating < 1 || rating > 5) {
      toast.error('Please provide a rating between 1 and 5');
      return;
    }

    const reviewText = window.prompt('Optional review text') || '';

    try {
      await api.post('/api/reviews', {
        rideId: trip.ride._id,
        targetUserId: trip.ride.driver.id || trip.ride.driver._id,
        rating,
        reviewText,
      });
      toast.success('Review submitted');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not submit review');
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="glass-panel mx-4 mt-4 px-6 pt-12 pb-6 rounded-3xl">
        <h1 className="text-3xl mb-1 text-white">My Trips</h1>
        <p className="text-slate-200">View and manage your bookings</p>
      </div>

      {/* Tabs */}
      <div className="mx-4 mt-3 px-2 pb-1 glass-subtle rounded-2xl">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('passenger')}
            className={`tab-pill flex-1 py-3 rounded-xl ${activeTab === 'passenger' ? 'active' : ''}`}
          >
            As Passenger
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`tab-pill flex-1 py-3 rounded-xl ${activeTab === 'driver' ? 'active' : ''}`}
          >
            As Driver
          </button>
        </div>
      </div>

      {loading && <div className="px-6 py-4 text-sm text-slate-100">Loading trips...</div>}

      <div className="px-6 py-4 space-y-3">
        {!loading && activeTab === 'passenger' && bookings.length > 0
          ? bookings.map((trip) => (
              <TripCard
                key={trip._id}
                trip={trip}
                onRate={() => submitReview(trip)}
                onClick={() => navigate(`/ride/${trip.ride._id}`)}
              />
            ))
          : null}

        {!loading && activeTab === 'driver' && driverRides.length > 0
          ? driverRides.map((ride) => (
              <DriverTripCard
                key={ride._id}
                ride={ride}
                onClick={() => navigate(`/ride/${ride._id}`)}
                onStatusChange={updateRideStatus}
              />
            ))
          : null}

        {!loading && activeTab === 'driver' && driverRequests.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm text-slate-100">Booking Requests</h3>
            {driverRequests.map((request) => (
              <DriverRequestCard
                key={request._id}
                request={request}
                onRespond={respondToRequest}
              />
            ))}
          </div>
        ) : null}

        {!loading && ((activeTab === 'passenger' && bookings.length === 0) || (activeTab === 'driver' && driverRides.length === 0)) ? (
          <div className="glass-panel text-center py-12 rounded-3xl">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-12 h-12 text-white/80" />
            </div>
            <h2 className="text-xl mb-2 text-white">No trips yet</h2>
            <p className="text-slate-100 mb-6">
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
  onRate: () => void;
}

function TripCard({ trip, onClick, onRate }: TripCardProps) {
  const navigate = useNavigate();
  const { ride } = trip;

  const canChat = ['accepted', 'ongoing', 'completed'].includes(trip.status);
  const statusClass =
    trip.status === 'pending'
      ? 'bg-amber-100 text-amber-700'
      : trip.status === 'accepted'
      ? 'bg-blue-100 text-blue-600'
      : trip.status === 'rejected'
      ? 'bg-red-100 text-red-600'
      : trip.status === 'ongoing'
      ? 'bg-indigo-100 text-indigo-700'
      : trip.status === 'completed'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-600';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-panel rounded-2xl p-4 cursor-pointer"
    >
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`px-3 py-1 rounded-full text-xs ${statusClass}`}
        >
          {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/chat/${ride._id}`);
          }}
          disabled={!canChat}
          className="p-2 bg-white/20 rounded-xl text-white disabled:opacity-50"
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
            <div className="text-sm text-white">{ride.fromCity}</div>
            <div className="text-xs text-slate-100">
              {new Date(ride.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}{' '}
              at {ride.time}
            </div>
          </div>
          <div>
            <div className="text-sm text-white">{ride.toCity}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
            {ride.driver.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="text-sm text-white">{ride.driver.name}</div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-100">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{trip.seatsRequested || trip.seatsBooked}</span>
          </div>
          <div className="text-blue-600">${trip.totalPrice}</div>
        </div>
      </div>

      {ride.driver.maskedCnic ? (
        <div className="mt-2 text-xs text-slate-100">Driver CNIC: {ride.driver.maskedCnic}</div>
      ) : null}

      {trip.status === 'completed' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRate();
          }}
          className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-xs text-green-700"
        >
          Rate Driver
        </button>
      ) : null}
    </motion.div>
  );
}

function DriverTripCard({
  ride,
  onClick,
  onStatusChange,
}: {
  ride: Ride;
  onClick: () => void;
  onStatusChange: (rideId: string, status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled') => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-panel rounded-2xl p-4 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-600">Driver Ride</span>
        <span className="text-sm text-slate-100">{ride.date} {ride.time}</span>
      </div>
      <div className="text-base mb-2 text-white">{ride.fromCity} → {ride.toCity}</div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-100">{ride.availableSeats}/{ride.totalSeats} seats left</span>
        <span className="text-blue-600">${ride.pricePerSeat}/seat</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'scheduled');
          }}
          className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700"
        >
          Set Scheduled
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'ongoing');
          }}
          className="rounded-lg bg-blue-100 px-2 py-1 text-xs text-blue-700"
        >
          Start Ride
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'completed');
          }}
          className="rounded-lg bg-green-100 px-2 py-1 text-xs text-green-700"
        >
          Complete
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'cancelled');
          }}
          className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-700"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

function DriverRequestCard({
  request,
  onRespond,
}: {
  request: Booking;
  onRespond: (bookingId: string, action: 'accepted' | 'rejected') => void;
}) {
  const passenger = request.passengerId || request.user;

  return (
    <div className="glass-subtle rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">{passenger?.name || 'Passenger'}</p>
          <p className="text-xs text-slate-100">
            {(request.ride?.fromCity || '')} → {(request.ride?.toCity || '')}
          </p>
          <p className="text-xs text-slate-100">
            {request.seatsRequested || request.seatsBooked} seat(s) · {request.status}
          </p>
        </div>
        {request.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              onClick={() => onRespond(request._id, 'accepted')}
              className="rounded-lg bg-green-100 px-2 py-1 text-xs text-green-700"
            >
              Accept
            </button>
            <button
              onClick={() => onRespond(request._id, 'rejected')}
              className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-700"
            >
              Reject
            </button>
          </div>
        ) : (
          <span className="rounded-lg bg-white/20 px-2 py-1 text-xs text-white">{request.status}</span>
        )}
      </div>
    </div>
  );
}
