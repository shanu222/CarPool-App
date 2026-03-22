import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Search, Plus } from 'lucide-react';
import { motion } from 'motion/react';

export function Home() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const navigate = useNavigate();

  const handleSearch = () => {
    navigate('/search?from=' + from + '&to=' + to + '&date=' + date);
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="glass-panel mx-4 mt-4 px-6 pt-12 pb-6 rounded-3xl">
        <h1 className="text-3xl mb-2 text-white">Welcome back! 👋</h1>
        <p className="text-slate-200">Where would you like to go?</p>
      </div>

      <div className="px-6 py-6">
        <button
          onClick={() => navigate('/post-ride')}
          className="mb-6 w-full rounded-2xl bg-green-600 py-4 text-white shadow-lg shadow-green-600/30"
        >
          <Plus className="mr-2 inline-block h-5 w-5" />
          Offer a Ride
        </button>

        {/* Search Form */}
        <motion.div
          key="find"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-6 space-y-4"
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
            disabled={!from || !to || !date}
            className="w-full rounded-2xl bg-blue-600 py-4 text-white shadow-lg shadow-blue-600/30 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search className="mr-2 inline-block h-5 w-5" />
            Search Rides
          </button>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="glass-subtle rounded-2xl p-4 text-center">
            <div className="text-2xl mb-1 text-white">12K+</div>
            <div className="text-xs text-slate-200">Active Rides</div>
          </div>
          <div className="glass-subtle rounded-2xl p-4 text-center">
            <div className="text-2xl mb-1 text-white">50K+</div>
            <div className="text-xs text-slate-200">Happy Users</div>
          </div>
          <div className="glass-subtle rounded-2xl p-4 text-center">
            <div className="text-2xl mb-1 text-white">4.9★</div>
            <div className="text-xs text-slate-200">Avg Rating</div>
          </div>
        </div>

        <button
          onClick={() => navigate('/map')}
          className="mt-6 w-full rounded-2xl bg-white/20 px-5 py-4 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-white/30"
        >
          Open Live Map
        </button>
      </div>
    </div>
  );
}
