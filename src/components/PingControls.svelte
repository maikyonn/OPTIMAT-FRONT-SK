<!--
  PingControls.svelte - Example component demonstrating ping management
  This component shows how other components can interact with the ping system
-->

<script>
  import { pingManager, PingTypes, pings, visiblePingCount, pingsByType } from '../lib/pingManager.js';
  
  let customPingAddress = '';
  let customPingLabel = '';
  
  // Example: Add a custom ping
  function addCustomPing() {
    if (!customPingAddress.trim()) return;
    
    // For demo purposes, we'll use some Bay Area coordinates
    // In a real app, you'd geocode the address
    const demoCoordinates = [
      37.7749 + (Math.random() - 0.5) * 0.1,
      -122.4194 + (Math.random() - 0.5) * 0.1
    ];
    
    pingManager.addPing({
      type: PingTypes.CUSTOM,
      coordinates: demoCoordinates,
      label: customPingLabel || 'Custom Location',
      description: customPingAddress,
      metadata: { 
        address: customPingAddress,
        addedBy: 'user'
      }
    });
    
    // Clear form
    customPingAddress = '';
    customPingLabel = '';
  }
  
  // Example: Add predefined locations
  function addSampleLocations() {
    const sampleLocations = [
      {
        type: PingTypes.SEARCH_RESULT,
        coordinates: [37.7849, -122.4094],
        label: 'Sample Location 1',
        description: 'A sample search result',
        metadata: { category: 'restaurant' }
      },
      {
        type: PingTypes.SEARCH_RESULT,
        coordinates: [37.7649, -122.4294],
        label: 'Sample Location 2',
        description: 'Another sample search result',
        metadata: { category: 'shopping' }
      }
    ];
    
    pingManager.addPings(sampleLocations, true);
  }
  
  // Clear functions
  function clearCustomPings() {
    pingManager.removePingsByType(PingTypes.CUSTOM);
  }
  
  function clearSearchResults() {
    pingManager.removePingsByType(PingTypes.SEARCH_RESULT);
  }
  
  function clearAllPings() {
    pingManager.clearAllPings();
  }
  
  // Focus functions
  function focusOnOriginDestination() {
    const origins = pingManager.getPingsByType(PingTypes.ORIGIN);
    const destinations = pingManager.getPingsByType(PingTypes.DESTINATION);
    
    if (origins.length > 0 || destinations.length > 0) {
      pingManager.focusOnAllPings();
    }
  }
  
  function focusOnProviders() {
    pingManager.focusOnAllPings(PingTypes.PROVIDER);
  }
</script>

<div class="ping-controls bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg">
  <h3 class="text-lg font-semibold mb-4 text-gray-900">Ping Controls</h3>
  
  <!-- Status Display -->
  <div class="mb-4 text-sm text-gray-600">
    <p><strong>Total Pings:</strong> {$visiblePingCount}</p>
    <div class="grid grid-cols-2 gap-2 mt-2">
      <div>Origins: {$pingsByType[PingTypes.ORIGIN].length}</div>
      <div>Destinations: {$pingsByType[PingTypes.DESTINATION].length}</div>
      <div>Providers: {$pingsByType[PingTypes.PROVIDER].length}</div>
      <div>Custom: {$pingsByType[PingTypes.CUSTOM].length}</div>
    </div>
  </div>
  
  <!-- Add Custom Ping -->
  <div class="mb-4 p-3 bg-gray-50 rounded">
    <h4 class="font-medium mb-2">Add Custom Ping</h4>
    <input
      bind:value={customPingLabel}
      placeholder="Label (optional)"
      class="w-full mb-2 px-2 py-1 border rounded text-sm"
    />
    <input
      bind:value={customPingAddress}
      placeholder="Address or description"
      class="w-full mb-2 px-2 py-1 border rounded text-sm"
    />
    <button
      on:click={addCustomPing}
      disabled={!customPingAddress.trim()}
      class="w-full bg-blue-500 text-white py-1 px-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
    >
      Add Custom Ping
    </button>
  </div>
  
  <!-- Quick Actions -->
  <div class="space-y-2">
    <button
      on:click={addSampleLocations}
      class="w-full bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600"
    >
      Add Sample Locations
    </button>
    
    <div class="grid grid-cols-2 gap-2">
      <button
        on:click={focusOnOriginDestination}
        class="bg-indigo-500 text-white py-1 px-2 rounded text-xs hover:bg-indigo-600"
      >
        Focus Route
      </button>
      <button
        on:click={focusOnProviders}
        class="bg-blue-500 text-white py-1 px-2 rounded text-xs hover:bg-blue-600"
      >
        Focus Providers
      </button>
    </div>
    
    <div class="grid grid-cols-3 gap-1">
      <button
        on:click={clearCustomPings}
        class="bg-orange-500 text-white py-1 px-2 rounded text-xs hover:bg-orange-600"
      >
        Clear Custom
      </button>
      <button
        on:click={clearSearchResults}
        class="bg-purple-500 text-white py-1 px-2 rounded text-xs hover:bg-purple-600"
      >
        Clear Search
      </button>
      <button
        on:click={clearAllPings}
        class="bg-red-500 text-white py-1 px-2 rounded text-xs hover:bg-red-600"
      >
        Clear All
      </button>
    </div>
  </div>
  
  <!-- Ping List (optional debug view) -->
  {#if $pings.length > 0}
    <details class="mt-4">
      <summary class="text-sm font-medium cursor-pointer">Ping List ({$pings.length})</summary>
      <div class="mt-2 max-h-40 overflow-y-auto text-xs">
        {#each $pings as ping}
          <div class="flex items-center justify-between py-1 border-b border-gray-200">
            <div>
              <span class="font-medium">{ping.label}</span>
              <span class="text-gray-500">({ping.type})</span>
            </div>
            <button
              on:click={() => pingManager.removePing(ping.id)}
              class="text-red-500 hover:text-red-700"
              title="Remove ping"
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    </details>
  {/if}
</div>

<style>
  .ping-controls {
    max-width: 300px;
  }
</style>