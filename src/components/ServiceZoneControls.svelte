<script>
  import { fade, fly } from 'svelte/transition';
  import { 
    serviceZoneManager, 
    ServiceZoneTypes, 
    serviceZones, 
    visibleServiceZones,
    serviceZonesByType,
    providerServiceZones 
  } from '../lib/serviceZoneManager.js';

  export let showControls = false;
  
  // Toggle controls visibility
  export function toggleControls() {
    showControls = !showControls;
  }

  // Zone type visibility states
  let typeVisibility = {
    [ServiceZoneTypes.PROVIDER]: true,
    [ServiceZoneTypes.COVERAGE]: true,
    [ServiceZoneTypes.ELIGIBILITY]: true,
    [ServiceZoneTypes.CUSTOM]: true
  };

  // Handle zone type visibility toggle
  function toggleZoneTypeVisibility(type) {
    typeVisibility[type] = !typeVisibility[type];
    serviceZoneManager.toggleServiceZonesByType(type, typeVisibility[type]);
  }

  // Focus on all visible zones
  function focusOnAllZones() {
    serviceZoneManager.focusOnAllServiceZones();
  }

  // Focus on zones and pings together
  function focusOnZonesAndPings() {
    serviceZoneManager.focusOnZonesAndPings();
  }

  // Clear all service zones
  function clearAllZones() {
    serviceZoneManager.clearAllServiceZones();
    // Reset visibility states
    Object.keys(typeVisibility).forEach(type => {
      typeVisibility[type] = true;
    });
  }

  // Focus on specific zone type
  function focusOnZoneType(type) {
    serviceZoneManager.focusOnAllServiceZones(type);
  }

  // Get zone type display name
  function getZoneTypeDisplayName(type) {
    const names = {
      [ServiceZoneTypes.PROVIDER]: 'Provider Zones',
      [ServiceZoneTypes.COVERAGE]: 'Coverage Areas',
      [ServiceZoneTypes.ELIGIBILITY]: 'Eligibility Zones',
      [ServiceZoneTypes.CUSTOM]: 'Custom Zones'
    };
    return names[type] || type;
  }

  // Get zone type icon
  function getZoneTypeIcon(type) {
    const icons = {
      [ServiceZoneTypes.PROVIDER]: '🚌',
      [ServiceZoneTypes.COVERAGE]: '📍',
      [ServiceZoneTypes.ELIGIBILITY]: '✅',
      [ServiceZoneTypes.CUSTOM]: '🗺️'
    };
    return icons[type] || '🗺️';
  }

  // Reactive stats
  $: totalZones = $serviceZones.length;
  $: visibleZones = $visibleServiceZones.length;
  $: providerZonesCount = $providerServiceZones.length;
  $: hasZones = totalZones > 0;
</script>

<!-- Control Toggle Button -->
<button
  class="fixed bottom-6 left-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
  on:click={toggleControls}
  title="Service Zone Controls"
  aria-label="Toggle service zone controls panel"
>
  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
  </svg>
</button>

<!-- Controls Panel -->
{#if showControls}
<div 
  class="fixed bottom-6 left-20 z-40 w-80 max-h-96 overflow-y-auto bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200"
  in:fly={{ x: -50, duration: 300 }}
  out:fly={{ x: -50, duration: 200 }}
>
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
        🗺️ Service Zones
      </h3>
      <button
        class="text-gray-400 hover:text-gray-600 transition-colors"
        on:click={toggleControls}
        aria-label="Close service zone controls panel"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    {#if hasZones}
      <!-- Zone Statistics -->
      <div class="bg-gray-50 rounded-lg p-3 mb-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">Total Zones:</span>
          <span class="font-medium text-gray-900">{totalZones}</span>
        </div>
        <div class="flex justify-between text-sm mt-1">
          <span class="text-gray-600">Visible:</span>
          <span class="font-medium text-green-600">{visibleZones}</span>
        </div>
        {#if providerZonesCount > 0}
          <div class="flex justify-between text-sm mt-1">
            <span class="text-gray-600">Providers:</span>
            <span class="font-medium text-blue-600">{providerZonesCount}</span>
          </div>
        {/if}
      </div>

      <!-- Zone Type Controls -->
      <div class="space-y-2 mb-4">
        <h4 class="text-sm font-medium text-gray-700 mb-2">Zone Types</h4>
        {#each Object.entries($serviceZonesByType) as [type, zones]}
          {#if zones.length > 0}
            <div class="flex items-center justify-between bg-gray-50 rounded-lg p-2">
              <label class="flex items-center gap-2 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={typeVisibility[type]}
                  on:change={() => toggleZoneTypeVisibility(type)}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="text-lg">{getZoneTypeIcon(type)}</span>
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-900">
                    {getZoneTypeDisplayName(type)}
                  </div>
                  <div class="text-xs text-gray-500">
                    {zones.length} zone{zones.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </label>
              <button
                class="ml-2 p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                on:click={() => focusOnZoneType(type)}
                title="Focus on {getZoneTypeDisplayName(type)}"
                aria-label="Focus map on {getZoneTypeDisplayName(type)}"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M9 10l-4.553-2.276A1 1 0 013 8.618v6.764a1 1 0 001.447.894L9 14"/>
                </svg>
              </button>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Action Buttons -->
      <div class="space-y-2">
        <button
          class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
          on:click={focusOnAllZones}
        >
          📍 Focus on All Zones
        </button>
        
        <button
          class="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
          on:click={focusOnZonesAndPings}
        >
          🎯 Focus on Zones & Pings
        </button>
        
        <button
          class="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
          on:click={clearAllZones}
        >
          🗑️ Clear All Zones
        </button>
      </div>

    {:else}
      <!-- No Zones Message -->
      <div class="text-center py-8">
        <div class="text-4xl mb-2">🗺️</div>
        <div class="text-gray-500 text-sm">
          No service zones to display.<br>
          Search for providers to see their service areas.
        </div>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  /* Custom scrollbar for the panel */
  .overflow-y-auto {
    scrollbar-width: thin;
    scrollbar-color: #d1d5db #f9fafb;
  }
  
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track {
    background: #f9fafb;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>