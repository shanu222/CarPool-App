import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { RideRequest } from '../types';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { UnlockInteractionModal } from '../components/UnlockInteractionModal';
import { toast } from 'sonner';

export function RideRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [error, setError] = useState('');
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    api
      .get<RideRequest>(`/api/requests/${id}`)
      .then((response) => setRequest(response.data))
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Could not load request'));
  }, [id]);

  const mapLink = useMemo(() => {
    if (!request) {
      return '#';
    }

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(request.fromCity)}&destination=${encodeURIComponent(request.toCity)}`;
  }, [request]);

  const acceptRequest = async () => {
    if (!id) {
      return;
    }

    if (!user?.isVerified || !user?.canChat) {
      setShowUnlock(true);
      return;
    }

    try {
      const response = await api.post(`/api/requests/${id}/accept`);
      const rideId = response?.data?.ride?._id;
      toast.success('Request matched successfully');
      if (rideId) {
        navigate(`/chat/${rideId}`);
      } else {
        navigate('/trips');
      }
    } catch (requestError: any) {
      toast.error(requestError?.response?.data?.message || 'Could not accept request');
    }
  };

  if (!request) {
    return <div className="p-6">{error || 'Loading request...'}</div>;
  }

  return (
    <div className="min-h-screen bg-transparent pb-24 px-6 pt-4">
      <div className="glass-panel rounded-3xl p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl bg-white/20 p-2 text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl text-white">Request Details</h1>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-white">{request.fromCity} → {request.toCity}</p>
          <p className="mt-1 text-xs text-slate-100">{new Date(request.dateTime).toLocaleString()} · {request.seatsNeeded} seats</p>
          <a
            href={mapLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white"
          >
            Open Route in Google Maps
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <h2 className="text-sm text-slate-100">Passenger Profile</h2>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-white">{request.passengerId?.name || 'Passenger'}</p>
            <VerifiedBadge isVerified={request.passengerId?.isVerified} />
          </div>
          <p className="text-xs text-slate-100">Rating: {request.passengerId?.rating ?? '-'}</p>
        </div>

        {!user?.isVerified || !user?.canChat ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Verify and pay to contact passenger
          </div>
        ) : null}

        <button
          onClick={acceptRequest}
          className="w-full rounded-2xl bg-green-600 py-3 text-white"
        >
          Accept Request
        </button>
      </div>

      <UnlockInteractionModal open={showUnlock} onClose={() => setShowUnlock(false)} />
    </div>
  );
}
