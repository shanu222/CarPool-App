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
  scheduledRides: Ride[];
}

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
          {isPassenger ? (
            <button
              onClick={() => navigate('/post-request')}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm text-white min-h-12"
            >
              Find Ride
            </button>
          ) : null}

          {isDriver ? (
            <button
              onClick={() => navigate('/post-ride')}
              className="rounded-xl bg-green-600 px-4 py-3 text-sm text-white min-h-12"
            >
              Offer Ride
            </button>
          ) : null}

          {isDriver ? (
            <button
              onClick={() => navigate('/ride-requests')}
              className="rounded-xl bg-white/20 px-4 py-3 text-sm text-white min-h-12"
            >
              Ride Requests
            </button>
          ) : null}
        </div>

        {isDriver ? (
          <button
            onClick={() => navigate('/post-ride')}
            className="responsive-action mb-5 w-full rounded-2xl bg-green-600 py-3 md:py-4 text-white shadow-lg shadow-green-600/30"
          >
            <Plus className="mr-2 inline-block h-5 w-5" />
            Offer a Ride
          </button>
        ) : null}

        {isPassenger ? (
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
              onClick={handleSearch}
              disabled={!from || !to || !date}
              className="responsive-action w-full rounded-2xl bg-blue-600 py-3 md:py-4 text-white shadow-lg shadow-blue-600/30 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="mr-2 inline-block h-5 w-5" />
              Search Rides
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
            {nearbyTop.length > 0 ? (
              <div className="space-y-3">
                {nearbyTop.map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">
                {nearbyError || 'No nearby rides in a 50km radius yet.'}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm md:text-base text-emerald-200">Live Rides</h2>
            {liveRides.length > 0 ? (
              <div className="space-y-3">
                {liveRides.slice(0, 3).map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">No live rides nearby.</div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm md:text-base text-sky-200">Scheduled Rides</h2>
            {scheduledRides.length > 0 ? (
              <div className="space-y-3">
                {scheduledRides.slice(0, 3).map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl p-3 md:p-5 text-xs md:text-sm text-slate-100">No scheduled rides nearby.</div>
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
