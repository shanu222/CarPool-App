import { Outlet, useNavigate, useLocation } from 'react-router';
import { Home, Calendar, MessageCircle, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleIndicator } from './RoleIndicator';
import { TokenIndicator } from './TokenIndicator';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Calendar, label: 'Trips', path: '/trips' },
    { icon: MessageCircle, label: 'Messages', path: '/trips' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div className="pointer-events-none sticky top-2 z-40 px-3 pt-2 md:px-4 md:pt-3">
        <div className="flex min-h-10 w-full flex-wrap items-start justify-end gap-2">
        <RoleIndicator role={user?.role} />
        <TokenIndicator user={user} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 pb-24 pt-1 md:pb-28">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-[420px] px-3 pb-3">
        <div className="glass-panel rounded-2xl px-2 py-2 md:px-3 md:py-3">
          <div className="flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`min-h-12 flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-xs transition-all duration-200 ${
                  isActive
                    ? 'bg-white/80 text-slate-900 shadow-md'
                    : 'text-white/85 hover:bg-white/15'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
          </div>
        </div>
      </nav>
    </div>
  );
}
