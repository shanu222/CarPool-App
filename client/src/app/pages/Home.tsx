import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Clock, Search, Plus, Users, Banknote } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Ride, RideRequest } from '../types';
import { RideCard } from '../components/RideCard';
import { pakistanCities } from '../../data/pakistanCities';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { toast } from 'sonner';
import { VerificationStatusBanner } from '../components/VerificationStatusBanner';

interface NearbyRideResponse {
  nearbyRides: Ride[];
  liveRides: Ride[];
  nearbyWindowRides?: Ride[];
  scheduledRides: Ride[];
}

const classifyRequestTime = (request: RideRequest) => {
  const explicit = String(request.timeClass || '').toLowerCase();
  if (explicit === 'live' || explicit === 'scheduled') {
    return explicit;
  }

  const parsed = new Date(request.dateTime);
  if (Number.isNaN(parsed.getTime())) {
    return 'scheduled';
  }

  return parsed <= new Date() ? 'live' : 'scheduled';
};

type DriverHomeTab = 'offer' | 'live' | 'scheduled' | 'search';
type PassengerHomeTab = 'search' | 'request' | 'live' | 'scheduled';

export function Home() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [seats, setSeats] = useState('1');
  const [price, setPrice] = useState('100');
  const [liveRides, setLiveRides] = useState<Ride[]>([]);
  const [scheduledRides, setScheduledRides] = useState<Ride[]>([]);
  const [driverLiveRequests, setDriverLiveRequests] = useState<RideRequest[]>([]);
  const [driverScheduledRequests, setDriverScheduledRequests] = useState<RideRequest[]>([]);
  const [ridesError, setRidesError] = useState('');
  const [requestsError, setRequestsError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const navigate = useNavigate();
  const { user, syncAccessSummary } = useAuth();
  const isDriver = user?.role === 'driver';
  const isPassenger = user?.role === 'passenger';
  const [driverTab, setDriverTab] = useState<DriverHomeTab>('live');
  const [passengerTab, setPassengerTab] = useState<PassengerHomeTab>('search');

  const isRequestTabSelected = isPassenger && passengerTab === 'request';
  const isSearchTabSelected = isDriver ? driverTab === 'search' : isPassenger && passengerTab === 'search';
  const isLiveTabSelected = isDriver ? driverTab === 'live' : passengerTab === 'live';
  const isScheduledTabSelected = isDriver ? driverTab === 'scheduled' : passengerTab === 'scheduled';
  const isSearchOrRequestTabSelected = isSearchTabSelected || isRequestTabSelected;

  const handleSearch = () => {
    navigate('/search?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&date=' + date + '&time=' + time);
  };

  const submitRideRequest = async () => {
    if (user?.role !== 'passenger') {
      setSubmitError('Passengers only');
      return;
    }

    if (!from || !to || !date || !time || !seats || !price) {
      setSubmitError('All fields are required');
      return;
    }

    try {
      setIsSubmittingRequest(true);
      setSubmitError('');

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });

      const dateTime = new Date(`${date}T${time}:00`).toISOString();

      const response = await api.post('/api/requests/create', {
        fromCity: from,
        toCity: to,
        fromCoordinates: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        toCoordinates: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        dateTime,
        seatsNeeded: Number(seats),
        preferredPrice: Number(price),
      });

      syncAccessSummary(response.data);

      toast.success('Ride request posted');
      setFrom('');
      setTo('');
      setDate('');
      setTime('');
      setSeats('1');
      setPrice('100');
      navigate('/trips');
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'Could not post request';
      syncAccessSummary(requestError?.response?.data);
      setSubmitError(message);
      if (message === 'Only Pakistani cities allowed') {
        toast.error('Please enter a valid Pakistani city');
      }
      if (message === 'Enable location access to post a nearby request') {
        toast.error(message);
      }
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handlePrimaryAction = () => {
    if (isRequestTabSelected) {
      submitRideRequest();
      return;
    }

    handleSearch();
  };

  useEffect(() => {
    const fetchHomeRides = async () => {
      try {
        const response = await api.get<NearbyRideResponse>('/api/rides/nearby');
        setLiveRides(response.data.liveRides || []);
        setScheduledRides(response.data.scheduledRides || []);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Could not load rides';
        setRidesError(message);
        if (message === 'Only Pakistani cities allowed') {
          toast.error('Please enter a valid Pakistani city');
        }
      }
    };

    fetchHomeRides();

    if (isDriver) {
      setDriverLiveRequests([]);
      setDriverScheduledRequests([]);
      setRequestsError('');
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const locationPayload = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            await api.post('/api/user/location', locationPayload);

            if (isDriver) {
              const requestResponse = await api.get<RideRequest[]>(
                `/api/requests/nearby?lat=${locationPayload.lat}&lng=${locationPayload.lng}`
              );

              const liveRequests = (requestResponse.data || []).filter((item) => classifyRequestTime(item) === 'live');
              const scheduledRequests = (requestResponse.data || []).filter(
                (item) => classifyRequestTime(item) === 'scheduled'
              );

              setDriverLiveRequests(liveRequests);
              setDriverScheduledRequests(scheduledRequests);
            }
          } catch {
            // Location sync is best-effort only; home rides list should still load.
            if (isDriver) {
              setRequestsError('Could not load nearby passenger requests.');
            }
          }
        },
        () => {
          // Ignore geolocation denial for the home feed.
          if (isDriver) {
            setRequestsError('Enable location to view nearby passenger requests.');
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [isDriver]);

  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden">
      <div className="glass-panel mx-3 mt-3 rounded-3xl px-4 pb-4 pt-8 md:mx-4 md:mt-4 md:px-6 md:pb-6 md:pt-12">
        <h1 className="mb-2 text-lg md:text-2xl text-white">Welcome back! 👋</h1>
        <p className="text-sm md:text-base text-slate-200">Discover rides and routes near your location</p>
      </div>

      <div className="px-3 py-4 md:px-5 md:py-5">
        {user ? (
          <div className="mb-4">
            <VerificationStatusBanner
              user={user}
              onVerifyNow={() => navigate('/profile')}
              onRenewCnic={() => navigate('/profile')}
              onRenewLicense={() => navigate('/profile')}
            />
          </div>
        ) : null}

        <div className="responsive-tabs mb-4">
          {isDriver ? (
            <>
              <button onClick={() => setDriverTab('offer')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'offer' ? 'bg-green-600 text-white' : 'bg-white/20 text-white'}`}>Post Ride</button>
              <button onClick={() => setDriverTab('live')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'live' ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white'}`}>Live Rides</button>
              <button onClick={() => setDriverTab('scheduled')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'scheduled' ? 'bg-sky-600 text-white' : 'bg-white/20 text-white'}`}>Scheduled Rides</button>
              <button onClick={() => setDriverTab('search')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'search' ? 'bg-blue-600 text-white' : 'bg-white/20 text-white'}`}>Search Rides</button>
            </>
          ) : null}

          {isPassenger ? (
            <>
              <button onClick={() => setPassengerTab('search')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'search' ? 'bg-blue-600 text-white' : 'bg-white/20 text-white'}`}>Search Rides</button>
              <button onClick={() => setPassengerTab('request')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'request' ? 'bg-indigo-600 text-white' : 'bg-white/20 text-white'}`}>Request Ride</button>
              <button onClick={() => setPassengerTab('live')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'live' ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white'}`}>Live Rides</button>
              <button onClick={() => setPassengerTab('scheduled')} className={`touch-btn rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'scheduled' ? 'bg-sky-600 text-white' : 'bg-white/20 text-white'}`}>Scheduled Rides</button>
            </>
          ) : null}
        </div>

        {isDriver && driverTab === 'offer' ? (
          <button
            onClick={() => navigate('/post-ride')}
            className="responsive-action mb-5 w-full rounded-2xl bg-green-600 py-3 md:py-4 text-white shadow-lg shadow-green-600/30"
          >
            <Plus className="mr-2 inline-block h-5 w-5" />
            Offer a Ride
          </button>
        ) : null}

        {isSearchOrRequestTabSelected ? (
          <motion.div
            key="find"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-3 md:p-5 space-y-4"
          >
            <CityAutocomplete
              label="From"
              value={from}
              onChange={setFrom}
              placeholder="City of departure"
              icon={<MapPin className="w-5 h-5 text-gray-400" />}
              cities={pakistanCities}
            />

            <CityAutocomplete
              label="To"
              value={to}
              onChange={setTo}
              placeholder="Destination city"
              icon={<MapPin className="w-5 h-5 text-blue-600" />}
              cities={pakistanCities}
            />

            <div>
                <label className="block text-sm mb-2 text-gray-700">Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
                <label className="block text-sm mb-2 text-gray-700">Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {isRequestTabSelected ? (
              <>
                <div>
                  <label className="block text-sm mb-2 text-gray-700">Seats Needed</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={seats}
                      onChange={(e) => setSeats(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">1 seat</option>
                      <option value="2">2 seats</option>
                      <option value="3">3 seats</option>
                      <option value="4">4 seats</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-gray-700">Price</label>
                  <div className="relative">
                    <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Price per seat"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

            <button
              onClick={handlePrimaryAction}
              disabled={!from || !to || !date || !time || isSubmittingRequest || (isRequestTabSelected && (!seats || !price))}
              className="responsive-action w-full rounded-2xl bg-blue-600 py-3 md:py-4 text-white shadow-lg shadow-blue-600/30 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="mr-2 inline-block h-5 w-5" />
              {isRequestTabSelected ? (isSubmittingRequest ? 'Posting...' : 'Create Ride Request') : 'Search Rides'}
            </button>
          </motion.div>
        ) : null}

        <div className="mt-6 space-y-6">
          {isLiveTabSelected ? (
            <section>
            <h2 className="mb-2 text-sm md:text-base text-emerald-200">Live Rides</h2>
            {liveRides.length > 0 ? (
              <div className="space-y-3">
                {liveRides.map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">{ridesError || 'No live rides available.'}</div>
            )}

            {isDriver ? (
              <>
                <h3 className="mt-4 mb-2 text-xs md:text-sm text-emerald-100">Live Passenger Requests</h3>
                {driverLiveRequests.length > 0 ? (
                  <div className="space-y-2">
                    {driverLiveRequests.map((request) => (
                      <DriverRequestCard key={request._id} request={request} onOpen={() => navigate(`/requests/${request._id}`)} />
                    ))}
                  </div>
                ) : (
                  <div className="glass-subtle rounded-2xl p-3 md:p-4 text-xs md:text-sm text-slate-100">
                    {requestsError || 'No live passenger requests available.'}
                  </div>
                )}
              </>
            ) : null}
          </section>
          ) : null}

          {isScheduledTabSelected ? (
            <section>
            <h2 className="mb-2 text-sm md:text-base text-sky-200">Scheduled Rides</h2>
            {scheduledRides.length > 0 ? (
              <div className="space-y-3">
                {scheduledRides.map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">{ridesError || 'No scheduled rides available.'}</div>
            )}

            {isDriver ? (
              <>
                <h3 className="mt-4 mb-2 text-xs md:text-sm text-sky-100">Scheduled Passenger Requests</h3>
                {driverScheduledRequests.length > 0 ? (
                  <div className="space-y-2">
                    {driverScheduledRequests.map((request) => (
                      <DriverRequestCard key={request._id} request={request} onOpen={() => navigate(`/requests/${request._id}`)} />
                    ))}
                  </div>
                ) : (
                  <div className="glass-subtle rounded-2xl p-3 md:p-4 text-xs md:text-sm text-slate-100">
                    {requestsError || 'No scheduled passenger requests available.'}
                  </div>
                )}
              </>
            ) : null}
          </section>
          ) : null}
        </div>

        <button
          onClick={() => navigate('/map')}
          className="responsive-action mt-5 w-full rounded-2xl bg-white/20 px-5 py-3 md:py-4 text-sm md:text-base text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-white/30"
        >
          Open Live Map
        </button>
      </div>
    </div>
  );
}

function DriverRequestCard({ request, onOpen }: { request: RideRequest; onOpen: () => void }) {
  const requestDate = new Date(request.dateTime);
  const dateText = Number.isNaN(requestDate.getTime()) ? request.dateTime : requestDate.toLocaleString();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-subtle w-full rounded-2xl border border-white/20 p-3 text-left"
    >
      <div className="text-sm text-white">{request.fromCity} → {request.toCity}</div>
      <div className="mt-1 text-xs text-slate-100">{dateText}</div>
      <div className="mt-1 text-xs text-slate-100">Seats needed: {request.seatsNeeded}</div>
    </button>
  );
}
