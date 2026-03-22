import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Search, Plus } from 'lucide-react';
import { motion } from 'motion/react';

export function Home() {
  const [mode, setMode] = useState<'find' | 'offer'>('find');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const navigate = useNavigate();

  const handleSearch = () => {
    if (mode === 'find') {
      navigate('/search?from=' + from + '&to=' + to + '&date=' + date);
    } else {
      navigate('/post-ride');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-3xl shadow-sm">
        <h1 className="text-3xl mb-2">Welcome back! 👋</h1>
        <p className="text-gray-600">Where would you like to go?</p>
      </div>

      <div className="px-6 py-6">
        {/* Toggle */}
        <div className="bg-white p-2 rounded-2xl shadow-sm mb-6 flex gap-2">
          <button
            onClick={() => setMode('find')}
            className={`flex-1 py-3 rounded-xl transition-all ${
              mode === 'find'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600'
            }`}
          >
            <Search className="w-5 h-5 inline-block mr-2" />
            Find a Ride
          </button>
          <button
            onClick={() => setMode('offer')}
            className={`flex-1 py-3 rounded-xl transition-all ${
              mode === 'offer'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-gray-600'
            }`}
          >
            <Plus className="w-5 h-5 inline-block mr-2" />
            Offer a Ride
          </button>
        </div>

        {/* Search Form */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-lg p-6 space-y-4"
        >
          <div>
            <label className="block text-sm mb-2 text-gray-700">From</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="City of departure"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">To</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Destination city"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm mb-2 text-gray-700">Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleSearch}
            disabled={mode === 'find' && (!from || !to || !date)}
            className={`w-full py-4 rounded-2xl shadow-lg transition-all ${
              mode === 'find'
                ? 'bg-blue-600 text-white shadow-blue-600/30'
                : 'bg-green-600 text-white shadow-green-600/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {mode === 'find' ? 'Search Rides' : 'Post Your Ride'}
          </button>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <div className="text-2xl mb-1">12K+</div>
            <div className="text-xs text-gray-600">Active Rides</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <div className="text-2xl mb-1">50K+</div>
            <div className="text-xs text-gray-600">Happy Users</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <div className="text-2xl mb-1">4.9★</div>
            <div className="text-xs text-gray-600">Avg Rating</div>
          </div>
        </div>
      </div>
    </div>
  );
}
