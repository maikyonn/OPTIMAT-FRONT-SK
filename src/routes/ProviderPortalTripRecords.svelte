<script lang="ts">
  import { fade } from 'svelte/transition';
  import { push } from 'svelte-spa-router';
  import PageShell from '$lib/components/PageShell.svelte';
  import { Button } from '$lib/components/ui/button';
  import TripPairsDashboard from '$lib/components/TripPairsDashboard.svelte';
  import providerSession from '$lib/stores/providerSession';
  import mockDataEnabled from '$lib/stores/mockData';
  import { providerPortalNavItems } from '$lib/providerPortalNav';

  $: provider = $providerSession.provider;
  $: mockEnabled = $mockDataEnabled;
  $: providerId = (() => {
    if (!provider?.provider_id) return null;
    const parsed = Number(provider.provider_id);
    return Number.isNaN(parsed) ? null : parsed;
  })();

  function goToLogin() {
    push('/provider-portal');
  }

  function toggleMockData() {
    mockDataEnabled.update((value) => !value);
  }
</script>

<PageShell appMode={true} navItems={providerPortalNavItems}>
  <div slot="header-actions" class="flex items-center gap-2 text-xs text-muted-foreground">
    {#if provider}
      <span><span class="text-foreground font-medium">Provider View:</span> {provider.provider_name}</span>
    {:else}
      <span>Public View</span>
    {/if}
    <Button variant="outline" size="sm" onclick={toggleMockData}>
      {mockEnabled ? 'Mock Data: On' : 'Mock Data: Off'}
    </Button>
  </div>

  {#if !provider}
    <div class="flex-1 overflow-auto p-6">
      <div class="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6" in:fade={{ duration: 200 }}>
        <h2 class="text-lg font-semibold text-slate-900">Sign in to view trip records</h2>
        <p class="text-sm text-slate-600 mt-2">Trip records are scoped to your provider account.</p>
        <Button class="mt-4" onclick={goToLogin}>Go to Provider Portal</Button>
      </div>
    </div>
  {:else}
    <div class="flex-1 min-h-0">
      <TripPairsDashboard providerId={providerId} mockEnabled={mockEnabled} />
    </div>
  {/if}
</PageShell>
