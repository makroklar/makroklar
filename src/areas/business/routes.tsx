import type { RouteObject } from 'react-router';
import { BusinessLayout } from './BusinessLayout';
import { DashboardPage } from './DashboardPage';
import { MenuPage } from './MenuPage';

export const businessRoutes: RouteObject[] = [
  {
    path: '/business',
    element: <BusinessLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'menu', element: <MenuPage /> },
    ],
  },
];
