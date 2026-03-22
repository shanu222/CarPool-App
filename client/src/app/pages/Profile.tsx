import { useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import {
  User,
  Star,
  Car,
  Shield,
  Bell,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Edit2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { NotificationItem } from '../types';

export function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await api.get<NotificationItem[]>('/api/notifications/my');
        setNotifications(response.data.slice(0, 6));
      } catch {
        setNotifications([]);
      }
    };

    loadNotifications();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  if (!user) {
    return <div className="p-6">No user data available</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl text-white">Profile</h1>
          <button className="p-2 bg-white/20 rounded-xl text-white">
            <Edit2 className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-3xl">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl mb-1">{user.name}</h2>
              <p className="text-sm text-gray-600 mb-2">{user.email || user.phone || 'No contact info'}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{user.rating}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <Car className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <div className="text-xl mb-1">-</div>
            <div className="text-xs text-gray-600">As Driver</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <User className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <div className="text-xl mb-1">-</div>
            <div className="text-xs text-gray-600">As Passenger</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <Shield className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <div className="text-xl mb-1">{user.role}</div>
            <div className="text-xs text-gray-600">Account Type</div>
          </div>
        </motion.div>

        {/* Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm overflow-hidden"
        >
          <SettingItem icon={Bell} label="Notifications" />
          <SettingItem icon={CreditCard} label="Payment Methods" />
          <SettingItem icon={Shield} label="Privacy & Security" />
          <SettingItem icon={HelpCircle} label="Help & Support" />
        </motion.div>

        {/* Reviews Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          <h3 className="text-base mb-4">Recent Notifications</h3>
          <div className="space-y-3">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <div key={item._id} className="rounded-xl bg-gray-50 p-3">
                  <p className="text-sm">{item.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{item.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600">No notifications yet.</p>
            )}
          </div>
        </motion.div>

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleLogout}
          className="w-full bg-white text-red-600 py-4 rounded-2xl shadow-sm flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          <span>Log Out</span>
        </motion.button>
      </div>
    </div>
  );
}

interface SettingItemProps {
  icon: React.ElementType;
  label: string;
}

function SettingItem({ icon: Icon, label }: SettingItemProps) {
  return (
    <button className="w-full flex items-center gap-3 px-4 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <Icon className="w-5 h-5 text-gray-600" />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  );
}
