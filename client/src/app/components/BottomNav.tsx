import { Home, Search, PlusCircle, MessageSquare, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { clsx } from 'clsx';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: PlusCircle, label: 'Post', path: '/post-ride' },
    { icon: MessageSquare, label: 'Trips', path: '/trips' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 min-w-[60px] transition-colors',
                  isActive ? 'text-teal-600' : 'text-gray-500'
                )}
              >
                <Icon className={clsx('w-6 h-6', isActive && 'fill-teal-100')} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
