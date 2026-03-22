import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, SlidersHorizontal, TrendingDown, Clock } from 'lucide-react';
import { RideCard } from '../components/RideCard';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { Ride, RideSearchResponse } from '../types';

export function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<'price' | 'time' | 'rating'>('price');
  const [viewType, setViewType] = useState<'all' | 'live' | 'upcoming'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [liveRides, setLiveRides] = useState<Ride[]>([]);
  const [upcomingRides, setUpcomingRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const date = searchParams.get('date') || '';

  useEffect(() => {
    const fetchRides = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.get<RideSearchResponse>('/api/rides/search', {
          params: {
            from,
            to,
            date,
            type: viewType === 'all' ? undefined : viewType,
          },
        });

        setLiveRides(response.data.liveRides || []);
        setUpcomingRides(response.data.upcomingRides || []);
      } catch (requestError: any) {
        const apiMessage = requestError?.response?.data?.message;
        if (apiMessage === 'Passengers only') {
          setError('Switch to Passenger to search rides');
        } else {
          setError(apiMessage || 'Could not load rides');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, [from, to, date, viewType]);

  const sortRides = useMemo(() => (items: Ride[]) => {
    const copy = [...items];

    if (sortBy === 'price') {
      return copy.sort((a, b) => a.pricePerSeat - b.pricePerSeat);
    }

    if (sortBy === 'time') {
      return copy.sort((a, b) => a.time.localeCompare(b.time));
    }

    return copy.sort((a, b) => b.driver.rating - a.driver.rating);
  }, [sortBy]);

  const sortedLiveRides = useMemo(() => sortRides(liveRides), [liveRides, sortRides]);
  const sortedUpcomingRides = useMemo(() => sortRides(upcomingRides), [upcomingRides, sortRides]);
  const totalRides = sortedLiveRides.length + sortedUpcomingRides.length;

  return (
    <div className="min-h-screen bg-transparent pb-24">
      {/* Header */}
      <div className="glass-panel mx-4 mt-4 px-6 py-4 rounded-3xl">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate('/home')} className="p-2 -ml-2 text-white/90">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl text-white">{from || 'Any'} → {to || 'Any'}</h1>
            <p className="text-sm text-slate-200">
              {date ? new Date(date).toLocaleDateString('en-US', {
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              }) : 'All dates'}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="glass-subtle p-2 rounded-xl text-white"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Sort Options */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-wrap gap-2 pb-2"
          >
            <button
              onClick={() => setSortBy('price')}
              className={`tab-pill px-4 py-2 rounded-xl text-sm flex items-center gap-2 ${sortBy === 'price' ? 'active' : ''}`}
            >
              <TrendingDown className="w-4 h-4" />
              Lowest Price
            </button>
            <button
              onClick={() => setSortBy('time')}
              className={`tab-pill px-4 py-2 rounded-xl text-sm flex items-center gap-2 ${sortBy === 'time' ? 'active' : ''}`}
            >
              <Clock className="w-4 h-4" />
              Earliest
            </button>
            <button
              onClick={() => setViewType('all')}
              className={`tab-pill px-4 py-2 rounded-xl text-sm ${viewType === 'all' ? 'active' : ''}`}
            >
              All
            </button>
            <button
              onClick={() => setViewType('live')}
              className={`tab-pill px-4 py-2 rounded-xl text-sm ${viewType === 'live' ? 'active' : ''}`}
            >
              Live
            </button>
            <button
              onClick={() => setViewType('upcoming')}
              className={`tab-pill px-4 py-2 rounded-xl text-sm ${viewType === 'upcoming' ? 'active' : ''}`}
            >
              Upcoming
            </button>
          </motion.div>
        )}
      </div>

      {/* Results */}
      <div className="px-6 py-4 space-y-3">
        {loading && <p className="text-sm text-slate-100">Loading rides...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && totalRides > 0 ? (
          <>
            <p className="text-sm text-slate-100">
              {totalRides} ride{totalRides !== 1 ? 's' : ''} found
            </p>

            {sortedLiveRides.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm text-emerald-200">Live Rides</h3>
                {sortedLiveRides.map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : null}

            {sortedUpcomingRides.length > 0 ? (
              <div className="space-y-2 pt-2">
                <h3 className="text-sm text-sky-200">Upcoming Rides</h3>
                {sortedUpcomingRides.map((ride) => (
                  <RideCard key={ride._id} ride={ride} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && !error && totalRides === 0 ? (
          <div className="glass-panel text-center py-12 rounded-3xl">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="w-12 h-12 text-white/80" />
            </div>
            <h2 className="text-xl mb-2 text-white">No rides found</h2>
            <p className="text-slate-100 mb-6">
              Try another route/date or check back for live rides
            </p>
            <button
              onClick={() => navigate('/post-ride')}
              className="bg-white/85 text-slate-900 px-6 py-3 rounded-2xl transition-all duration-200 hover:bg-white"
            >
              Post Your Own Ride
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Car({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 17h14v4H5v-4zM3 11l3-7h12l3 7v6H3v-6zM9 17h6M7 11h10" />
    </svg>
  );
}
