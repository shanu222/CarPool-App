import { RouterProvider } from 'react-router';
import { router } from './routes';

const isAdminApp = import.meta.env.VITE_APP_MODE === 'admin';

export default function App() {
  if (isAdminApp) {
    return <RouterProvider router={router} />;
  }

  return (
    <div className="app-stage">
      <div className="app-shell">
        <div className="app-shell-content">
          <RouterProvider router={router} />
        </div>
      </div>
    </div>
  );
}
