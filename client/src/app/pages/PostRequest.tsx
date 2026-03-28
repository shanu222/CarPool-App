import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft, MapPin, Calendar, Clock, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { pakistanCities } from '../../data/pakistanCities';

export function PostRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, syncAccessSummary } = useAuth();
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

  useEffect(() => {
    const state = location.state as
      | {
          fromCity?: string;
          toCity?: string;
          dateTime?: string;
          seatsNeeded?: number;
        }
      | undefined;

    if (!state) {
      return;
    }

    let date = '';
    let time = '';

    if (state.dateTime) {
      const dt = new Date(state.dateTime);
      if (!Number.isNaN(dt.getTime())) {
        date = dt.toISOString().slice(0, 10);
        time = dt.toISOString().slice(11, 16);
      }
    }

    setFormData((prev) => ({
      ...prev,
      fromCity: state.fromCity || prev.fromCity,
      toCity: state.toCity || prev.toCity,
      date: date || prev.date,
      time: time || prev.time,
      seatsNeeded: state.seatsNeeded ? String(state.seatsNeeded) : prev.seatsNeeded,
    }));
  }, [location.state]);

  const submitRequest = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          setLoading(true);
          setError('');
          const dateTime = new Date(`${formData.date}T${formData.time}:00`).toISOString();

          const response = await api.post('/api/requests/create', {
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

          syncAccessSummary(response.data);

          toast.success('Ride request posted');
          navigate('/trips');
        } catch (requestError: any) {
          const responseData = requestError?.response?.data || {};
          syncAccessSummary(responseData);
          const message = responseData?.message || responseData?.error || 'Could not post request';
          setError(message);
          if (message === 'Only Pakistani cities allowed') {
            toast.error('Please enter a valid Pakistani city');
          } else {
            toast.error(message);
          }

          if (responseData?.requiresPayment && responseData?.redirectTo) {
            navigate(responseData.redirectTo, {
              state: {
                action: 'ride_request',
                tokenInfo: responseData?.tokenInfo,
              },
            });
          }
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
    <div className="min-h-screen bg-gray-50 pb-10 overflow-x-hidden">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-3 py-3 md:px-5 md:py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg md:text-xl">Find Ride</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-3 py-4 md:px-5 md:py-5 space-y-4">
        <div className="responsive-card bg-white rounded-xl shadow-md space-y-4">
          <h3 className="text-sm md:text-base">Route Details</h3>

          <div>
            <CityAutocomplete
              label="From"
              value={formData.fromCity}
              onChange={(value) => updateField('fromCity', value)}
              placeholder="Departure city"
              icon={<MapPin className="w-5 h-5 text-gray-400" />}
              cities={pakistanCities}
            />
          </div>

          <div>
            <CityAutocomplete
              label="To"
              value={formData.toCity}
              onChange={(value) => updateField('toCity', value)}
              placeholder="Destination city"
              icon={<MapPin className="w-5 h-5 text-blue-600" />}
              cities={pakistanCities}
            />
          </div>
        </div>

        <div className="responsive-card bg-white rounded-xl shadow-md space-y-4">
          <h3 className="text-sm md:text-base">Departure</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-700">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-3 py-3 md:py-3.5 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-xl"
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
                  className="w-full pl-10 pr-3 py-3 md:py-3.5 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-xl"
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
                className="w-full pl-10 pr-3 py-3 md:py-3.5 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-xl"
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
          className="responsive-action w-full rounded-2xl bg-blue-600 py-3 md:py-4 text-sm md:text-base text-white shadow-lg shadow-blue-600/30 disabled:opacity-50"
        >
          {loading ? 'Posting...' : 'Post Ride Request'}
        </button>
      </form>
    </div>
  );
}
