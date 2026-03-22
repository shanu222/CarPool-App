import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
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
