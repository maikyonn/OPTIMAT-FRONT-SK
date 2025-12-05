import MapView from './routes/MapView.svelte';
import ChatView from './routes/ChatView.svelte';
import BetaSignup from './routes/BetaSignup.svelte';
import TripHistory from './routes/TripHistory.svelte';
import TripRecordsCsv from './routes/TripRecordsCsv.svelte';

const routes = {
  // Map interface (default)
  '/': MapView,
  '/map': MapView,

  // Historical trip explorer
  '/trip-history': TripHistory,

  // CSV paired trip records viewer (also the default /trip-pairs route)
  '/trip-pairs': TripRecordsCsv,
  '/trip-records-csv': TripRecordsCsv,

  // Chat interface with integrated examples
  '/chat': ChatView,

  // Beta signup page
  '/beta-signup': BetaSignup,

  // Catch-all route (redirects to map)
  '*': MapView
};

export default routes; 
