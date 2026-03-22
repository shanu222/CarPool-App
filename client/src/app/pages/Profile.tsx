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
import { toast } from 'sonner';

export function Profile() {
  const navigate = useNavigate();
  const { user, logout, setCurrentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [cnic, setCnic] = useState(user?.cnicNumber || user?.cnic || '');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [cnicPhoto, setCnicPhoto] = useState<File | null>(null);
  const [carPhoto, setCarPhoto] = useState<File | null>(null);
  const [carMake, setCarMake] = useState(user?.carMake || '');
  const [carModel, setCarModel] = useState(user?.carModel || '');
  const [carColor, setCarColor] = useState(user?.carColor || '');
  const [carPlateNumber, setCarPlateNumber] = useState(user?.carPlateNumber || '');
  const [carYear, setCarYear] = useState(user?.carYear ? String(user.carYear) : '');
  const [uploading, setUploading] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

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

  const handleRoleSwitch = async () => {
    if (!user || user.role === 'admin') {
      return;
    }

    const nextRole = user.role === 'driver' ? 'passenger' : 'driver';

    try {
      setSwitchingRole(true);
      const response = await api.patch('/api/user/role', { role: nextRole });
      if (response?.data?.user) {
        setCurrentUser(response.data.user);
      }
      toast.success(`Switched to ${nextRole}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not switch role');
    } finally {
      setSwitchingRole(false);
    }
  };

  if (!user) {
    return <div className="p-6">No user data available</div>;
  }

  const submitVerification = async () => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('cnicNumber', cnic);
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto);
      }
      if (cnicPhoto) {
        formData.append('cnicPhoto', cnicPhoto);
      }
      if (carPhoto) {
        formData.append('carPhoto', carPhoto);
      }
      if (user.role === 'driver') {
        formData.append('carMake', carMake);
        formData.append('carModel', carModel);
        formData.append('carColor', carColor);
        formData.append('carPlateNumber', carPlateNumber);
        if (carYear) {
          formData.append('carYear', carYear);
        }
      }

      await api.post('/api/user/upload-documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Verification submitted');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Verification upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header */}
      <div className="glass-panel mx-4 mt-4 px-6 pt-12 pb-8 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl text-white">Profile</h1>
          <button className="p-2 bg-white/20 rounded-xl text-white transition-all duration-200 hover:bg-white/30">
            <Edit2 className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-subtle rounded-2xl p-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-3xl">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl mb-1 text-white">{user.name}</h2>
              <p className="text-sm text-slate-100 mb-2">{user.email || user.phone || 'No contact info'}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm text-white">{user.rating}</span>
                </div>
                {user.isVerified ? (
                  <div className="rounded-lg bg-green-100 px-2 py-1 text-xs text-green-700">Verified ✓</div>
                ) : (
                  <div className="rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-700">Not verified</div>
                )}
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
          <div className="glass-subtle rounded-2xl p-4 text-center">
            <Car className="w-6 h-6 mx-auto mb-2 text-blue-200" />
            <div className="text-xl mb-1 text-white">-</div>
            <div className="text-xs text-slate-100">As Driver</div>
          </div>
          <div className="glass-subtle rounded-2xl p-4 text-center">
            <User className="w-6 h-6 mx-auto mb-2 text-green-200" />
            <div className="text-xl mb-1 text-white">-</div>
            <div className="text-xs text-slate-100">As Passenger</div>
          </div>
          <div className="glass-subtle rounded-2xl p-4 text-center">
            <Shield className="w-6 h-6 mx-auto mb-2 text-purple-200" />
            <div className="text-xl mb-1 text-white">{user.role}</div>
            <div className="text-xs text-slate-100">Account Type</div>
          </div>
        </motion.div>

        {/* Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl overflow-hidden"
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
          className="glass-panel rounded-2xl p-4"
        >
          {user.role !== 'admin' ? (
            <button
              type="button"
              onClick={handleRoleSwitch}
              disabled={switchingRole}
              className="mb-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {switchingRole
                ? 'Switching...'
                : user.role === 'driver'
                ? 'Switch to Passenger'
                : 'Switch to Driver'}
            </button>
          ) : null}

          <h3 className="text-base mb-4 text-white">Verification</h3>
          <div className="space-y-3 mb-4">
            <input
              value={cnic}
              onChange={(event) => setCnic(event.target.value)}
              placeholder="CNIC"
              className="w-full rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-200"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)}
              className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/85 file:px-3 file:py-1 file:text-slate-900"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setCnicPhoto(event.target.files?.[0] || null)}
              className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/85 file:px-3 file:py-1 file:text-slate-900"
            />
            {user.role === 'driver' ? (
              <>
                <input
                  value={carMake}
                  onChange={(event) => setCarMake(event.target.value)}
                  placeholder="Car make"
                  className="w-full rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-200"
                />
                <input
                  value={carModel}
                  onChange={(event) => setCarModel(event.target.value)}
                  placeholder="Car model"
                  className="w-full rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-200"
                />
                <input
                  value={carPlateNumber}
                  onChange={(event) => setCarPlateNumber(event.target.value)}
                  placeholder="Car plate number"
                  className="w-full rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-200"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={carColor}
                    onChange={(event) => setCarColor(event.target.value)}
                    placeholder="Car color"
                    className="w-full rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-200"
                  />
                  <input
                    value={carYear}
                    onChange={(event) => setCarYear(event.target.value)}
                    placeholder="Year"
                    className="w-full rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-200"
                  />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setCarPhoto(event.target.files?.[0] || null)}
                  className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/85 file:px-3 file:py-1 file:text-slate-900"
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={submitVerification}
              disabled={!cnic || uploading}
              className="w-full rounded-xl bg-white/85 px-3 py-2 text-sm text-slate-900 disabled:opacity-50 transition-all duration-200 hover:bg-white"
            >
              {uploading ? 'Submitting...' : 'Submit Verification'}
            </button>
          </div>

          <h3 className="text-base mb-4 text-white">Recent Notifications</h3>
          <div className="space-y-3">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <div key={item._id} className="rounded-xl bg-white/15 p-3">
                  <p className="text-sm text-white">{item.title}</p>
                  <p className="text-xs text-slate-100 mt-1">{item.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-100">No notifications yet.</p>
            )}
          </div>
        </motion.div>

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleLogout}
          className="w-full glass-subtle text-red-200 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 hover:bg-white/20"
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
    <button className="w-full flex items-center gap-3 px-4 py-4 border-b border-white/20 last:border-0 hover:bg-white/12 transition-colors">
      <Icon className="w-5 h-5 text-slate-100" />
      <span className="flex-1 text-left text-white">{label}</span>
      <ChevronRight className="w-5 h-5 text-slate-200" />
    </button>
  );
}
