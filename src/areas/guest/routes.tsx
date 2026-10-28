import type { RouteObject } from 'react-router';
import { GuestLayout } from './GuestLayout';
import { MenuPage } from './MenuPage';
import { DishDetailPage } from './DishDetailPage';

export const guestRoutes: RouteObject[] = [
  {
    path: '/guest',
    element: <GuestLayout />,
    children: [
      { index: true, element: <MenuPage /> },
      { path: 'dish', element: <DishDetailPage /> },
    ],
  },
];
