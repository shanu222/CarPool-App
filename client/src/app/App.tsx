import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { RealtimeNotificationSound } from './components/RealtimeNotificationSound';

const isAdminApp = import.meta.env.VITE_APP_MODE === 'admin';

export default function App() {
  useEffect(() => {
    document.title = isAdminApp ? 'Carpool Admin' : 'Carpool User';
  }, []);

  if (isAdminApp) {
    return (
      <>
        <RealtimeNotificationSound />
        <RouterProvider router={router} />
      </>
    );
  }

  return (
    <>
      <RealtimeNotificationSound />
      <div className="app-stage">
        <div className="app-shell">
          <div className="app-shell-content">
            <RouterProvider router={router} />
          </div>
        </div>
      </div>
    </>
  );
}
