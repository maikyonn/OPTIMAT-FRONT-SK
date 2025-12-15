<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Map, TileLayer, GeoJSON, Marker } from 'sveaflet';
  import { PROVIDERS_API_BASE } from '../config';
  import { serviceZoneManager, visibleServiceZones } from '../lib/serviceZoneManager.js';
  import PageShell from '$lib/components/PageShell.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Resizable from '$lib/components/ui/resizable/index.js';

  let mounted = false;
  let providers = [];
  let loading = true;
  let error = null;
  let selectedProvider = null;
  let editMode = false;
  let saving = false;
  let saveError = null;
  let saveSuccess = false;

  // Editable form data
  let editForm = {};

  // Map configuration
  let mapCenter = [37.9020731, -122.0618702];
  let mapZoom = 10;
  let mapKey = 'initial';

  const mapStyles = [
    { id: 'voyager', name: 'Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap & CARTO' },
    { id: 'standard', name: 'Standard', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
    { id: 'light', name: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap & CARTO' },
    { id: 'dark', name: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap & CARTO' }
  ];
  let currentMapStyleId = mapStyles[0].id;
  $: currentMapStyle = mapStyles.find((s) => s.id === currentMapStyleId) || mapStyles[0];

  onMount(async () => {
    mounted = true;
    const savedStyleId = localStorage.getItem('optimat-map-style');
    const savedStyle = mapStyles.find((s) => s.id === savedStyleId);
    if (savedStyle) {
      currentMapStyleId = savedStyle.id;
    }
    await loadProviders();
  });

  onDestroy(() => {
    serviceZoneManager.clearAllServiceZones();
  });

  async function loadProviders() {
    loading = true;
    error = null;
    try {
      const response = await fetch(`${PROVIDERS_API_BASE}/providers`);
      if (!response.ok) {
        throw new Error(`Failed to load providers: ${response.status}`);
      }
      const result = await response.json();
      // API returns { data: [...] } structure
      providers = result.data || result;
    } catch (err) {
      error = err.message;
      providers = [];
    } finally {
      loading = false;
    }
  }

  function changeMapStyle(id) {
    const style = mapStyles.find((s) => s.id === id);
    if (!style) return;
    currentMapStyleId = style.id;
    localStorage.setItem('optimat-map-style', style.id);
    mapKey = Date.now().toString();
  }

  function selectProvider(provider) {
    const providerId = provider.provider_id || provider.id;
    const selectedId = selectedProvider?.provider_id || selectedProvider?.id;

    // Toggle selection
    if (selectedId === providerId) {
      selectedProvider = null;
      editMode = false;
      editForm = {};
      serviceZoneManager.clearAllServiceZones();
    } else {
      selectedProvider = provider;
      editMode = false;
      editForm = { ...provider };
      showProviderZoneOnMap(provider);
    }
    saveSuccess = false;
    saveError = null;
  }

  function showProviderZoneOnMap(provider) {
    if (!provider) return;
    const providerId = provider.provider_id || provider.id;
    serviceZoneManager.clearAllServiceZones();

    if (provider.service_zone) {
      try {
        const geoJson = typeof provider.service_zone === 'string'
          ? JSON.parse(provider.service_zone)
          : provider.service_zone;

        serviceZoneManager.addServiceZone({
          type: 'provider',
          geoJson: geoJson,
          label: provider.provider_name,
          description: `${provider.provider_name} service area`,
          metadata: { providerId: providerId, provider: provider },
          config: { color: '#8b5cf6', fillOpacity: 0.2 }
        }, true);
      } catch (e) {
        console.error('Error parsing provider service zone:', e);
      }
    }
  }

  function enableEditMode() {
    editMode = true;
    // Copy provider data, converting object fields to JSON strings for editing
    editForm = { ...selectedProvider };

    // Convert service_zone object to formatted JSON string for textarea editing
    if (editForm.service_zone && typeof editForm.service_zone === 'object') {
      editForm.service_zone = JSON.stringify(editForm.service_zone, null, 2);
    }

    saveSuccess = false;
    saveError = null;
  }

  function cancelEdit() {
    editMode = false;
    editForm = { ...selectedProvider };
    saveError = null;
  }

  async function saveProvider() {
    if (!selectedProvider) return;

    saving = true;
    saveError = null;
    saveSuccess = false;

    try {
      const providerId = selectedProvider.provider_id || selectedProvider.id;

      // Only send updatable fields to the API
      // service_zone might be an object (GeoJSON), needs to be stringified
      let serviceZoneValue = editForm.service_zone;
      if (serviceZoneValue && typeof serviceZoneValue === 'object') {
        serviceZoneValue = JSON.stringify(serviceZoneValue);
      }

      const updatePayload = {
        provider_name: editForm.provider_name,
        provider_type: editForm.provider_type,
        routing_type: editForm.routing_type,
        schedule_type: editForm.schedule_type,
        eligibility_reqs: editForm.eligibility_reqs,
        booking: editForm.booking,
        fare: editForm.fare,
        contacts: editForm.contacts,
        website: editForm.website,
        round_trip_booking: editForm.round_trip_booking,
        investigated: editForm.investigated,
        service_zone: serviceZoneValue,
      };

      // Remove null/undefined values
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] === null || updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      });

      const response = await fetch(`${PROVIDERS_API_BASE}/providers/${providerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to save provider' }));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const updatedProvider = await response.json();

      // Update the provider in the list
      providers = providers.map(p => {
        const pId = p.provider_id || p.id;
        if (pId === providerId) {
          return updatedProvider;
        }
        return p;
      });

      selectedProvider = updatedProvider;
      editForm = { ...updatedProvider };
      editMode = false;
      saveSuccess = true;

      // Update map if service zone changed
      showProviderZoneOnMap(updatedProvider);

      // Clear success message after 3 seconds
      setTimeout(() => {
        saveSuccess = false;
      }, 3000);

    } catch (err) {
      saveError = err.message;
    } finally {
      saving = false;
    }
  }

  function getProviderTypeIcon(type) {
    if (type?.includes('paratransit') || type?.includes('ADA')) return '?';
    if (type?.includes('fix') || type?.includes('fixed')) return '?';
    if (type?.includes('dial') || type?.includes('demand')) return '?';
    return '?';
  }

  function getProviderTypeColor(type) {
    if (type?.includes('paratransit') || type?.includes('ADA')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (type?.includes('fix') || type?.includes('fixed')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (type?.includes('dial') || type?.includes('demand')) return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }

  function formatJsonField(value) {
    if (!value) return '';
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  }

  function parseJsonField(value) {
    if (!value || typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
</script>

{#if mounted}
  <PageShell
    title="Providers Info"
    description="View and manage transportation providers"
    appMode={true}
  >
    <!-- Main horizontal layout: Left (Map + Provider List) | Right (Provider Details) -->
    <Resizable.PaneGroup direction="horizontal" class="flex-1 h-full">
      <!-- Left: Nested vertical panels (Map top, Provider List bottom) -->
      <Resizable.Pane defaultSize={55} minSize={35} class="relative">
        <Resizable.PaneGroup direction="vertical" class="h-full">
          <!-- Top: Map Panel -->
          <Resizable.Pane defaultSize={55} minSize={30} class="relative">
            <!-- Map style selector -->
            <div class="absolute top-2 left-2 z-10 rounded-md border border-border/50 bg-background/95 backdrop-blur px-2 py-1.5 shadow-sm">
              <select
                class="bg-transparent text-xs border-0 focus:ring-0 cursor-pointer"
                bind:value={currentMapStyleId}
                onchange={(e) => changeMapStyle(e.target.value)}
              >
                {#each mapStyles as style}
                  <option value={style.id}>{style.name}</option>
                {/each}
              </select>
            </div>

            <div class="absolute inset-0" in:fade={{ duration: 400 }}>
              {#key mapKey}
                <Map options={{ center: mapCenter, zoom: mapZoom }}>
                  <TileLayer url={currentMapStyle.url} options={{ attribution: currentMapStyle.attribution, maxZoom: 19 }} />

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
                                  weight: (zone.config.weight || 2) + 1,
                                  opacity: Math.min((zone.config.opacity || 0.8) + 0.2, 1),
                                  fillOpacity: Math.min((zone.config.fillOpacity || 0.2) + 0.2, 0.6)
                                });
                                layer.bringToFront();
                              },
                              mouseout: (e) => {
                                const layer = e.target;
                                layer.setStyle(zone.config);
                              },
                              click: () => serviceZoneManager.focusOnServiceZone(zone.id)
                            });
                            const popupContent = `
                              <div class="service-zone-popup">
                                <div class="zone-popup-header">
                                  <strong>${zone.label}</strong>
                                </div>
                                ${zone.description ? `<div class="zone-popup-description">${zone.description}</div>` : ''}
                              </div>
                            `;
                            layer.bindPopup(popupContent);
                          }
                        }}
                      />
                    {/if}
                  {/each}
                </Map>
              {/key}
            </div>
          </Resizable.Pane>

          <Resizable.Handle withHandle />

          <!-- Bottom: Provider List Panel -->
          <Resizable.Pane defaultSize={45} minSize={25} class="flex flex-col overflow-hidden bg-card border-t border-border/40">
            <!-- Provider List Header -->
            <div class="flex-shrink-0 border-b border-border/40 px-3 py-2 bg-muted/30">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Providers ({providers.length})
                </span>
                <button
                  class="text-xs text-primary hover:text-primary/80 transition"
                  onclick={loadProviders}
                  disabled={loading}
                >
                  {#if loading}
                    <span class="animate-spin inline-block">...</span>
                  {:else}
                    Refresh
                  {/if}
                </button>
              </div>
            </div>

            <!-- Provider List Content -->
            <div class="flex-1 overflow-y-auto p-2">
              {#if loading}
                <div class="flex items-center justify-center h-32">
                  <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                </div>
              {:else if error}
                <div class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              {:else if providers.length === 0}
                <div class="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No providers found
                </div>
              {:else}
                <div class="space-y-2">
                  {#each providers as provider (provider.provider_id || provider.id)}
                    {@const providerId = provider.provider_id || provider.id}
                    {@const isSelected = (selectedProvider?.provider_id || selectedProvider?.id) === providerId}
                    <button
                      class="w-full text-left rounded-lg border p-3 transition {
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-md ring-1 ring-primary/50'
                          : 'bg-card border-border/60 hover:bg-muted/50 hover:border-border'
                      }"
                      onclick={() => selectProvider(provider)}
                    >
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">{getProviderTypeIcon(provider.provider_type)}</span>
                        <span class="font-semibold text-sm text-foreground truncate">{provider.provider_name}</span>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <span class="px-1.5 py-0.5 rounded {getProviderTypeColor(provider.provider_type)}">
                          {provider.provider_type || 'Unknown'}
                        </span>
                        {#if provider.routing_type}
                          <span class="truncate">| {provider.routing_type}</span>
                        {/if}
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </Resizable.Pane>
        </Resizable.PaneGroup>
      </Resizable.Pane>

      <Resizable.Handle withHandle />

      <!-- Right: Provider Details Panel -->
      <Resizable.Pane defaultSize={45} minSize={30} class="bg-card border-l border-border/40 flex flex-col overflow-hidden">
        <!-- Details Header -->
        <div class="flex-shrink-0 border-b border-border/40 px-3 py-2 bg-muted/30">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Provider Details
            </span>
            {#if selectedProvider && !editMode}
              <button
                class="text-xs text-primary hover:text-primary/80 transition flex items-center gap-1"
                onclick={enableEditMode}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            {/if}
          </div>
        </div>

        <!-- Details Content -->
        <div class="flex-1 overflow-y-auto p-4">
          {#if !selectedProvider}
            <div class="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <svg class="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p class="text-sm">Select a provider to view details</p>
            </div>
          {:else}
            <!-- Success/Error Messages -->
            {#if saveSuccess}
              <div class="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" transition:fade>
                Provider saved successfully!
              </div>
            {/if}
            {#if saveError}
              <div class="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" transition:fade>
                {saveError}
              </div>
            {/if}

            <div class="space-y-4">
              <!-- Provider ID (read-only) -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Provider ID</label>
                <div class="text-sm text-foreground font-mono bg-muted/30 rounded px-2 py-1">{selectedProvider.provider_id || '-'}</div>
              </div>

              <!-- Provider Name -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Provider Name</label>
                {#if editMode}
                  <Input
                    bind:value={editForm.provider_name}
                    placeholder="Provider name"
                    class="text-sm"
                  />
                {:else}
                  <div class="text-sm font-semibold text-foreground">{selectedProvider.provider_name || '-'}</div>
                {/if}
              </div>

              <!-- Provider Type -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Provider Type</label>
                {#if editMode}
                  <Input
                    bind:value={editForm.provider_type}
                    placeholder="e.g., ADA paratransit, fixed-route"
                    class="text-sm"
                  />
                {:else}
                  <div class="text-sm text-foreground">{selectedProvider.provider_type || '-'}</div>
                {/if}
              </div>

              <!-- Routing Type -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Routing Type</label>
                {#if editMode}
                  <Input
                    bind:value={editForm.routing_type}
                    placeholder="e.g., deviated fixed-route"
                    class="text-sm"
                  />
                {:else}
                  <div class="text-sm text-foreground">{selectedProvider.routing_type || '-'}</div>
                {/if}
              </div>

              <!-- Schedule Type -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Schedule Type</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.schedule_type}
                    placeholder="Schedule type (JSON format)"
                    class="text-sm font-mono"
                    rows="2"
                  />
                {:else}
                  <div class="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-24 overflow-y-auto">
                    {formatJsonField(selectedProvider.schedule_type) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Eligibility Requirements -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Eligibility Requirements</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.eligibility_reqs}
                    placeholder="Eligibility requirements (JSON or text)"
                    class="text-sm font-mono"
                    rows="3"
                  />
                {:else}
                  <div class="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-24 overflow-y-auto">
                    {formatJsonField(selectedProvider.eligibility_reqs) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Booking -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Booking</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.booking}
                    placeholder="Booking information (JSON format)"
                    class="text-sm font-mono"
                    rows="2"
                  />
                {:else}
                  <div class="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-24 overflow-y-auto">
                    {formatJsonField(selectedProvider.booking) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Website -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Website</label>
                {#if editMode}
                  <Input
                    bind:value={editForm.website}
                    placeholder="https://example.com"
                    class="text-sm"
                  />
                {:else}
                  {#if selectedProvider.website}
                    <a
                      href={selectedProvider.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-sm text-primary hover:underline"
                    >
                      {selectedProvider.website}
                    </a>
                  {:else}
                    <div class="text-sm text-foreground">-</div>
                  {/if}
                {/if}
              </div>

              <!-- Contacts -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Contacts</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.contacts}
                    placeholder="Contact information (JSON or text)"
                    class="text-sm font-mono"
                    rows="3"
                  />
                {:else}
                  <div class="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-24 overflow-y-auto">
                    {formatJsonField(selectedProvider.contacts) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Fare -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Fare</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.fare}
                    placeholder="Fare information (JSON format)"
                    class="text-sm font-mono"
                    rows="2"
                  />
                {:else}
                  <div class="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-24 overflow-y-auto">
                    {formatJsonField(selectedProvider.fare) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Round Trip Booking -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Round Trip Booking</label>
                {#if editMode}
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      bind:checked={editForm.round_trip_booking}
                      class="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span class="text-sm text-foreground">Requires round trip booking</span>
                  </label>
                {:else}
                  <div class="text-sm text-foreground">
                    {#if selectedProvider.round_trip_booking === true}
                      <span class="text-green-600">Yes</span>
                    {:else if selectedProvider.round_trip_booking === false}
                      <span class="text-muted-foreground">No</span>
                    {:else}
                      <span class="text-muted-foreground">-</span>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Investigated -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">Investigated</label>
                {#if editMode}
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      bind:checked={editForm.investigated}
                      class="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span class="text-sm text-foreground">Provider has been investigated</span>
                  </label>
                {:else}
                  <div class="text-sm text-foreground">
                    {#if selectedProvider.investigated === true}
                      <span class="text-green-600">Yes</span>
                    {:else if selectedProvider.investigated === false}
                      <span class="text-muted-foreground">No</span>
                    {:else}
                      <span class="text-muted-foreground">-</span>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Service Zone -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-xs font-medium text-muted-foreground mb-1">
                  Service Zone (GeoJSON)
                  {#if selectedProvider.has_service_zone}
                    <span class="ml-2 text-green-600 text-xs">✓ Has zone</span>
                  {:else}
                    <span class="ml-2 text-amber-600 text-xs">No zone defined</span>
                  {/if}
                </label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.service_zone}
                    placeholder="Service zone GeoJSON (FeatureCollection format)"
                    class="text-sm font-mono"
                    rows="6"
                  />
                {:else}
                  <div class="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-48 overflow-y-auto">
                    {formatJsonField(selectedProvider.service_zone) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Edit Mode Buttons -->
              {#if editMode}
                <div class="flex gap-2 pt-4 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    class="flex-1"
                    onclick={cancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    class="flex-1"
                    onclick={saveProvider}
                    disabled={saving}
                  >
                    {#if saving}
                      <span class="animate-spin mr-2">...</span>
                      Saving...
                    {:else}
                      Save Changes
                    {/if}
                  </Button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </Resizable.Pane>
    </Resizable.PaneGroup>
  </PageShell>
{/if}

<style>
  :global(.leaflet-container) {
    height: 100% !important;
    width: 100% !important;
  }

  :global(.service-zone-popup) {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 250px;
  }

  :global(.zone-popup-header) {
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }

  :global(.zone-popup-description) {
    font-size: 13px;
    color: #4b5563;
    margin-bottom: 4px;
  }
</style>
