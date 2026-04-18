import { createBrowserRouter } from 'react-router';
import MapView from './MapView';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MapView,
  },
  {
    path: '/place/:placeId',
    Component: MapView,
  },
  {
    path: '*',
    Component: MapView, // Fallback to main map view
  },
]);
