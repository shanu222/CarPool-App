import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Users, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { handleAvatarError, toAvatarUrl } from '../lib/avatar';
import type { Booking, MatchedTrip, MyRidesResponse, Ride, RideRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { startRideChatAccess } from '../lib/chatAccess';
import { UnlockInteractionModal } from '../components/UnlockInteractionModal';
import { toast } from 'sonner';

type MyRidesTab = 'live' | 'scheduled' | 'matched' | 'expired' | 'cancelled' | 'completed';

export function MyTrips() {
  const navigate = useNavigate();
  const { user, syncAccessSummary } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [driverLiveRides, setDriverLiveRides] = useState<Ride[]>([]);
  const [driverScheduledRides, setDriverScheduledRides] = useState<Ride[]>([]);
  const [driverExpiredRides, setDriverExpiredRides] = useState<Ride[]>([]);
  const [driverCancelledRides, setDriverCancelledRides] = useState<Ride[]>([]);
  const [driverCompletedRides, setDriverCompletedRides] = useState<Ride[]>([]);
  const [matchedTrips, setMatchedTrips] = useState<MatchedTrip[]>([]);
  const [tab, setTab] = useState<MyRidesTab>('live');
  const [loading, setLoading] = useState(true);
  const [unlockRideId, setUnlockRideId] = useState<string | null>(null);

  const role = user?.role;

  const loadTrips = useCallback(async () => {
    if (!role || role === 'admin') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      if (role === 'passenger') {
        const [bookingResponse, requestResponse, matchedResponse] = await Promise.all([
          api.get<Booking[]>('/api/bookings/my'),
          api.get<RideRequest[]>('/api/requests/my'),
          api.get<MatchedTrip[]>('/api/matches/my?status=approved'),
        ]);
        setBookings(bookingResponse.data);
        setRequests(requestResponse.data);
        setMatchedTrips(matchedResponse.data || []);
        setDriverLiveRides([]);
        setDriverScheduledRides([]);
        setDriverExpiredRides([]);
        setDriverCancelledRides([]);
        setDriverCompletedRides([]);
      }

      if (role === 'driver') {
        const [response, matchedResponse] = await Promise.all([
          api.get<MyRidesResponse>('/api/rides/my'),
          api.get<MatchedTrip[]>('/api/matches/my?status=approved'),
        ]);
        setDriverLiveRides(response.data.liveRides || response.data.ongoingRides || []);
        setDriverScheduledRides(response.data.scheduledRides || []);
        setDriverExpiredRides(response.data.expiredRides || []);
        setDriverCancelledRides(response.data.cancelledRides || []);
        setDriverCompletedRides(response.data.completedRides || []);
        setMatchedTrips(matchedResponse.data || []);
        setBookings([]);
        setRequests([]);
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

  const updateRideStatus = async (rideId: string, status: 'scheduled' | 'nearby' | 'live' | 'completed' | 'cancelled') => {
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

  const confirmRide = async (trip: Booking) => {
    try {
      await api.patch(`/api/bookings/${trip._id}/confirm`);
      toast.success('Ride confirmation updated');
      await loadTrips();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not confirm ride');
    }
  };

  const handleOpenChat = async (rideId?: string | null) => {
    const normalizedRideId = String(rideId || '').trim();

    if (!normalizedRideId) {
      toast.error('Ride is required to open chat');
      return;
    }

    try {
      const response = await startRideChatAccess(normalizedRideId);

      if (!response.ok && response.insufficientTokens) {
        syncAccessSummary(response.payload);
        setUnlockRideId(normalizedRideId);
        return;
      }

      syncAccessSummary(response.payload);
      navigate(`/chat/${normalizedRideId}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not open chat');
    }
  };

  const showPassengerView = role === 'passenger';
  const showDriverView = role === 'driver';

  const matchedRideIds = new Set(
    (matchedTrips || [])
      .filter((item) => item.status === 'approved')
      .map((item) => String(item.rideId || item.ride?._id || ''))
      .filter(Boolean)
  );

  const passengerLiveBookings = bookings.filter(
    (trip) => trip.ride?.status === 'live' && !matchedRideIds.has(String(trip.ride?._id || trip.rideId || ''))
  );
  const passengerScheduledBookings = bookings.filter(
    (trip) => trip.ride?.status === 'scheduled' && !matchedRideIds.has(String(trip.ride?._id || trip.rideId || ''))
  );

  const passengerCompletedBookings = bookings.filter((trip) => {
    return trip.status === 'completed' || trip.ride?.status === 'completed';
  });
  const passengerCancelledBookings = bookings.filter((trip) => trip.status === 'cancelled' || trip.ride?.status === 'cancelled');
  const passengerExpiredBookings = bookings.filter((trip) => trip.ride?.status === 'expired');

  const passengerLiveRequests = requests.filter(
    (item) => item.timeClass === 'live' && !matchedRideIds.has(String(item.matchedRideId || ''))
  );
  const passengerScheduledRequests = requests.filter(
    (item) => item.timeClass === 'scheduled' && !matchedRideIds.has(String(item.matchedRideId || ''))
  );
  const passengerCompletedRequests = requests.filter((item) => item.timeClass === 'completed' || item.status === 'completed');
  const passengerCancelledRequests = requests.filter((item) => String(item.status || '').toLowerCase() === 'cancelled');
  const passengerExpiredRequests = requests.filter((item) => item.timeClass === 'expired' || item.status === 'expired');

  const activePassengerTrips =
    tab === 'live'
      ? passengerLiveBookings
      : tab === 'scheduled'
      ? passengerScheduledBookings
      : tab === 'matched'
      ? []
      : tab === 'expired'
      ? passengerExpiredBookings
      : tab === 'cancelled'
      ? passengerCancelledBookings
      : passengerCompletedBookings;
  const activePassengerRequests =
    tab === 'live'
      ? passengerLiveRequests
      : tab === 'scheduled'
      ? passengerScheduledRequests
      : tab === 'matched'
      ? []
      : tab === 'expired'
      ? passengerExpiredRequests
      : tab === 'cancelled'
      ? passengerCancelledRequests
      : passengerCompletedRequests;
  const activeMatchedTrips = tab === 'matched' ? matchedTrips.filter((item) => item.status === 'approved') : [];
  const activeDriverTrips =
    tab === 'live'
      ? driverLiveRides
      : tab === 'scheduled'
      ? driverScheduledRides.filter((ride) => !matchedRideIds.has(String(ride._id || '')))
      : tab === 'matched'
      ? []
      : tab === 'expired'
      ? driverExpiredRides
      : tab === 'cancelled'
      ? driverCancelledRides
      : driverCompletedRides;

  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden">
      <div className="glass-panel mx-3 mt-3 rounded-3xl px-4 pb-4 pt-8 md:mx-4 md:mt-4 md:px-6 md:pb-6 md:pt-12">
        <h1 className="mb-1 text-lg md:text-2xl text-white">My Trips</h1>
        <p className="text-sm md:text-base text-slate-200">
          {showPassengerView ? 'Your booked rides' : showDriverView ? 'Your created rides' : 'View your rides'}
        </p>
        {(showPassengerView || showDriverView) ? (
          <div className="responsive-tabs mt-4">
            <button
              type="button"
              onClick={() => setTab('live')}
              className={`touch-btn tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'live' ? 'active' : ''}`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setTab('scheduled')}
              className={`touch-btn tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'scheduled' ? 'active' : ''}`}
            >
              Scheduled
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={`touch-btn tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'completed' ? 'active' : ''}`}
            >
              Completed
            </button>
            <button
              type="button"
              onClick={() => setTab('cancelled')}
              className={`touch-btn tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'cancelled' ? 'active' : ''}`}
            >
              Cancelled
            </button>
            <button
              type="button"
              onClick={() => setTab('matched')}
              className={`touch-btn tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'matched' ? 'active' : ''}`}
            >
              Matched
            </button>
            <button
              type="button"
              onClick={() => setTab('expired')}
              className={`touch-btn tab-pill rounded-xl px-4 py-2 text-sm ${tab === 'expired' ? 'active' : ''}`}
            >
              Expired
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
                canUseChat={true}
                onOpenChat={handleOpenChat}
                onRate={() => submitReview(trip)}
                onConfirm={() => confirmRide(trip)}
                onReschedule={() =>
                  navigate('/request-ride', {
                    state: {
                      fromCity: trip.ride?.fromCity,
                      toCity: trip.ride?.toCity,
                      dateTime: trip.ride?.dateTime,
                      seatsNeeded: trip.seatsBooked || trip.seatsRequested,
                    },
                  })
                }
                onClick={() => navigate(`/ride/${trip.ride._id}`)}
              />
            ))
          : null}

        {!loading && showPassengerView && activePassengerRequests.length > 0
          ? activePassengerRequests.map((request) => (
              <RequestTripCard
                key={request._id}
                request={request}
                onReschedule={() =>
                  navigate('/request-ride', {
                    state: {
                      fromCity: request.fromCity,
                      toCity: request.toCity,
                      dateTime: request.dateTime,
                      seatsNeeded: request.seatsNeeded,
                    },
                  })
                }
                onClick={() => (request.matchedRideId ? navigate(`/ride/${request.matchedRideId}`) : navigate('/home'))}
              />
            ))
          : null}

        {!loading && activeMatchedTrips.length > 0
          ? activeMatchedTrips.map((match) => (
              <MatchedTripCard
                key={match._id}
                match={match}
                onOpenRide={() => navigate(`/ride/${match.rideId}`)}
                onOpenChat={() => handleOpenChat(match.rideId)}
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
                onReschedule={() =>
                  navigate('/post-ride', {
                    state: {
                      fromCity: ride.fromCity,
                      toCity: ride.toCity,
                      date: ride.date,
                      time: ride.time,
                      pricePerSeat: ride.pricePerSeat,
                      totalSeats: ride.totalSeats,
                    },
                  })
                }
              />
            ))
          : null}

        {!loading && showPassengerView && activePassengerTrips.length === 0 && activePassengerRequests.length === 0 && activeMatchedTrips.length === 0 ? (
          <EmptyState
            title={tab === 'live' ? 'No live rides' : tab === 'scheduled' ? 'No scheduled rides' : tab === 'matched' ? 'No matched rides' : tab === 'expired' ? 'No expired rides' : tab === 'cancelled' ? 'No cancelled rides' : 'No completed rides'}
            subtitle={tab === 'live' ? 'Your live joined/requested rides appear here.' : tab === 'scheduled' ? 'Your future rides appear here.' : tab === 'matched' ? 'Once both users approve, rides move to this tab.' : tab === 'expired' ? 'Ride expired. No match found. Please reschedule.' : tab === 'cancelled' ? 'Cancelled rides appear here.' : 'Your ride history will appear here after completion.'}
            buttonText="Find a Ride"
            onClick={() => navigate('/home')}
          />
        ) : null}

        {!loading && showDriverView && activeDriverTrips.length === 0 && activeMatchedTrips.length === 0 ? (
          <EmptyState
            title={tab === 'live' ? 'No live rides' : tab === 'scheduled' ? 'No scheduled rides' : tab === 'matched' ? 'No matched rides' : tab === 'expired' ? 'No expired rides' : tab === 'cancelled' ? 'No cancelled rides' : 'No completed rides'}
            subtitle={tab === 'live' ? 'Live rides with ongoing trips appear here.' : tab === 'scheduled' ? 'Post a ride within 15 days to see it here.' : tab === 'matched' ? 'Once both users approve, rides move to this tab.' : tab === 'expired' ? 'Ride expired. No match found. Please reschedule.' : tab === 'cancelled' ? 'Cancelled rides appear here.' : 'Completed rides appear here as history.'}
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

      <UnlockInteractionModal
        open={Boolean(unlockRideId)}
        rideId={unlockRideId || undefined}
        onClose={() => setUnlockRideId(null)}
      />
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
  onOpenChat: (rideId?: string | null) => void;
  onClick: () => void;
  onRate: () => void;
  onConfirm: () => void;
  onReschedule: () => void;
}

function TripCard({ trip, canUseChat, onOpenChat, onClick, onRate, onConfirm, onReschedule }: TripCardProps) {
  const { ride } = trip;

  const canChat = canUseChat && ride?.status === 'live' && ['accepted', 'booked'].includes(trip.status);
  const statusClass =
    trip.status === 'pending'
      ? 'bg-amber-100 text-amber-700'
      : trip.status === 'accepted'
      ? 'bg-blue-100 text-blue-600'
      : trip.status === 'booked'
      ? 'bg-emerald-100 text-emerald-700'
      : trip.status === 'rejected'
      ? 'bg-red-100 text-red-600'
      : trip.status === 'ongoing'
      ? 'bg-indigo-100 text-indigo-700'
      : trip.status === 'completed'
      ? 'bg-slate-200 text-slate-700'
      : trip.ride?.status === 'expired'
      ? 'bg-red-100 text-red-700'
      : trip.status === 'cancelled' || trip.ride?.status === 'cancelled'
      ? 'bg-red-100 text-red-700'
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
            onOpenChat(ride?._id);
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
          <img
            src={toAvatarUrl(ride.driver.profilePhoto)}
            alt={ride.driver.name}
            loading="lazy"
            onError={handleAvatarError}
            className="w-8 h-8 rounded-full border border-white/70 object-cover shadow-sm"
          />
          <div className="text-sm text-white">{ride.driver.name}</div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-100">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{trip.seatsRequested || trip.seatsBooked}</span>
          </div>
          <div className="text-blue-600">PKR {trip.totalPrice}</div>
        </div>
      </div>

      {ride.driver.maskedCnic ? (
        <div className="mt-2 text-xs text-slate-100">Driver CNIC: {ride.driver.maskedCnic}</div>
      ) : null}

      {trip.status === 'completed' ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            History: {ride.fromCity} → {ride.toCity} • {ride.date} {ride.time} • {ride.driver.name} • Rating {ride.driver.rating || 0}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRate();
            }}
            className="min-h-12 w-full md:w-auto rounded-lg bg-green-100 px-3 py-2 text-xs md:text-sm text-green-700"
          >
            Rate Driver
          </button>
        </div>
      ) : null}

      {(trip.status === 'accepted' || trip.status === 'booked') && !trip.passengerConfirm ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          className="mt-3 min-h-12 w-full md:w-auto rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700"
        >
          Confirm Ride
        </button>
      ) : null}

      {(trip.passengerConfirm || trip.driverConfirm) ? (
        <div className="mt-2 text-xs text-slate-100">
          Confirmation: Passenger {trip.passengerConfirm ? 'Yes' : 'No'} • Driver {trip.driverConfirm ? 'Yes' : 'No'}
        </div>
      ) : null}

      {trip.ride?.status === 'expired' ? (
        <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700">
          {trip.ride.expiredReason || 'Ride expired. No match found. Please reschedule.'}
        </div>
      ) : null}

      {trip.ride?.status === 'expired' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReschedule();
          }}
          className="mt-3 min-h-12 w-full md:w-auto rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700"
        >
          Reschedule Ride
        </button>
      ) : null}
    </motion.div>
  );
}

function DriverTripCard({
  ride,
  onClick,
  onStatusChange,
  onReschedule,
}: {
  ride: Ride;
  onClick: () => void;
  onStatusChange: (rideId: string, status: 'scheduled' | 'nearby' | 'live' | 'completed' | 'cancelled') => void;
  onReschedule: () => void;
}) {
  const driverStatusBadge =
    ride.status === 'completed'
      ? 'bg-slate-200 text-slate-700'
      : ride.status === 'live'
      ? 'bg-indigo-100 text-indigo-700'
      : ride.status === 'nearby'
      ? 'bg-blue-100 text-blue-700'
      : ride.status === 'cancelled'
      ? 'bg-red-100 text-red-700'
      : ride.status === 'expired'
      ? 'bg-red-100 text-red-700'
      : 'bg-green-100 text-green-600';

  const isScheduledRide = ride.status === 'scheduled' || ride.status === 'nearby';
  const isLiveRide = ride.status === 'live';
  const showActionButtons = isScheduledRide || isLiveRide;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-panel responsive-card rounded-xl shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-xs ${driverStatusBadge}`}>
          {ride.status ? ride.status.charAt(0).toUpperCase() + ride.status.slice(1) : 'Driver Ride'}
        </span>
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
        <span className="text-blue-600">PKR {ride.pricePerSeat}/seat</span>
      </div>
      {showActionButtons ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          {isScheduledRide ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(ride._id, 'live');
              }}
              className="min-h-12 rounded-lg bg-blue-100 px-2 py-1 text-xs md:text-sm text-blue-700"
            >
              Start Ride
            </button>
          ) : null}

          {isLiveRide ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(ride._id, 'completed');
              }}
              className="min-h-12 rounded-lg bg-green-100 px-2 py-1 text-xs md:text-sm text-green-700"
            >
              Complete
            </button>
          ) : null}

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
      ) : null}
      {ride.status === 'completed' ? (
        <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
          History: {ride.fromCity} → {ride.toCity} • {ride.date} {ride.time} • {ride.driver.name} • Rating {ride.driver.rating || 0}
        </div>
      ) : null}

      {ride.status === 'expired' ? (
        <>
          <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700">
            {ride.expiredReason || 'Ride expired. No match found. Please reschedule.'}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReschedule();
            }}
            className="mt-3 min-h-12 w-full md:w-auto rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700"
          >
            Reschedule Ride
          </button>
        </>
      ) : null}
    </motion.div>
  );
}

function RequestTripCard({
  request,
  onClick,
  onReschedule,
}: {
  request: RideRequest;
  onClick: () => void;
  onReschedule: () => void;
}) {
  const statusText = request.status.charAt(0).toUpperCase() + request.status.slice(1);
  const requestDate = new Date(request.dateTime);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-panel responsive-card rounded-xl shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-700">Requested</span>
        <span className="text-xs text-slate-100">{statusText}</span>
      </div>
      <div className="text-base mb-2 text-white">
        {request.fromCity} → {request.toCity}
      </div>
      <div className="text-sm text-slate-100">
        {Number.isNaN(requestDate.getTime()) ? request.dateTime : requestDate.toLocaleString()}
      </div>

      {request.status === 'expired' ? (
        <>
          <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700">
            {request.expiredReason || 'Ride expired. No match found. Please reschedule.'}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReschedule();
            }}
            className="mt-3 min-h-12 w-full md:w-auto rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700"
          >
            Reschedule Ride
          </button>
        </>
      ) : null}
    </motion.div>
  );
}

function MatchedTripCard({
  match,
  onOpenRide,
  onOpenChat,
}: {
  match: MatchedTrip;
  onOpenRide: () => void;
  onOpenChat: () => void;
}) {
  const ride = match.ride;

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onOpenRide} className="glass-panel responsive-card rounded-xl shadow-md cursor-pointer">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">Matched</span>
        <span className="text-xs text-slate-100">{ride?.date || ''} {ride?.time || ''}</span>
      </div>

      <div className="mb-2 text-base text-white">
        {ride?.fromCity || 'Unknown'} → {ride?.toCity || 'Unknown'}
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-lg bg-white/10 px-3 py-3">
        <img
          src={toAvatarUrl(match.otherUser?.profileImage)}
          alt={match.otherUser?.name || 'User'}
          loading="lazy"
          onError={handleAvatarError}
          className="h-10 w-10 rounded-full border border-white/70 object-cover shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-white">{match.otherUser?.name || 'Unknown User'}</div>
          {match.otherUser?.mobile ? (
            <a
              href={`tel:${match.otherUser.mobile}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-emerald-300 underline"
            >
              {match.otherUser.mobile}
            </a>
          ) : (
            <div className="text-xs text-slate-200">Contact hidden until approval</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat();
          }}
          className="min-h-12 rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700"
        >
          Open Chat
        </button>
      </div>
    </motion.div>
  );
}
