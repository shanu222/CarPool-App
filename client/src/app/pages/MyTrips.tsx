import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Users, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { Booking, MyRidesResponse, Ride } from '../types';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type MyRidesTab = 'ongoing' | 'scheduled';

const getRideStartDate = (ride?: Ride | null) => {
  if (!ride) {
    return null;
  }

  const candidate = ride.startTime || ride.dateTime || `${ride.date}T${ride.time}:00`;
  const parsed = new Date(candidate as string);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export function MyTrips() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverOngoingRides, setDriverOngoingRides] = useState<Ride[]>([]);
  const [driverScheduledRides, setDriverScheduledRides] = useState<Ride[]>([]);
  const [tab, setTab] = useState<MyRidesTab>('ongoing');
  const [loading, setLoading] = useState(true);

  const role = user?.role;

  const loadTrips = useCallback(async () => {
    if (!role || role === 'admin') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      if (role === 'passenger') {
        const response = await api.get<Booking[]>('/api/bookings/my');
        setBookings(response.data);
        setDriverOngoingRides([]);
        setDriverScheduledRides([]);
      }

      if (role === 'driver') {
        const response = await api.get<MyRidesResponse>('/api/rides/my');
        setDriverOngoingRides(response.data.ongoingRides || []);
        setDriverScheduledRides(response.data.scheduledRides || []);
        setBookings([]);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not load trips');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    const onTripsRefresh = () => {
      loadTrips();
    };

    window.addEventListener('trips:refresh', onTripsRefresh);
    return () => {
      window.removeEventListener('trips:refresh', onTripsRefresh);
    };
  }, [loadTrips]);

  const updateRideStatus = async (rideId: string, status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled') => {
    try {
      await api.patch(`/api/rides/${rideId}/status`, { status });
      toast.success(`Ride marked as ${status}`);
      await loadTrips();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update ride status');
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

  const showPassengerView = role === 'passenger';
  const showDriverView = role === 'driver';

  const passengerOngoingBookings = bookings.filter((trip) => {
    const start = getRideStartDate(trip.ride);
    if (!start) {
      return false;
    }

    return start <= new Date();
  });

  const passengerScheduledBookings = bookings.filter((trip) => {
    const start = getRideStartDate(trip.ride);
    if (!start) {
      return true;
    }

    return start > new Date();
  });

  const activePassengerTrips = tab === 'ongoing' ? passengerOngoingBookings : passengerScheduledBookings;
  const activeDriverTrips = tab === 'ongoing' ? driverOngoingRides : driverScheduledRides;

  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden">
      <div className="glass-panel mx-3 mt-3 rounded-3xl px-4 pb-4 pt-8 md:mx-4 md:mt-4 md:px-6 md:pb-6 md:pt-12">
        <h1 className="mb-1 text-lg md:text-2xl text-white">My Trips</h1>
        <p className="text-sm md:text-base text-slate-200">
          {showPassengerView ? 'Your booked rides' : showDriverView ? 'Your created rides' : 'View your rides'}
        </p>
        {(showPassengerView || showDriverView) ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTab('ongoing')}
              className={`tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'ongoing' ? 'active' : ''}`}
            >
              Ongoing
            </button>
            <button
              type="button"
              onClick={() => setTab('scheduled')}
              className={`tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'scheduled' ? 'active' : ''}`}
            >
              Scheduled
            </button>
          </div>
        ) : null}
      </div>

      {loading && <div className="px-3 py-4 text-sm text-slate-100 md:px-5">Loading trips...</div>}

      <div className="px-3 py-4 space-y-3 md:px-5">
        {!loading && showPassengerView && activePassengerTrips.length > 0
          ? activePassengerTrips.map((trip) => (
              <TripCard
                key={trip._id}
                trip={trip}
                canUseChat={Boolean(user?.canChat)}
                onRate={() => submitReview(trip)}
                onClick={() => navigate(`/ride/${trip.ride._id}`)}
              />
            ))
          : null}

        {!loading && showDriverView && activeDriverTrips.length > 0
          ? activeDriverTrips.map((ride) => (
              <DriverTripCard
                key={ride._id}
                ride={ride}
                onClick={() => navigate(`/ride/${ride._id}`)}
                onStatusChange={updateRideStatus}
              />
            ))
          : null}

        {!loading && showPassengerView && activePassengerTrips.length === 0 ? (
          <EmptyState
            title={tab === 'ongoing' ? 'No ongoing rides' : 'No scheduled rides'}
            subtitle={tab === 'ongoing' ? 'Your accepted rides will appear here after start time.' : 'Your upcoming bookings appear here.'}
            buttonText="Find a Ride"
            onClick={() => navigate('/home')}
          />
        ) : null}

        {!loading && showDriverView && activeDriverTrips.length === 0 ? (
          <EmptyState
            title={tab === 'ongoing' ? 'No ongoing rides' : 'No scheduled rides'}
            subtitle={tab === 'ongoing' ? 'Rides move here when start time arrives.' : 'Post a ride within 15 days to see it here.'}
            buttonText="Post a Ride"
            onClick={() => navigate('/post-ride')}
          />
        ) : null}

        {!loading && !showPassengerView && !showDriverView ? (
          <div className="glass-panel text-center py-12 rounded-3xl">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-12 h-12 text-white/80" />
            </div>
            <h2 className="text-xl mb-2 text-white">No trips available</h2>
            <p className="text-slate-100">Only passenger and driver accounts can view trips.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  subtitle: string;
  buttonText: string;
  onClick: () => void;
}

function EmptyState({ title, subtitle, buttonText, onClick }: EmptyStateProps) {
  return (
    <div className="glass-panel text-center py-10 md:py-12 rounded-3xl px-3 md:px-5">
      <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <Calendar className="w-12 h-12 text-white/80" />
      </div>
      <h2 className="text-lg md:text-xl mb-2 text-white">{title}</h2>
      <p className="text-sm md:text-base text-slate-100 mb-6">{subtitle}</p>
      <button onClick={onClick} className="responsive-action bg-blue-600 text-white px-6 py-3 rounded-2xl">
        {buttonText}
      </button>
    </div>
  );
}

interface TripCardProps {
  trip: Booking;
  canUseChat: boolean;
  onClick: () => void;
  onRate: () => void;
}

function TripCard({ trip, canUseChat, onClick, onRate }: TripCardProps) {
  const navigate = useNavigate();
  const { ride } = trip;

  const canChat = canUseChat && ['accepted', 'ongoing', 'completed'].includes(trip.status);
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
      className="glass-panel responsive-card rounded-xl shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-xs ${statusClass}`}>
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

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/30">
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
          className="mt-3 min-h-12 w-full md:w-auto rounded-lg bg-green-100 px-3 py-2 text-xs md:text-sm text-green-700"
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
      className="glass-panel responsive-card rounded-xl shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-600">Driver Ride</span>
        <span className="text-sm text-slate-100">
          {ride.date} {ride.time}
        </span>
      </div>
      <div className="text-base mb-2 text-white">
        {ride.fromCity} → {ride.toCity}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-100">
          {ride.availableSeats}/{ride.totalSeats} seats left
        </span>
        <span className="text-blue-600">${ride.pricePerSeat}/seat</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'scheduled');
          }}
          className="min-h-12 rounded-lg bg-slate-100 px-2 py-1 text-xs md:text-sm text-slate-700"
        >
          Set Scheduled
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'ongoing');
          }}
          className="min-h-12 rounded-lg bg-blue-100 px-2 py-1 text-xs md:text-sm text-blue-700"
        >
          Start Ride
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'completed');
          }}
          className="min-h-12 rounded-lg bg-green-100 px-2 py-1 text-xs md:text-sm text-green-700"
        >
          Complete
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(ride._id, 'cancelled');
          }}
          className="min-h-12 rounded-lg bg-red-100 px-2 py-1 text-xs md:text-sm text-red-700"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
