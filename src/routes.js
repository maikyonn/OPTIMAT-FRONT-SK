import MapView from './routes/MapView.svelte';
import ChatView from './routes/ChatView.svelte';
import BetaSignup from './routes/BetaSignup.svelte';
import TripRecordsCsv from './routes/TripRecordsCsv.svelte';
import ProvidersInfo from './routes/ProvidersInfo.svelte';
import StaffPortal from './routes/StaffPortal.svelte';

const routes = {
  // Map interface (default)
  '/': MapView,
  '/map': MapView,

  // CSV paired trip records viewer (also the default /trip-pairs route)
  '/trip-pairs': TripRecordsCsv,
  '/trip-records-csv': TripRecordsCsv,

  // Chat interface with integrated examples
  '/chat': ChatView,

  // Providers info management page
  '/providers-info': ProvidersInfo,

  // Staff portal for providers to edit their own information
  '/staff': StaffPortal,

  // Beta signup page
  '/beta-signup': BetaSignup,

  // Catch-all route (redirects to map)
  '*': MapView
};

export default routes; 
