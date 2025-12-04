<script>
  import { onMount, onDestroy } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fade, fly, scale } from 'svelte/transition';
  import TransportationForm from '../components/TransportationForm.svelte';
  import { Map, TileLayer, Marker, Popup, GeoJSON } from 'sveaflet';
  import { PROVIDERS_API_BASE } from '../config';
  import { pingManager, PingTypes, pings, mapFocus, visiblePings } from '../lib/pingManager.js';
  import { serviceZoneManager, ServiceZoneTypes, visibleServiceZones } from '../lib/serviceZoneManager.js';

  let loading = false;
  let error = null;
  let responseData = null;
  let showForm = false;
  let formPosition = 'form'; // 'form' or 'results'
  let mapComponent = null;

  // Animation state
  let mounted = false;
  
  // Map state derived from ping manager
  $: mapCenter = $mapFocus.center;
  $: mapZoom = $mapFocus.zoom;
  $: shouldUpdateMap = $mapFocus.shouldFocus;
  
  // Create a reactive key for map updates when focus changes
  $: mapKey = shouldUpdateMap ? `${mapCenter[0]}-${mapCenter[1]}-${mapZoom}-${Date.now()}` : 'static';
  
  onMount(() => {
    mounted = true;
    // Show form after a brief delay for animation
    setTimeout(() => {
      showForm = true;
    }, 500);
    
    // Initialize with default San Francisco Bay Area view
    pingManager.focusOnCoordinates([37.7749, -122.4194], 10);
  });

  onDestroy(() => {
    // Clean up pings and service zones when leaving the component
    pingManager.clearAllPings();
    serviceZoneManager.clearAllServiceZones();
  });

  // Reset focus trigger after map update
  $: if (shouldUpdateMap && mapComponent) {
    // Reset the focus trigger after a brief delay
    setTimeout(() => {
      pingManager.resetFocus();
    }, 100);
  }

  const API_BASE = PROVIDERS_API_BASE;

  async function geocodeAddress(address) {
    try {
      const url = `${API_BASE}/providers/geocode?address=${encodeURIComponent(address)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.coordinates) {
        const { longitude, latitude } = data.coordinates;
        return [latitude, longitude];
      }

      console.error('Geocoding failed:', data.message);
      return null;

    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  }

  async function handleOriginAddressUpdate(event) {
    const address = event.detail;
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      // Remove existing origin ping
      pingManager.removePingsByType(PingTypes.ORIGIN);
      
      // Add new origin ping
      pingManager.addPing({
        type: PingTypes.ORIGIN,
        coordinates: coordinates,
        label: 'Origin',
        description: address,
        metadata: { address }
      }, false); // Don't auto-focus
      
      // Focus on both origin and destination if both exist
      const destinationPings = pingManager.getPingsByType(PingTypes.DESTINATION);
      if (destinationPings.length > 0) {
        pingManager.focusOnAllPings();
      }
    }
  }

  async function handleDestinationAddressUpdate(event) {
    const address = event.detail;
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      // Remove existing destination ping
      pingManager.removePingsByType(PingTypes.DESTINATION);
      
      // Add new destination ping
      pingManager.addPing({
        type: PingTypes.DESTINATION,
        coordinates: coordinates,
        label: 'Destination',
        description: address,
        metadata: { address }
      }, false); // Don't auto-focus
      
      // Focus on both origin and destination if both exist
      const originPings = pingManager.getPingsByType(PingTypes.ORIGIN);
      if (originPings.length > 0) {
        pingManager.focusOnAllPings();
      }
    }
  }

  async function handleFormSubmit(event) {
    const formData = event.detail;
    loading = true;
    error = null;
    responseData = null;
    
    try {
      const apiUrl = `${API_BASE}/providers/filter`;

      // Build the request body with all filter fields
      const requestBody = {
        source_address: formData.originAddress,
        destination_address: formData.destinationAddress
      };
      
      // Add optional filters only if they have values
      if (formData.providerType) requestBody.provider_type = formData.providerType;
      if (formData.routingType) requestBody.routing_type = formData.routingType;
      if (formData.scheduleType) requestBody.schedule_type = formData.scheduleType;
      if (formData.planningType) requestBody.planning_type = formData.planningType;
      if (formData.eligibilityReqContains) requestBody.eligibility_req_contains = formData.eligibilityReqContains;
      if (formData.providerOrg) requestBody.provider_org = formData.providerOrg;
      if (formData.providerNameContains) requestBody.provider_name__contains = formData.providerNameContains;
      if (formData.hasServiceZone !== null) requestBody.has_service_zone = formData.hasServiceZone;
      if (formData.bookingMethod) requestBody.booking_method = formData.bookingMethod;
      if (formData.fareType) requestBody.fare_type = formData.fareType;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(responseText);
      responseData = data;
      formPosition = 'results';
      
      // Clear existing provider pings and service zones
      pingManager.removePingsByType(PingTypes.PROVIDER);
      serviceZoneManager.clearAllServiceZones();
      
      // Add provider location pings and service zones if available
      if (data && data.data && data.data.length > 0) {
        // Add provider location pings
        const providerPings = data.data
          .filter(provider => provider.latitude && provider.longitude)
          .map(provider => ({
            type: PingTypes.PROVIDER,
            coordinates: [parseFloat(provider.latitude), parseFloat(provider.longitude)],
            label: provider.provider_name,
            description: `${provider.provider_name}\nType: ${provider.provider_type}`,
            metadata: { provider }
          }));
        
        if (providerPings.length > 0) {
          pingManager.addPings(providerPings, false);
        }

        // Add service zones using the new service zone manager
        serviceZoneManager.addProviderServiceZones(data.data, false);

        // Sync assigned colors back onto providers for UI
        data.data = data.data.map(p => {
          const color = p._zone_color || serviceZoneManager.getProviderColor(p.id || p.provider_id);
          return { ...p, _zone_color: color };
        });
        
        // Focus on both pings and service zones
        serviceZoneManager.focusOnZonesAndPings();
      }
    } catch (err) {
      error = err.message;
      console.error('Error:', err);
    } finally {
      loading = false;
    }
  }

  function goHome() {
    push('/');
  }

  function handleReturnToForm() {
    responseData = null;
    error = null;
    formPosition = 'form';
    
    // Clear provider pings and service zones but keep origin/destination
    pingManager.removePingsByType(PingTypes.PROVIDER);
    serviceZoneManager.clearAllServiceZones();
    
    // Refocus on origin/destination if they exist
    const originPings = pingManager.getPingsByType(PingTypes.ORIGIN);
    const destinationPings = pingManager.getPingsByType(PingTypes.DESTINATION);
    if (originPings.length > 0 || destinationPings.length > 0) {
      pingManager.focusOnAllPings();
    }
  }

  function handleFocusProvider(event) {
    const provider = event.detail;
    if (!provider) return;
    const id = provider.id || provider.provider_id;
    serviceZoneManager.focusOnProvider(id);
  }

  // Service zones are now managed by serviceZoneManager
</script>

{#if mounted}
  <!-- Back Button -->
  <button
    class="fixed top-6 left-6 z-50 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200"
    on:click={goHome}
    in:fly={{ x: -50, duration: 600, delay: 200 }}
    aria-label="Go back to home page"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
    </svg>
  </button>

  <!-- Fullscreen Map -->
  <div class="fixed inset-0 z-0" in:fade={{ duration: 800 }}>
    {#key mapKey}
      <Map
        bind:this={mapComponent}
        options={{
          center: mapCenter,
          zoom: mapZoom
        }}
      >
        <TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
        
        <!-- Service Zones from Service Zone Manager -->
        {#each $visibleServiceZones as zone (zone.id)}
          {#if zone.geoJson}
            <GeoJSON
              json={zone.geoJson}
              options={{
                style: () => ({
                  color: zone.config.color,
                  weight: zone.config.weight,
                  opacity: zone.config.opacity,
                  fillOpacity: zone.config.fillOpacity,
                  fillColor: zone.config.color,
                  dashArray: zone.config.dashArray
                }),
                onEachFeature: (feature, layer) => {
                  // Enhanced hover effects
                  layer.on({
                    mouseover: (e) => {
                      const layer = e.target;
                      layer.setStyle({
                        weight: zone.config.weight + 1,
                        opacity: Math.min(zone.config.opacity + 0.2, 1),
                        fillOpacity: Math.min(zone.config.fillOpacity + 0.2, 0.6)
                      });
                      layer.bringToFront();
                    },
                    mouseout: (e) => {
                      const layer = e.target;
                      layer.setStyle({
                        weight: zone.config.weight,
                        opacity: zone.config.opacity,
                        fillOpacity: zone.config.fillOpacity
                      });
                    },
                    click: (e) => {
                      // Focus on clicked zone
                      serviceZoneManager.focusOnServiceZone(zone.id);
                    }
                  });
                  
                  // Enhanced popup with zone information
                  if (zone.config.popup) {
                    const popupContent = `
                      <div class="service-zone-popup">
                        <div class="zone-popup-header">
                          <strong>${zone.label}</strong>
                          <span class="zone-type">${zone.type}</span>
                        </div>
                        ${zone.description ? `<div class="zone-popup-description">${zone.description}</div>` : ''}
                        ${zone.metadata?.provider?.provider_org ? `<div class="zone-popup-org">🏢 ${zone.metadata.provider.provider_org}</div>` : ''}
                        ${(() => {
                          const eligRaw = zone.metadata?.provider?.eligibility_reqs;
                          let eligList = eligRaw;
                          if (eligRaw && !Array.isArray(eligRaw) && typeof eligRaw === 'object' && Array.isArray(eligRaw.eligibility_reqs)) {
                            eligList = eligRaw.eligibility_reqs;
                          }
                          if (eligList && !Array.isArray(eligList)) eligList = [String(eligList)];
                          return eligList && eligList.length
                            ? `<div class="zone-popup-eligibility">📋 ${eligList.join(', ')}</div>`
                            : '';
                        })()}
                      </div>
                    `;
                    layer.bindPopup(popupContent);
                  }
                }
              }}
            />
          {/if}
        {/each}

        <!-- Pings from Ping Manager -->
        {#each $visiblePings as ping (ping.id)}
          <Marker 
            latLng={ping.coordinates}
            popup={ping.description || ping.label}
            options={{
              title: ping.label,
              zIndexOffset: ping.config.zIndex || 0
            }}
          >
            <!-- Custom popup content -->
            <Popup>
              <div class="ping-popup">
                <div class="ping-popup-header">
                  <span class="ping-icon">{ping.config.icon}</span>
                  <strong>{ping.label}</strong>
                </div>
                {#if ping.description}
                  <div class="ping-popup-description">
                    {ping.description}
                  </div>
                {/if}
                {#if ping.metadata?.address}
                  <div class="ping-popup-address">
                    📍 {ping.metadata.address}
                  </div>
                {/if}
                {#if ping.metadata?.provider}
                  <div class="ping-popup-provider">
                    🚌 {ping.metadata.provider.provider_type}
                  </div>
                {/if}
              </div>
            </Popup>
          </Marker>
        {/each}
      </Map>
    {/key}
  </div>

  <!-- Floating Form Container -->
  {#if showForm}
    <div 
      class="fixed top-6 right-6 z-40 w-96 max-h-[calc(100vh-3rem)] overflow-y-auto"
      in:fly={{ x: 50, duration: 600, delay: 300 }}
    >
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200">
        {#if formPosition === 'form'}
          <div class="p-6" in:scale={{ duration: 400 }}>
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-gray-900">Find Providers</h2>
              {#if loading}
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              {/if}
            </div>
            
            <TransportationForm 
              {loading}
              {error}
              {responseData}
              on:submit={handleFormSubmit}
              on:originUpdate={handleOriginAddressUpdate}
              on:destinationUpdate={handleDestinationAddressUpdate}
              on:focusProvider={handleFocusProvider}
            />
          </div>
        {:else if formPosition === 'results'}
          <div class="p-6" in:scale={{ duration: 400 }}>
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-gray-900">Available Providers</h2>
              <button
                class="text-indigo-600 hover:text-indigo-700 font-medium"
                on:click={handleReturnToForm}
              >
                New Search
              </button>
            </div>
            
            <TransportationForm 
              {loading}
              {error}
              {responseData}
              on:submit={handleFormSubmit}
              on:originUpdate={handleOriginAddressUpdate}
              on:destinationUpdate={handleDestinationAddressUpdate}
              on:focusProvider={handleFocusProvider}
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}

{/if}

<style>
  :global(body) {
    overflow: hidden;
  }
  
  :global(.leaflet-container) {
    height: 100vh !important;
    width: 100vw !important;
  }
  
  /* Ping popup styling */
  :global(.ping-popup) {
    min-width: 200px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  :global(.ping-popup-header) {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 16px;
  }
  
  :global(.ping-icon) {
    font-size: 18px;
  }
  
  :global(.ping-popup-description) {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 6px;
    white-space: pre-line;
  }
  
  :global(.ping-popup-address) {
    color: #374151;
    font-size: 13px;
    margin-bottom: 4px;
  }
  
  :global(.ping-popup-provider) {
    color: #3b82f6;
    font-size: 13px;
    font-weight: 500;
  }

  /* Service zone popup styling */
  :global(.service-zone-popup) {
    min-width: 220px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  :global(.zone-popup-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 16px;
  }
  
  :global(.zone-type) {
    background: #f3f4f6;
    color: #374151;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    text-transform: capitalize;
  }
  
  :global(.zone-popup-description) {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 6px;
    white-space: pre-line;
  }
  
  :global(.zone-popup-org) {
    color: #374151;
    font-size: 13px;
    margin-bottom: 4px;
  }
  
  :global(.zone-popup-eligibility) {
    color: #059669;
    font-size: 13px;
    font-weight: 500;
  }
</style>
