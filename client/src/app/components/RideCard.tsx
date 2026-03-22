import { useNavigate } from 'react-router';
import { Star, Users, MapPin, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import type { Ride } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

interface RideCardProps {
  ride: Ride;
}

export function RideCard({ ride }: RideCardProps) {
  const navigate = useNavigate();
  const isLive = ride.status === 'ongoing' && ride.availableSeats > 0;
  const isScheduled = ride.status === 'scheduled';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/ride/${ride._id}`)}
      className="glass-panel rounded-2xl p-4 cursor-pointer"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg">
          {ride.driver.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base text-white">{ride.driver.name}</h3>
            <VerifiedBadge isVerified={ride.driver.isVerified} />
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-100">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span>{ride.driver.rating}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl text-blue-200">PKR {ride.pricePerSeat}</div>
          <div className="text-xs text-slate-100">per seat</div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        {isLive ? (
          <span className="rounded-full bg-emerald-500/25 px-2 py-1 text-[11px] text-emerald-200">LIVE</span>
        ) : isScheduled ? (
          <span className="rounded-full bg-sky-500/25 px-2 py-1 text-[11px] text-sky-200">SCHEDULED</span>
        ) : (
          <span className="rounded-full bg-slate-500/25 px-2 py-1 text-[11px] text-slate-200">{ride.status || 'UNKNOWN'}</span>
        )}

        {isLive ? <span className="text-xs text-emerald-200">LIVE RIDE AVAILABLE</span> : null}
      </div>

      <div className="flex items-start gap-2 mb-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <div className="w-0.5 h-8 bg-gray-300" />
          <MapPin className="w-3 h-3 text-blue-600" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="text-sm text-white">{ride.fromCity}</div>
            <div className="text-xs text-slate-100">{ride.time}</div>
          </div>
          <div>
            <div className="text-sm text-white">{ride.toCity}</div>
            <div className="text-xs text-slate-100">{ride.date}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/30">
        <div className="flex items-center gap-4 text-sm text-slate-100">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{ride.availableSeats}/{ride.totalSeats}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{ride.time}</span>
          </div>
        </div>
        <div className="text-xs text-slate-100">Driver Ride</div>
      </div>
    </motion.div>
  );
}
