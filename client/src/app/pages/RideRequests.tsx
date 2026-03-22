import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { RideRequest } from '../types';

export function RideRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [error, setError] = useState('');

  const loadRequests = (lat: number, lng: number) => {
    api
      .get<RideRequest[]>('/api/requests/nearby', {
        params: {
          lat,
          lng,
          fromCity: fromFilter || undefined,
          toCity: toFilter || undefined,
        },
      })
      .then((response) => setRequests(response.data))
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Could not load requests'));
  };

  const refresh = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => loadRequests(position.coords.latitude, position.coords.longitude),
      () => setError('Allow location access to load nearby requests'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (user?.role === 'driver') {
      refresh();
    }
  }, [user?.role, fromFilter, toFilter]);

  const sorted = useMemo(() => [...requests].sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0)), [requests]);

  return (
    <div className="min-h-screen bg-transparent pb-24 px-3 pt-3 md:px-5 md:pt-5 overflow-x-hidden">
      <div className="glass-panel rounded-3xl p-3 md:p-5">
        <h1 className="text-lg md:text-2xl text-white">Ride Requests</h1>
        <p className="text-sm md:text-base text-slate-100">Nearby passenger demand</p>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={fromFilter}
          onChange={(event) => setFromFilter(event.target.value)}
          placeholder="Filter from city"
          className="min-h-12 rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm md:text-base text-white"
        />
        <input
          value={toFilter}
          onChange={(event) => setToFilter(event.target.value)}
          placeholder="Filter to city"
          className="min-h-12 rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm md:text-base text-white"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {sorted.map((request) => (
          <button
            key={request._id}
            onClick={() => navigate(`/requests/${request._id}`)}
            className="w-full rounded-xl shadow-md glass-panel p-3 md:p-5 text-left"
          >
            <div className="flex items-center justify-between">
              <p className="text-white">{request.fromCity} → {request.toCity}</p>
              <span className="text-xs text-sky-200">{request.distanceKm ?? '-'} km</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs md:text-sm text-slate-100">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(request.dateTime).toLocaleString()}</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{request.seatsNeeded} seats</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{request.status}</span>
            </div>
          </button>
        ))}

        {sorted.length === 0 ? (
          <div className="rounded-xl glass-subtle p-3 md:p-5 text-sm md:text-base text-slate-100">No nearby requests found.</div>
        ) : null}
      </div>
    </div>
  );
}
