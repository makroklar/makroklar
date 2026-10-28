import { createBrowserRouter, RouterProvider } from 'react-router';
import { landingRoutes } from './areas/landing/routes';
import { businessRoutes } from './areas/business/routes';
import { guestRoutes } from './areas/guest/routes';
import { DebugPage } from './debug/DebugPage';

// Diese Datei nur gemeinsam ändern – neue Seiten kommen in die routes.tsx des jeweiligen Bereichs.
// Jeder Bereich bringt dort sein eigenes Layout mit.
const router = createBrowserRouter([
  ...landingRoutes,
  ...businessRoutes,
  ...guestRoutes,
  { path: '/debug', element: <DebugPage /> },
  { path: '*', element: <p style={{ padding: 24 }}>Seite nicht gefunden.</p> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
