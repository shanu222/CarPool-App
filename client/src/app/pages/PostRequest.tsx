import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, MapPin, Calendar, Clock, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export function PostRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fromCity: '',
    toCity: '',
    date: '',
    time: '',
    seatsNeeded: '1',
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const submitRequest = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          setLoading(true);
          setError('');
          const dateTime = new Date(`${formData.date}T${formData.time}:00`).toISOString();

          await api.post('/api/requests/create', {
            fromCity: formData.fromCity,
            toCity: formData.toCity,
            fromCoordinates: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            toCoordinates: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            dateTime,
            seatsNeeded: Number(formData.seatsNeeded),
          });

          toast.success('Ride request posted');
          navigate('/trips');
        } catch (requestError: any) {
          setError(requestError?.response?.data?.message || 'Could not post request');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Enable location access to post a nearby request');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (user?.role !== 'passenger') {
      setError('Passengers only');
      return;
    }

    if (!formData.fromCity || !formData.toCity || !formData.date || !formData.time) {
      setError('All fields are required');
      return;
    }

    submitRequest();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl">Find Ride</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="text-base">Route Details</h3>

          <div>
            <label className="block text-sm mb-2 text-gray-700">From</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={formData.fromCity}
                onChange={(e) => updateField('fromCity', e.target.value)}
                placeholder="Departure city"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">To</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
              <input
                value={formData.toCity}
                onChange={(e) => updateField('toCity', e.target.value)}
                placeholder="Destination city"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="text-base">Departure</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-700">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => updateField('time', e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Seats Needed</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={formData.seatsNeeded}
                onChange={(e) => updateField('seatsNeeded', e.target.value)}
                className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                <option value="1">1 seat</option>
                <option value="2">2 seats</option>
                <option value="3">3 seats</option>
                <option value="4">4 seats</option>
              </select>
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-blue-600 py-4 text-white shadow-lg shadow-blue-600/30 disabled:opacity-50"
        >
          {loading ? 'Posting...' : 'Post Ride Request'}
        </button>
      </form>
    </div>
  );
}
