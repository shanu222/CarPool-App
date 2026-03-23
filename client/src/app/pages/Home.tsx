import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Search, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Ride } from '../types';
import { RideCard } from '../components/RideCard';
import { pakistanCities } from '../../data/pakistanCities';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { toast } from 'sonner';

interface NearbyRideResponse {
  nearbyRides: Ride[];
  liveRides: Ride[];
  nearbyWindowRides?: Ride[];
  scheduledRides: Ride[];
}

type DriverHomeTab = 'offer' | 'live' | 'nearby' | 'scheduled' | 'search';
type PassengerHomeTab = 'search' | 'request' | 'live' | 'nearby' | 'scheduled';

export function Home() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [nearbyRides, setNearbyRides] = useState<Ride[]>([]);
  const [liveRides, setLiveRides] = useState<Ride[]>([]);
  const [scheduledRides, setScheduledRides] = useState<Ride[]>([]);
  const [nearbyError, setNearbyError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDriver = user?.role === 'driver';
  const isPassenger = user?.role === 'passenger';
  const [driverTab, setDriverTab] = useState<DriverHomeTab>('live');
  const [passengerTab, setPassengerTab] = useState<PassengerHomeTab>('search');

  const handleSearch = () => {
    navigate('/search?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&date=' + date);
  };

  useEffect(() => {
    const fetchNearby = async (lat: number, lng: number) => {
      try {
        await api.post('/api/user/location', { lat, lng });
        const response = await api.get<NearbyRideResponse>('/api/rides/nearby', {
          params: { lat, lng },
        });
        setNearbyRides(response.data.nearbyRides || []);
        setLiveRides(response.data.liveRides || []);
        setScheduledRides(response.data.scheduledRides || []);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Could not load nearby rides';
        setNearbyError(message);
        if (message === 'Only Pakistani cities allowed') {
          toast.error('Please enter a valid Pakistani city');
        }
      }
    };

    if (!navigator.geolocation) {
      setNearbyError('Geolocation is not supported in this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchNearby(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setNearbyError('Allow location access to discover nearby rides');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const nearbyTop = useMemo(() => nearbyRides.slice(0, 3), [nearbyRides]);

  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden">
      <div className="glass-panel mx-3 mt-3 rounded-3xl px-4 pb-4 pt-8 md:mx-4 md:mt-4 md:px-6 md:pb-6 md:pt-12">
        <h1 className="mb-2 text-lg md:text-2xl text-white">Welcome back! 👋</h1>
        <p className="text-sm md:text-base text-slate-200">Discover rides and routes near your location</p>
      </div>

      <div className="px-3 py-4 md:px-5 md:py-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {isDriver ? (
            <>
              <button onClick={() => setDriverTab('offer')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'offer' ? 'bg-green-600 text-white' : 'bg-white/20 text-white'}`}>Offer Ride</button>
              <button onClick={() => setDriverTab('live')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'live' ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white'}`}>Live Rides</button>
              <button onClick={() => setDriverTab('nearby')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'nearby' ? 'bg-amber-600 text-white' : 'bg-white/20 text-white'}`}>Nearby Rides</button>
              <button onClick={() => setDriverTab('scheduled')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'scheduled' ? 'bg-sky-600 text-white' : 'bg-white/20 text-white'}`}>Scheduled Rides</button>
              <button onClick={() => setDriverTab('search')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${driverTab === 'search' ? 'bg-blue-600 text-white' : 'bg-white/20 text-white'}`}>Search Rides</button>
            </>
          ) : null}

          {isPassenger ? (
            <>
              <button onClick={() => setPassengerTab('search')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'search' ? 'bg-blue-600 text-white' : 'bg-white/20 text-white'}`}>Search Rides</button>
              <button onClick={() => setPassengerTab('request')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'request' ? 'bg-indigo-600 text-white' : 'bg-white/20 text-white'}`}>Request Ride</button>
              <button onClick={() => setPassengerTab('live')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'live' ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white'}`}>Live Rides</button>
              <button onClick={() => setPassengerTab('nearby')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'nearby' ? 'bg-amber-600 text-white' : 'bg-white/20 text-white'}`}>Nearby Rides</button>
              <button onClick={() => setPassengerTab('scheduled')} className={`rounded-xl px-4 py-3 text-sm min-h-12 ${passengerTab === 'scheduled' ? 'bg-sky-600 text-white' : 'bg-white/20 text-white'}`}>Scheduled Rides</button>
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

        {isPassenger && (passengerTab === 'search' || passengerTab === 'request') ? (
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

            <button
              onClick={() => (passengerTab === 'request' ? navigate('/post-request') : handleSearch())}
              disabled={!from || !to || !date}
              className="responsive-action w-full rounded-2xl bg-blue-600 py-3 md:py-4 text-white shadow-lg shadow-blue-600/30 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="mr-2 inline-block h-5 w-5" />
              {passengerTab === 'request' ? 'Create Ride Request' : 'Search Rides'}
            </button>
          </motion.div>
        ) : (
          <div className="glass-panel rounded-3xl p-3 md:p-5 text-sm md:text-base text-slate-100">
            Nearby marketplace is active. Pay to unlock interaction when needed.
          </div>
        )}

        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-2 text-sm md:text-base text-slate-200">Nearby Rides</h2>
            {(isDriver ? driverTab === 'nearby' : passengerTab === 'nearby') && nearbyTop.length > 0 ? (
              <div className="space-y-3">
                {nearbyTop.map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">
                {(isDriver ? driverTab === 'nearby' : passengerTab === 'nearby') ? (nearbyError || 'No nearby rides in a 50km radius yet.') : 'Select Nearby tab to view these rides.'}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm md:text-base text-emerald-200">Live Rides</h2>
            {(isDriver ? driverTab === 'live' : passengerTab === 'live') && liveRides.length > 0 ? (
              <div className="space-y-3">
                {liveRides.slice(0, 3).map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">{(isDriver ? driverTab === 'live' : passengerTab === 'live') ? 'No live rides nearby.' : 'Select Live tab to view these rides.'}</div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm md:text-base text-sky-200">Scheduled Rides</h2>
            {(isDriver ? driverTab === 'scheduled' : passengerTab === 'scheduled') && scheduledRides.length > 0 ? (
              <div className="space-y-3">
                {scheduledRides.slice(0, 3).map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">{(isDriver ? driverTab === 'scheduled' : passengerTab === 'scheduled') ? 'No scheduled rides nearby.' : 'Select Scheduled tab to view these rides.'}</div>
            )}
          </section>
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
