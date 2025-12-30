<script>
  import PageShell from '$lib/components/PageShell.svelte';
  import TripPairsDashboard from '$lib/components/TripPairsDashboard.svelte';
</script>

<PageShell
  title="Service Dashboard"
  description="Explore paired trip records with return gaps, hotspots, and time-of-day insights."
  appMode={true}
>
  <TripPairsDashboard />
</PageShell>
