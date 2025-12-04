<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fade, fly, scale } from 'svelte/transition';
  import Chat from '../components/Chat.svelte';
  import ProviderResults from '../components/ProviderResults.svelte';
  import ProviderListPanel from '../components/ProviderListPanel.svelte';
  import { Map, TileLayer, Marker, GeoJSON, Polyline } from 'sveaflet';
  import { PROVIDERS_API_BASE, CHAT_API_URL } from '../config';
  import { pingManager, PingTypes, pings, mapFocus } from '../lib/pingManager.js';
  import { serviceZoneManager, visibleServiceZones } from '../lib/serviceZoneManager.js';
  import { derived } from 'svelte/store';

  let mounted = false;
  let showChat = false;
  let showProviderResults = false;
  let providerData = null;
  let viewMode = 'chat'; // 'chat' or 'providers'
  let foundAddresses = [];
  let highlightedProviders = new Set(); // Provider IDs to highlight in the list
  
  // Derived stores for origin/destination pings and connecting line
  const originPing = derived(pings, $pings => 
    $pings.find(p => p.type === PingTypes.ORIGIN && p.visible)
  );
  
  const destinationPing = derived(pings, $pings => 
    $pings.find(p => p.type === PingTypes.DESTINATION && p.visible)
  );
  
  const connectionLine = derived([originPing, destinationPing], ([$origin, $destination]) => {
    if ($origin && $destination) {
      return {
        coordinates: [$origin.coordinates, $destination.coordinates],
        show: true
      };
    }
    return { coordinates: [], show: false };
  });
  
  // Chat examples functionality
  let showExamplesPanel = false;
  let chatExamples = [];
  let loadingExamples = false;
  let examplesError = null;
  let serverOnline = false;
  let chatComponent = null; // Reference to the chat component
  
  // Map configuration
  let mapCenter = [37.9020731, -122.0618702];
  let mapZoom = 12;
  let mapKey = 'initial'; // Force map to re-render when this changes
  
  // Map style configuration
  const mapStyles = [
    {
      id: 'light',
      name: 'Light',
      description: 'Clean, minimal style',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    {
      id: 'standard',
      name: 'Standard',
      description: 'OpenStreetMap default',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    {
      id: 'dark',
      name: 'Dark',
      description: 'Dark theme',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    {
      id: 'satellite',
      name: 'Satellite',
      description: 'Satellite imagery',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    },
    {
      id: 'terrain',
      name: 'Terrain',
      description: 'Topographic view',
      url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    {
      id: 'voyager',
      name: 'Voyager',
      description: 'Balanced detail',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  ];
  
  let currentMapStyle = mapStyles[5]; // Default to voyager style
  let showStyleSwitcher = false;
  
  // Reactive statements for ping system integration - DISABLED to prevent map movement
  // $: if ($mapFocus.shouldFocus) {
  //   mapCenter = $mapFocus.center;
  //   mapZoom = $mapFocus.zoom;
  //   mapKey = Date.now().toString();
  //   // Reset the focus trigger
  //   pingManager.resetFocus();
  // }
  
  onMount(async () => {
    mounted = true;
    await checkServerHealth();
    if (serverOnline) {
      await loadChatExamples();
    }
    // Load saved map style from localStorage
    const savedStyle = localStorage.getItem('optimat-map-style');
    if (savedStyle) {
      const style = mapStyles.find(s => s.id === savedStyle);
      if (style) {
        currentMapStyle = style;
      }
    }
    // Show chat after a brief delay for animation
    setTimeout(() => {
      showChat = true;
    }, 500);
  });
  
  function changeMapStyle(style) {
    currentMapStyle = style;
    showStyleSwitcher = false;
    mapKey = Date.now().toString(); // Force map re-render
    // Save preference to localStorage
    localStorage.setItem('optimat-map-style', style.id);
  }
  
  function handleClickOutside(event) {
    if (showStyleSwitcher && !event.target.closest('.style-switcher')) {
      showStyleSwitcher = false;
    }
  }
  
  const PROVIDER_API_BASE = PROVIDERS_API_BASE;
  const CHAT_API_BASE = CHAT_API_URL;

  async function checkServerHealth() {
    try {
      const response = await fetch(`${CHAT_API_BASE}/health`);
      serverOnline = response.ok;
      if (!serverOnline) {
        examplesError = "Chat server is currently offline.";
      }
    } catch (e) {
      serverOnline = false;
      examplesError = "Failed to connect to the chat server.";
    }
  }

  async function loadChatExamples() {
    loadingExamples = true;
    examplesError = null;
    
    try {
      const response = await fetch(`${CHAT_API_BASE}/chat-examples?is_active=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to load examples: ${response.status}`);
      }
      
      chatExamples = await response.json();
    } catch (error) {
      examplesError = error.message;
      chatExamples = [];
    } finally {
      loadingExamples = false;
    }
  }

  function goHome() {
    push('/');
  }

  async function geocodeAddress(address) {
    try {
      const url = `${PROVIDER_API_BASE}/providers/geocode?address=${encodeURIComponent(address)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.coordinates) {
        const { longitude, latitude } = data.coordinates;
        return [latitude, longitude];
      }

      return null;

    } catch (err) {
      return null;
    }
  }

  async function handleAddressFound(event) {
    const { address, messageRole, placeName } = event.detail;
    
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      foundAddresses.push({ address, coordinates, role: messageRole, placeName });
      
      // Handle address attachment clicks differently - always center on the clicked address
      if (messageRole === 'attachment_click') {
        // For address attachment clicks, create a ping and center the map
        const label = placeName || address;
        const description = placeName ? `${placeName}\n${address}` : address;
        
        pingManager.addPing({
          type: PingTypes.SEARCH_RESULT,
          coordinates: coordinates,
          label: label,
          description: description,
          metadata: { 
            source: 'address_attachment',
            address: address,
            placeName: placeName 
          }
        }, false); // Don't focus on this ping
        
        // Switch to chat view to show the map prominently
        if (viewMode === 'providers') {
          viewMode = 'chat';
          showProviderResults = false;
        }
      } else {
        // Original logic for system/regular address updates
        if (foundAddresses.length === 1) {
          // First address becomes origin
          pingManager.addPing({
            type: PingTypes.ORIGIN,
            coordinates: coordinates,
            label: placeName || "Origin",
            description: address,
            metadata: { 
              source: 'system_geocode',
              address: address,
              placeName: placeName 
            }
          }, false);
        } else if (foundAddresses.length === 2) {
          // Second address becomes destination
          pingManager.addPing({
            type: PingTypes.DESTINATION,
            coordinates: coordinates,
            label: placeName || "Destination", 
            description: address,
            metadata: { 
              source: 'system_geocode',
              address: address,
              placeName: placeName 
            }
          }, false); // Don't focus yet
          
          // Don't focus on all pings to avoid moving the map
          // pingManager.focusOnAllPings();
        } else {
          // For subsequent addresses, update the destination
          pingManager.removePingsByType(PingTypes.DESTINATION);
          pingManager.addPing({
            type: PingTypes.DESTINATION,
            coordinates: coordinates,
            label: placeName || "Destination",
            description: address,
            metadata: { 
              source: 'system_geocode',
              address: address,
              placeName: placeName 
            }
          }, false);
          
          // Don't focus on all pings to avoid moving the map
          // pingManager.focusOnAllPings();
        }
      }
    }
  }

  async function handleProvidersFound(event) {
    providerData = event.detail;
    showProviderResults = true;
    viewMode = 'providers'; // Switch to provider view
    
    // Update highlighted providers
    if (providerData && providerData.data && Array.isArray(providerData.data)) {
      highlightedProviders = new Set(providerData.data.map(p => p.provider_id));
      console.log(`Highlighting ${highlightedProviders.size} providers`);
    }
    
    // Pause example playback if currently playing
    if (chatComponent) {
      chatComponent.pauseExamplePlayback();
    }
    
    // Clear existing service zones when new providers are found
    serviceZoneManager.clearAllServiceZones();
    
    // Clear old search result pings and create new ones for provider search
    pingManager.removePingsByType(PingTypes.SEARCH_RESULT);
    pingManager.removePingsByType(PingTypes.ORIGIN);
    pingManager.removePingsByType(PingTypes.DESTINATION);
    
    // Create pings for origin and destination if we have trip details
    if (providerData.source_address && providerData.destination_address) {
      await createProviderSearchPings();
    }
  }
  
  async function createProviderSearchPings() {
    if (!providerData || !providerData.source_address || !providerData.destination_address) {
      return;
    }
    
    // Geocode both addresses
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(providerData.source_address),
      geocodeAddress(providerData.destination_address)
    ]);
    
    const pingsToAdd = [];
    
    if (originCoords) {
      pingsToAdd.push({
        type: PingTypes.ORIGIN,
        coordinates: originCoords,
        label: "Origin",
        description: providerData.source_address,
        metadata: { 
          source: 'provider_search',
          address: providerData.source_address
        }
      });
    }
    
    if (destCoords) {
      pingsToAdd.push({
        type: PingTypes.DESTINATION,
        coordinates: destCoords,
        label: "Destination", 
        description: providerData.destination_address,
        metadata: { 
          source: 'provider_search',
          address: providerData.destination_address
        }
      });
    }
    
    // Add all pings without focusing to avoid moving the map
    if (pingsToAdd.length > 0) {
      pingManager.addPings(pingsToAdd, false);
    }
  }
  
  // Calculate distance between two coordinates in kilometers
  function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function handleCloseProviderResults() {
    showProviderResults = false;
    viewMode = 'chat'; // Switch back to chat view
    // Clear highlights when closing provider results
    highlightedProviders = new Set();
    // Clear service zones when closing
    serviceZoneManager.clearAllServiceZones();
    
    // Clear provider-related pings but keep any address pings
    pingManager.removePingsByType(PingTypes.ORIGIN);
    pingManager.removePingsByType(PingTypes.DESTINATION);
    
    // Resume example playback if it was paused
    if (chatComponent) {
      chatComponent.resumeExamplePlayback();
    }
  }
  
  function backToChat() {
    viewMode = 'chat';
    showProviderResults = false;
    // Clear highlights when going back to chat
    highlightedProviders = new Set();
    serviceZoneManager.clearAllServiceZones();
    
    // Clear provider-related pings but keep any address pings
    pingManager.removePingsByType(PingTypes.ORIGIN);
    pingManager.removePingsByType(PingTypes.DESTINATION);
    
    // Resume example playback if it was paused
    if (chatComponent) {
      chatComponent.resumeExamplePlayback();
    }
  }
  
  function handleNewConversationStarted() {
    // Clear all pings when starting a new conversation
    pingManager.clearAllPings();
    // Clear highlights
    highlightedProviders = new Set();
    // Clear service zones
    serviceZoneManager.clearAllServiceZones();
    // Reset provider results state
    showProviderResults = false;
    viewMode = 'chat';
  }
  
  async function viewChatExample(example) {
    try {
      // Clear all existing pings before loading example
      pingManager.clearAllPings();
      
      // Fetch the conversation messages and tool calls
      const [messagesResponse, toolCallsResponse] = await Promise.all([
        fetch(`${CHAT_API_BASE}/conversations/${example.conversation_id}/messages`),
        fetch(`${CHAT_API_BASE}/conversations/${example.conversation_id}/tool-calls`)
      ]);
      
      if (!messagesResponse.ok) {
        throw new Error(`Failed to load conversation: ${messagesResponse.status}`);
      }
      
      if (!toolCallsResponse.ok) {
        throw new Error(`Failed to load tool calls: ${toolCallsResponse.status}`);
      }
      
      const messagesData = await messagesResponse.json();
      const toolCallsData = await toolCallsResponse.json();
      
      
      // Build conversation states using state reconstruction
      const conversationStates = buildConversationStates(messagesData.messages, toolCallsData.tool_calls);
      
      
      if (chatComponent) {
        // Load the example conversation with state reconstruction
        await chatComponent.loadExampleWithStates(conversationStates, example);
      }
      
      // Close the examples panel
      showExamplesPanel = false;
    } catch (error) {
      examplesError = `Failed to load example: ${error.message}`;
    }
  }

  function buildConversationStates(messages, toolCalls) {
    // Build conversation state at each message point
    const states = [];
    let currentProviders = null;
    
    
    // Filter and sort messages chronologically
    const sortedMessages = messages
      .filter(msg => msg.role !== 'system' && msg.created_at)
      .sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateA.getTime() - dateB.getTime();
      });
    
    
    // Find the find_providers tool call if it exists
    if (toolCalls.find_providers && toolCalls.find_providers.length > 0) {
      const providerCall = toolCalls.find_providers[0];
      
      if (providerCall.provider_data) {
        currentProviders = {
          data: providerCall.provider_data,
          source_address: providerCall.source_address,
          destination_address: providerCall.destination_address
        };
      }
    }
    
    // Build states for each message
    let providersAlreadyShown = false;
    
    for (let i = 0; i < sortedMessages.length; i++) {
      const message = sortedMessages[i];
      
      // Check if this is the AI message that should show providers
      // Look for more specific phrases that indicate the first provider result message
      const isProviderMessage = message.role === 'ai' && 
        currentProviders && 
        (message.content.includes('I found a provider') || 
         message.content.includes('found a provider') ||
         message.content.includes('found providers') ||
         message.content.includes('I found several transportation') ||
         message.content.includes('I found the nearest') ||
         message.content.includes('found the nearest') ||
         (message.content.includes('provider') && message.content.includes('take you')) ||
         (message.content.includes('Trip Details') && message.content.includes('From:')));
      
      // Only show providers on the first matching message
      const shouldShowProviders = isProviderMessage && !providersAlreadyShown;
      
      if (shouldShowProviders) {
        providersAlreadyShown = true;
      }
      
      
      states.push({
        message: message,
        state: {
          providers: shouldShowProviders ? currentProviders : null,
          hasProviders: shouldShowProviders
        }
      });
    }
    
    return states;
  }
</script>

<svelte:window on:click={handleClickOutside} />

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

  <!-- Map Style Switcher -->
  <div class="fixed top-6 left-20 z-50 style-switcher" in:fly={{ x: -50, duration: 600, delay: 300 }}>
    <div class="relative">
      <button
        class="bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 flex items-center gap-2"
        on:click={() => showStyleSwitcher = !showStyleSwitcher}
        aria-label="Change map style"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
        </svg>
        <span class="text-sm font-medium">{currentMapStyle.name}</span>
        <svg class="w-4 h-4 transition-transform duration-200 {showStyleSwitcher ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {#if showStyleSwitcher}
        <div class="absolute top-full left-0 mt-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 py-2 min-w-48"
             in:fly={{ y: -10, duration: 200 }}>
          {#each mapStyles as style}
            <button
              class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-between group {currentMapStyle.id === style.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}"
              on:click={() => changeMapStyle(style)}
            >
              <div>
                <div class="font-medium text-sm">{style.name}</div>
                <div class="text-xs text-gray-500 group-hover:text-gray-600">{style.description}</div>
              </div>
              {#if currentMapStyle.id === style.id}
                <svg class="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Provider List Panel -->
  {#if showChat}
    <ProviderListPanel {highlightedProviders} />
  {/if}

  <!-- Fullscreen Map Background -->
  <div class="fixed inset-0 z-0" in:fade={{ duration: 800 }}>
    {#key mapKey}
      <Map
        options={{
          center: mapCenter,
          zoom: mapZoom
        }}
      >
          <TileLayer url={currentMapStyle.url} 
                     options={{
                       attribution: currentMapStyle.attribution,
                       maxZoom: 19
                     }} />
          
          <!-- Service Zones from Service Zone Manager -->
          {#each $visibleServiceZones as zone (zone.id)}
            {#if zone.geoJson}
              <GeoJSON
                json={zone.geoJson}
                options={{
                  style: () => zone.config,
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
                        layer.setStyle(zone.config);
                      },
                      click: (e) => {
                        // Focus on clicked zone
                        serviceZoneManager.focusOnServiceZone(zone.id);
                      }
                    });
                    
                    // Enhanced popup with zone information
                    const popupContent = `
                      <div class="service-zone-popup">
                        <div class="zone-popup-header">
                          <strong>${zone.label}</strong>
                          <span class="zone-type">${zone.type}</span>
                        </div>
                        ${zone.description ? `<div class="zone-popup-description">${zone.description}</div>` : ''}
                        ${zone.metadata?.provider?.provider_org ? `<div class="zone-popup-org">🏢 ${zone.metadata.provider.provider_org}</div>` : ''}
                        ${zone.metadata?.provider?.eligibility_req ? `<div class="zone-popup-eligibility">📋 ${zone.metadata.provider.eligibility_req}</div>` : ''}
                      </div>
                    `;
                    layer.bindPopup(popupContent);
                  }
                }}
              />
            {/if}
          {/each}
          
          <!-- Connection Line between Origin and Destination -->
          {#if $connectionLine.show}
            <Polyline
              latLngs={$connectionLine.coordinates}
              options={{
                color: '#6366f1',
                weight: 3,
                opacity: 0.8,
                dashArray: '10, 5'
              }}
            />
          {/if}
          
          <!-- Ping-based Markers with Animation and Labels -->
          {#each $pings.filter(ping => ping.visible) as ping (ping.id)}
            <Marker 
              latLng={ping.coordinates}
              popup={`
                <div class="ping-popup">
                  <div class="ping-popup-header">
                    <strong>${ping.type === PingTypes.ORIGIN ? '🚀 Origin' : 
                             ping.type === PingTypes.DESTINATION ? '🎯 Destination' : 
                             `${ping.config.icon} ${ping.label}`}</strong>
                  </div>
                  <div class="ping-popup-content">
                    ${ping.description || ping.label}
                  </div>
                </div>
              `}
              options={{
                className: `ping-marker-${ping.type} animated-marker`
              }}
            />
          {/each}
      </Map>
    {/key}
  </div>

  <!-- Examples Panel - Always Visible -->
  {#if showChat && viewMode === 'chat'}
    <div 
      class="fixed bottom-40 left-6 z-40 max-w-sm max-h-40"
      in:fly={{ y: 50, duration: 600, delay: 400 }}
    >
      <div class="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 flex flex-col">
        <div class="p-3 border-b border-gray-200 flex-shrink-0">
          <h3 class="text-sm font-bold text-gray-900">Chat Examples</h3>
          
          {#if !serverOnline}
            <div class="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
              <p class="text-xs text-yellow-700">
                Chat server is offline. Examples are unavailable.
              </p>
            </div>
          {/if}
        </div>
        
        <!-- Examples List -->
        <div class="overflow-y-auto p-2 space-y-1 max-h-32">
          {#if loadingExamples}
            <div class="flex items-center justify-center py-4">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              <span class="ml-2 text-xs text-gray-600">Loading...</span>
            </div>
          {:else if chatExamples.length === 0}
            <div class="text-center py-4">
              <p class="text-xs text-gray-500">No examples available yet</p>
            </div>
          {:else}
            {#each chatExamples as example}
              <button
                class="w-full text-left p-2 border border-gray-200 rounded hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200"
                on:click={() => viewChatExample(example)}
                disabled={!serverOnline}
              >
                <h4 class="font-medium text-gray-900 text-xs">
                  {example.title || 'Untitled Example'}
                </h4>
                {#if example.description}
                  <p class="text-xs text-gray-600 mt-1 line-clamp-2">{example.description}</p>
                {/if}
                {#if example.tags && example.tags.length > 0}
                  <div class="flex flex-wrap gap-1 mt-1">
                    {#each example.tags.slice(0, 2) as tag}
                      <span class="inline-block bg-indigo-100 text-indigo-800 text-xs px-1 py-0.5 rounded">
                        {tag}
                      </span>
                    {/each}
                    {#if example.tags.length > 2}
                      <span class="text-xs text-gray-500">+{example.tags.length - 2}</span>
                    {/if}
                  </div>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
        
        {#if examplesError}
          <div class="p-2 border-t border-gray-200 bg-red-50">
            <p class="text-xs text-red-700">
              <strong>Error:</strong> {examplesError}
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Main Content Container -->
  {#if showChat}
    <div 
      class="fixed top-6 right-6 z-40 w-[36rem] h-[calc(100vh-3rem)]"
      in:fly={{ x: 50, duration: 600, delay: 300 }}
    >
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 h-full flex flex-col">
        
        <!-- Chat View Header -->
        <div class="p-6 border-b border-gray-200 flex-shrink-0" class:hidden={viewMode !== 'chat'} in:scale={{ duration: 400 }}>
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-900">AI Assistant</h2>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span class="text-sm text-gray-600">Online</span>
            </div>
          </div>
          <p class="text-gray-600 mt-2 text-sm">
            Ask me about transportation options and I'll help you find the best providers for your needs.
          </p>
        </div>
        
        <!-- Provider Results Header -->
        <div class="p-6 border-b border-gray-200 flex-shrink-0" class:hidden={viewMode !== 'providers'} in:fly={{ x: 30, duration: 400 }}>
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <button
                on:click={backToChat}
                class="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Back to chat"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
              </button>
              <div>
                <h2 class="text-2xl font-bold text-gray-900">Transportation Providers</h2>
                <div class="flex items-center space-x-2">
                  <p class="text-sm text-gray-600">
                    {providerData?.data?.length || 0} provider{(providerData?.data?.length || 0) !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Chat Content (always rendered, but hidden when in provider view) -->
        <div class="flex-1 min-h-0 rounded-b-2xl overflow-hidden" class:hidden={viewMode !== 'chat'} in:scale={{ duration: 400, delay: 200 }}>
          <Chat 
            bind:this={chatComponent}
            on:providersFound={handleProvidersFound}
            on:addressFound={handleAddressFound}
            on:newConversationStarted={handleNewConversationStarted}
          />
        </div>
        
        <!-- Provider Results Content -->
        <div class="flex-1 min-h-0 rounded-b-2xl overflow-hidden" class:hidden={viewMode !== 'providers'} in:fly={{ x: 30, duration: 400, delay: 100 }}>
          <ProviderResults 
            {providerData}
            show={viewMode === 'providers'}
            embedded={true}
            on:close={handleCloseProviderResults}
          />
        </div>
        
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
  
  /* Service zone popup styling */
  :global(.service-zone-popup) {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 250px;
  }
  
  :global(.zone-popup-header) {
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  :global(.zone-type) {
    background: #f3f4f6;
    color: #6b7280;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
    text-transform: uppercase;
    font-weight: 500;
  }
  
  :global(.zone-popup-description) {
    font-size: 13px;
    color: #4b5563;
    margin-bottom: 4px;
  }
  
  :global(.zone-popup-org),
  :global(.zone-popup-eligibility) {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 2px;
  }
  
  /* Animated Marker Styles */
  :global(.animated-marker) {
    animation: dropIn 0.6s ease-out;
    transform-origin: bottom center;
  }
  
  :global(.ping-marker-origin .leaflet-marker-icon) {
    background-color: #10B981 !important;
    border: 3px solid white !important;
    border-radius: 50% !important;
    width: 28px !important;
    height: 28px !important;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4) !important;
  }
  
  :global(.ping-marker-destination .leaflet-marker-icon) {
    background-color: #EF4444 !important;
    border: 3px solid white !important;
    border-radius: 50% !important;
    width: 28px !important;
    height: 28px !important;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4) !important;
  }
  
  :global(.ping-marker-search_result .leaflet-marker-icon) {
    background-color: #8B5CF6 !important;
    border: 3px solid white !important;
    border-radius: 50% !important;
    width: 24px !important;
    height: 24px !important;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4) !important;
  }
  
  /* Popup Styles */
  :global(.ping-popup) {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 200px;
  }
  
  :global(.ping-popup-header) {
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
  }
  
  :global(.ping-popup-content) {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.4;
  }
  
  /* Drop-in Animation */
  :global {
    @keyframes dropIn {
      0% {
        transform: translateY(-40px) scale(0.3);
        opacity: 0;
      }
      60% {
        transform: translateY(5px) scale(1.1);
        opacity: 0.9;
      }
      100% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
    
    @keyframes pulse {
      0% {
        transform: scale(0.8);
        opacity: 1;
      }
      100% {
        transform: scale(1.4);
        opacity: 0;
      }
    }
  }
  
  /* Pulse effect for origin/destination markers */
  :global(.ping-marker-origin .leaflet-marker-icon::before),
  :global(.ping-marker-destination .leaflet-marker-icon::before) {
    content: '';
    position: absolute;
    top: -6px;
    left: -6px;
    right: -6px;
    bottom: -6px;
    border-radius: 50%;
    border: 2px solid currentColor;
    opacity: 0;
    animation: pulse 2s infinite;
  }
</style>
