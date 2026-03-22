import { Outlet, useNavigate, useLocation } from 'react-router';
import { Home, Calendar, MessageCircle, User } from 'lucide-react';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Calendar, label: 'Trips', path: '/trips' },
    { icon: MessageCircle, label: 'Messages', path: '/trips' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Main Content */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 mx-3 mb-3 rounded-2xl glass-panel">
        <div className="flex items-center justify-around px-4 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white/80 text-slate-900 shadow-md'
                    : 'text-white/85 hover:bg-white/15'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
