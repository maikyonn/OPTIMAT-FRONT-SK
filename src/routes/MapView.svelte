<script>
  import { onMount, onDestroy } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fade } from 'svelte/transition';
  import TransportationForm from '../components/TransportationForm.svelte';
  import ProviderResults from '../components/ProviderResults.svelte';
  import { Map, TileLayer, Marker, Popup, GeoJSON } from 'sveaflet';
  import { PROVIDERS_API_BASE } from '../config';
  import { pingManager, PingTypes, pings, mapFocus, visiblePings } from '../lib/pingManager.js';
  import { serviceZoneManager, ServiceZoneTypes, visibleServiceZones } from '../lib/serviceZoneManager.js';
  import { Card } from '$lib/components/ui/card';
  import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '$lib/components/ui/resizable';

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
    setTimeout(() => {
      showForm = true;
    }, 200);
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
  <div class="flex flex-col h-screen bg-background text-foreground">
    <div class="flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal" class="h-full">
        <ResizablePanel defaultSize={70} minSize={45} class="relative bg-muted/10">
          <div class="absolute inset-0" in:fade={{ duration: 400 }}>
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
                            click: () => serviceZoneManager.focusOnServiceZone(zone.id)
                          });
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
        </ResizablePanel>

        <ResizableHandle withHandle class="border-border bg-border/40" />

        <ResizablePanel defaultSize={30} minSize={25} class="h-full overflow-y-auto border-l border-border/60 bg-card">
          <div class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <button
                class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                on:click={goHome}
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                Back
              </button>
              {#if loading}
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              {/if}
            </div>
            <Card class="shadow-none border-border/60">
              <div class="p-4">
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
            </Card>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>

    <!-- Bottom provider results -->
    <div class="border-t border-border/60 bg-card/90 backdrop-blur px-4 py-3">
      <ProviderResults {responseData} on:focusProvider={handleFocusProvider} />
    </div>
  </div>
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
