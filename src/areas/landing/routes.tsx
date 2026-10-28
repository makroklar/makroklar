import type { RouteObject } from 'react-router';
import { LandingLayout } from './LandingLayout';
import { HomePage } from './HomePage';
import { ContactPage } from './ContactPage';

export const landingRoutes: RouteObject[] = [
  {
    element: <LandingLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/contact', element: <ContactPage /> },
    ],
  },
];
