<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import TripRouteMap from '../components/TripRouteMap.svelte';
  import { buildProvidersApiUrl } from '../config';
  import PageShell from '$lib/components/PageShell.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Resizable from '$lib/components/ui/resizable/index.js';

  const DEFAULT_CENTER = [37.989, -121.835];
  const DEFAULT_ZOOM = 11;
  const tripsUrl = buildProvidersApiUrl('/tri-delta-transit/trips');
  const directionsUrl = buildProvidersApiUrl('/providers/routes/google-directions');
  const transitDirectionsUrl = buildProvidersApiUrl('/providers/routes/google-directions/transit');
  const drivingRoutesUrl = buildProvidersApiUrl('/tri-delta-transit/routes?mode=driving');
  const transitRoutesUrl = buildProvidersApiUrl('/tri-delta-transit/routes?mode=transit');

  const OVERLAY_SEGMENTS = 'segments';
  const OVERLAY_DRIVING = 'driving';
  const OVERLAY_TRANSIT = 'transit';

  let loading = true;
  let error = null;
  let trips = [];
  let selectedTrip = null;
  let mapCenter = DEFAULT_CENTER;
  let mapZoom = DEFAULT_ZOOM;
  let mapKey = 'default-map';
  let routeCoordinates = [];
  let routeLoading = false;
  let routeError = null;
  let googleRoute = null;
  let routeMode = 'standard';
  let pendingRouteMode = null;
  let showRoutePanel = false;
  let overlayMode = OVERLAY_SEGMENTS;
  let overlayLoading = false;
  let overlayError = null;
  let drivingRoutes = [];
  let transitRoutes = [];

  onMount(loadTrips);

  async function loadTrips() {
    loading = true;
    error = null;

    try {
      const response = await fetch(tripsUrl);
      if (!response.ok) {
        throw new Error(`Failed to load trips (HTTP ${response.status})`);
      }

      const data = await response.json();
      trips = [...data].sort((a, b) => a.trip_id - b.trip_id);

      if (trips.length > 0) {
        const { center, zoom } = computeInitialMapView(trips);
        mapCenter = center;
        mapZoom = zoom;
        mapKey = `all-trips-${Date.now()}`;
        selectTrip(trips[0], { animate: false, focus: false });
      }
    } catch (err) {
      error = err?.message ?? 'Unable to load trip data.';
      trips = [];
      mapCenter = DEFAULT_CENTER;
      mapZoom = DEFAULT_ZOOM;
      mapKey = `default-${Date.now()}`;
    } finally {
      loading = false;
    }
  }

  function selectTrip(trip, { animate = true, focus = true } = {}) {
    if (!trip) return;

    selectedTrip = trip;

    if (focus) {
      const origin = getOriginLatLng(trip);
      const destination = getDestinationLatLng(trip);

      if (origin && destination) {
        mapCenter = [
          (origin[0] + destination[0]) / 2,
          (origin[1] + destination[1]) / 2
        ];
        mapZoom = 12;
      } else if (origin) {
        mapCenter = origin;
        mapZoom = 13;
      } else if (destination) {
        mapCenter = destination;
        mapZoom = 13;
      } else {
        mapCenter = DEFAULT_CENTER;
        mapZoom = DEFAULT_ZOOM;
      }

      mapKey = animate ? `trip-${trip.trip_id}-${Date.now()}` : `trip-${trip.trip_id}`;
    }
  }

  function getOriginLatLng(trip) {
    if (!trip) return null;
    const { origin_latitude, origin_longitude } = trip;
    if (origin_latitude == null || origin_longitude == null) return null;
    return [Number(origin_latitude), Number(origin_longitude)];
  }

  function getDestinationLatLng(trip) {
    if (!trip) return null;
    const { destination_latitude, destination_longitude } = trip;
    if (destination_latitude == null || destination_longitude == null) return null;
    return [Number(destination_latitude), Number(destination_longitude)];
  }

  function formatTripAddress(address, city) {
    if (!address) return city ?? '';
    if (!city) return address;
    return `${address}, ${city}`;
  }

  function formatDuration(hours) {
    if (hours == null || Number.isNaN(Number(hours))) {
      return 'Unknown duration';
    }
    const minutes = Math.max(0, Math.round(Number(hours) * 60));
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  function maskAddress(address) {
    if (!address) return '';
    return String(address).replace(/\d/g, '•');
  }

  $: tripSegments = trips
    .map((trip) => {
      const origin = getOriginLatLng(trip);
      const destination = getDestinationLatLng(trip);
      if (!origin || !destination) {
        return null;
      }
      return {
        id: trip.trip_id,
        origin,
        destination,
      };
    })
    .filter(Boolean);

  $: mappedTripCount = tripSegments.length;
  $: routeLegs = googleRoute?.legs ?? [];

  function decodePolyline(encoded) {
    if (!encoded) return [];
    let index = 0;
    const len = encoded.length;
    const coordinates = [];
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
  }

  function computeBoundsCenter(coords) {
    if (!coords || coords.length === 0) {
      return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    }

    const lats = coords.map(([lat]) => lat);
    const lngs = coords.map(([, lng]) => lng);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lngMin = Math.min(...lngs);
    const lngMax = Math.max(...lngs);

    const center = [
      (latMin + latMax) / 2,
      (lngMin + lngMax) / 2,
    ];

    const latSpan = latMax - latMin;
    const lngSpan = lngMax - lngMin;
    const span = Math.max(latSpan, lngSpan);

    let zoom;
    if (span < 0.01) zoom = 14;
    else if (span < 0.05) zoom = 13;
    else if (span < 0.1) zoom = 12;
    else if (span < 0.2) zoom = 11;
    else if (span < 0.5) zoom = 10;
    else zoom = 9;

    return { center, zoom };
  }

  async function fetchRoute(trip, { endpoint, mode }) {
    if (!trip) return;
    routeLoading = true;
    pendingRouteMode = mode;
    routeError = null;
    showRoutePanel = true;

    const origin = formatTripAddress(trip.origin_address, trip.origin_city);
    const destination = formatTripAddress(trip.destination_address, trip.destination_city);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ origin, destination })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Directions request failed (HTTP ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Google Directions request failed');
      }

      googleRoute = data;
      routeCoordinates = decodePolyline(data.polyline) || [];
      routeMode = mode;

      if (routeCoordinates.length > 0) {
        const { center, zoom } = computeBoundsCenter(routeCoordinates);
        mapCenter = center;
        mapZoom = zoom;
        mapKey = `route-${mode}-${Date.now()}`;
      }
    } catch (err) {
      routeError = err?.message ?? `Unable to fetch ${mode === 'transit' ? 'Google transit route' : 'Google route'}`;
      googleRoute = null;
      routeCoordinates = [];
      routeMode = mode;
    } finally {
      routeLoading = false;
      pendingRouteMode = null;
    }
  }

  function fetchDrivingRoute(trip) {
    return fetchRoute(trip, { endpoint: directionsUrl, mode: 'standard' });
  }

  function fetchTransitRoute(trip) {
    return fetchRoute(trip, { endpoint: transitDirectionsUrl, mode: 'transit' });
  }

  async function loadOverlayRoutes(mode) {
    overlayLoading = true;
    overlayError = null;

    const url = mode === OVERLAY_DRIVING ? drivingRoutesUrl : transitRoutesUrl;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Route overlay request failed (HTTP ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const decoded = (data || [])
        .map((route) => {
          const coordinates = decodePolyline(route.polyline);
          return {
            ...route,
            coordinates
          };
        })
        .filter((route) => Array.isArray(route.coordinates) && route.coordinates.length > 0);

      if (mode === OVERLAY_DRIVING) {
        drivingRoutes = decoded;
      } else {
        transitRoutes = decoded;
      }

      if (decoded.length > 0) {
        const coords = decoded.flatMap((route) => route.coordinates);
        const { center, zoom } = computeBoundsCenter(coords);
        mapCenter = center;
        mapZoom = zoom;
        mapKey = `overlay-${mode}-${Date.now()}`;
      }
    } catch (err) {
      overlayError = err?.message ?? 'Unable to load route overlays';
      if (mode === OVERLAY_DRIVING) {
        drivingRoutes = [];
      } else {
        transitRoutes = [];
      }
    } finally {
      overlayLoading = false;
    }
  }

  async function changeOverlayMode(mode) {
    if (overlayMode === mode) return;

    overlayMode = mode;
    overlayError = null;

    if (mode === OVERLAY_SEGMENTS) {
      mapKey = `segments-${Date.now()}`;
      if (selectedTrip) {
        selectTrip(selectedTrip, { animate: false, focus: true });
      } else if (trips.length > 0) {
        const { center, zoom } = computeInitialMapView(trips);
        mapCenter = center;
        mapZoom = zoom;
      }
      return;
    }

    const hasData = mode === OVERLAY_DRIVING ? drivingRoutes.length > 0 : transitRoutes.length > 0;
    if (!hasData) {
      await loadOverlayRoutes(mode);
    } else {
      mapKey = `overlay-${mode}-${Date.now()}`;
    }
  }

  function closeRoutePanel() {
    showRoutePanel = false;
  }

  function computeInitialMapView(tripList) {
    const coordinates = tripList
      .flatMap((trip) => [getOriginLatLng(trip), getDestinationLatLng(trip)])
      .filter((point) => Array.isArray(point));

    if (coordinates.length === 0) {
      return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    }

    const lats = coordinates.map(([lat]) => Number(lat));
    const lngs = coordinates.map(([, lng]) => Number(lng));

    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lngMin = Math.min(...lngs);
    const lngMax = Math.max(...lngs);

    const center = [
      (latMin + latMax) / 2,
      (lngMin + lngMax) / 2,
    ];

    const latSpan = latMax - latMin;
    const lngSpan = lngMax - lngMin;
    const maxSpan = Math.max(latSpan, lngSpan);

    let zoom;
    if (maxSpan < 0.05) zoom = 13;
    else if (maxSpan < 0.1) zoom = 12;
    else if (maxSpan < 0.2) zoom = 11;
    else if (maxSpan < 0.5) zoom = 10;
    else zoom = 9;

    return { center, zoom };
  }
</script>

<PageShell
  title="Trip History"
  description="Visualize historic Tri Delta Transit trips with overlays, Google routing, and consistent UI."
  appMode={true}
>
  <!-- Main horizontal layout: Left (Map + Route details) | Right (Trips full height) -->
  <Resizable.PaneGroup direction="horizontal" class="flex-1 h-full">
    <!-- Left: Nested vertical panels (Map top, Route details bottom) -->
    <Resizable.Pane defaultSize={65} minSize={40} class="relative">
      <Resizable.PaneGroup direction="vertical" class="h-full">
        <!-- Top: Map Panel -->
        <Resizable.Pane defaultSize={showRoutePanel ? 60 : 100} minSize={40} class="relative">
          <div class="absolute inset-0" in:fade={{ duration: 400 }}>
            {#if trips.length > 0}
              <div class="absolute top-4 left-4 z-10 rounded-xl border border-border/70 bg-background/90 px-4 py-3 shadow">
                <div class="text-xs uppercase tracking-wide text-muted-foreground">Map view</div>
                <div class="text-sm font-semibold">{overlayMode === OVERLAY_SEGMENTS ? `${mappedTripCount} of ${trips.length} trips displayed` : overlayLoading ? `Loading ${overlayMode === OVERLAY_DRIVING ? 'driving' : 'transit'} routes…` : `${(overlayMode === OVERLAY_DRIVING ? drivingRoutes.length : transitRoutes.length) || 0} ${overlayMode === OVERLAY_DRIVING ? 'driving' : 'transit'} routes displayed`}</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant={overlayMode === OVERLAY_SEGMENTS ? 'secondary' : 'outline'} on:click={() => changeOverlayMode(OVERLAY_SEGMENTS)} disabled={overlayLoading}>Trip Segments</Button>
                  <Button size="sm" variant={overlayMode === OVERLAY_DRIVING ? 'secondary' : 'outline'} on:click={() => changeOverlayMode(OVERLAY_DRIVING)} disabled={overlayLoading}>Driving Routes</Button>
                  <Button size="sm" variant={overlayMode === OVERLAY_TRANSIT ? 'secondary' : 'outline'} on:click={() => changeOverlayMode(OVERLAY_TRANSIT)} disabled={overlayLoading}>Transit Routes</Button>
                </div>
                {#if overlayError}
                  <div class="mt-2 text-xs text-destructive">{overlayError}</div>
                {/if}
              </div>
            {/if}
            {#if loading && trips.length === 0}
              <div class="flex h-full items-center justify-center text-sm text-muted-foreground">Loading map…</div>
            {:else}
              <TripRouteMap
                mapKey={mapKey}
                center={mapCenter}
                zoom={mapZoom}
                overlayMode={overlayMode}
                overlaySegments={tripSegments}
                drivingRoutes={drivingRoutes}
                transitRoutes={transitRoutes}
                routeCoordinates={routeCoordinates}
                routeMode={routeMode}
                selectedTripId={selectedTrip?.trip_id}
              />
            {/if}
          </div>
        </Resizable.Pane>

        {#if showRoutePanel}
          <Resizable.Handle withHandle />

          <!-- Bottom: Route Details Panel -->
          <Resizable.Pane defaultSize={40} minSize={20} class="flex flex-col overflow-hidden bg-card border-t border-border/40">
            <!-- Route Header -->
            <div class="flex-shrink-0 border-b border-border/40 px-3 py-2 bg-muted/30">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {routeMode === 'transit' ? 'Google Transit Route' : 'Google Route'}
                  </span>
                  {#if googleRoute?.summary}
                    <p class="text-xs text-muted-foreground">{googleRoute.summary}</p>
                  {/if}
                </div>
                <Button size="icon" variant="ghost" on:click={closeRoutePanel} aria-label="Close route panel" class="h-7 w-7">×</Button>
              </div>
            </div>
            <!-- Route Content -->
            <div class="flex-1 overflow-y-auto p-3">
              {#if routeLoading}
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <p>Fetching {routeMode === 'transit' ? 'Google transit route' : 'Google route'}…</p>
                </div>
              {:else if routeError}
                <div class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p>{routeError}</p>
                  {#if selectedTrip}
                    <div class="mt-2">
                      <Button
                        size="sm"
                        on:click={() => {
                          if (routeMode === 'transit') {
                            fetchTransitRoute(selectedTrip);
                          } else {
                            fetchDrivingRoute(selectedTrip);
                          }
                        }}
                        disabled={routeLoading}
                      >
                        Try again
                      </Button>
                    </div>
                  {/if}
                </div>
              {:else if googleRoute}
                <div class="space-y-3">
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    {#if googleRoute.distance_text}
                      <div>
                        <div class="text-muted-foreground">Distance</div>
                        <div class="font-semibold">{googleRoute.distance_text}</div>
                      </div>
                    {/if}
                    {#if googleRoute.duration_text}
                      <div>
                        <div class="text-muted-foreground">Duration</div>
                        <div class="font-semibold">{googleRoute.duration_text}</div>
                      </div>
                    {/if}
                  </div>

                  {#if googleRoute.warnings && googleRoute.warnings.length > 0}
                    <div class="rounded-md border border-border/70 bg-muted/50 p-3">
                      <div class="text-sm font-semibold mb-1">Warnings</div>
                      <ul class="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        {#each googleRoute.warnings as warning}
                          <li>{warning}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}

                  {#each routeLegs as leg, index}
                    <div class="rounded-md border border-border/70 bg-card p-3 shadow-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <div class="text-sm font-semibold">Leg {index + 1}</div>
                          {#if leg.start_address && leg.end_address}
                            <p class="text-sm text-muted-foreground">{maskAddress(leg.start_address)} → {maskAddress(leg.end_address)}</p>
                          {/if}
                        </div>
                        <div class="text-xs text-muted-foreground space-y-1">
                          {#if leg.distance_text}<div>{leg.distance_text}</div>{/if}
                          {#if leg.duration_text}<div>{leg.duration_text}</div>{/if}
                        </div>
                      </div>

                      {#if leg.steps && leg.steps.length > 0}
                        <div class="mt-3 space-y-2">
                          {#each leg.steps as step}
                            <div class="rounded border border-border/70 bg-muted/30 px-2 py-2 text-sm">
                              {#if step.instruction}
                                <div class="font-medium">{@html step.instruction}</div>
                              {/if}
                              <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {#if step.travel_mode}<span class="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{step.travel_mode}</span>{/if}
                                {#if step.distance_text}<span>{step.distance_text}</span>{/if}
                                {#if step.duration_text}<span>{step.duration_text}</span>{/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-sm text-muted-foreground">Select a trip and fetch a Google route.</div>
              {/if}
            </div>
          </Resizable.Pane>
        {/if}
      </Resizable.PaneGroup>
    </Resizable.Pane>

    <Resizable.Handle withHandle />

    <!-- Right: Trips List Panel (full height) -->
    <Resizable.Pane defaultSize={35} minSize={25} class="bg-card border-l border-border/40 flex flex-col overflow-hidden">
      <!-- Trips Header -->
      <div class="flex-shrink-0 border-b border-border/40 px-3 py-2 bg-muted/30">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tri Delta Transit Trips</span>
            <p class="text-xs text-muted-foreground">Historical rides from Aurora</p>
          </div>
          <Button size="icon" variant="ghost" on:click={loadTrips} disabled={loading} aria-label="Reload trips" class="h-7 w-7">
            {#if loading}
              <div class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            {:else}
              ↻
            {/if}
          </Button>
        </div>
      </div>
      <!-- Trips Content -->
      <div class="flex-1 overflow-y-auto p-3">
        {#if loading && trips.length === 0}
          <div class="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p>Loading trip history…</p>
          </div>
        {:else if error}
          <div class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
            <div class="mt-2">
              <Button size="sm" on:click={loadTrips}>Try again</Button>
            </div>
          </div>
        {:else if trips.length === 0}
          <div class="text-sm text-muted-foreground">No trip records are available yet.</div>
        {:else}
          <p class="text-sm text-muted-foreground mb-2">Showing {trips.length} trips</p>
          <div class="space-y-2">
            {#each trips as trip (trip.trip_id)}
              <button
                class={`w-full rounded-lg border px-3 py-3 text-left shadow-sm transition hover:border-primary/60 ${selectedTrip?.trip_id === trip.trip_id ? 'border-primary/60 bg-primary/5' : 'border-border/70 bg-card'}`}
                on:click={() => selectTrip(trip)}
              >
                <div class="flex items-center justify-between text-sm font-semibold">
                  <span>Trip #{trip.trip_id}</span>
                  <span class="text-xs text-muted-foreground">{formatDuration(trip.duration_hours)}</span>
                </div>
                <div class="mt-2 space-y-1 text-sm">
                  <div class="text-muted-foreground">Origin</div>
                  <div class="font-medium">{maskAddress(trip.origin_address)}, {trip.origin_city}</div>
                  <div class="text-muted-foreground">Destination</div>
                  <div class="font-medium">{maskAddress(trip.destination_address)}, {trip.destination_city}</div>
                </div>
                <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {#if trip.origin_latitude != null && trip.origin_longitude != null}
                    <span>({Number(trip.origin_latitude).toFixed(4)}, {Number(trip.origin_longitude).toFixed(4)})</span>
                  {/if}
                  {#if trip.destination_latitude != null && trip.destination_longitude != null}
                    <span>→ ({Number(trip.destination_latitude).toFixed(4)}, {Number(trip.destination_longitude).toFixed(4)})</span>
                  {/if}
                </div>
                <div class="mt-3 flex flex-wrap gap-2 text-sm">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={routeLoading}
                    on:click={(event) => {
                      event.stopPropagation();
                      if (routeLoading) return;
                      selectTrip(trip);
                      fetchDrivingRoute(trip);
                    }}
                  >
                    {routeLoading && pendingRouteMode === 'standard' && selectedTrip?.trip_id === trip.trip_id ? 'Fetching…' : 'Driving route'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={routeLoading}
                    on:click={(event) => {
                      event.stopPropagation();
                      if (routeLoading) return;
                      selectTrip(trip);
                      fetchTransitRoute(trip);
                    }}
                  >
                    {routeLoading && pendingRouteMode === 'transit' && selectedTrip?.trip_id === trip.trip_id ? 'Fetching…' : 'Transit route'}
                  </Button>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </Resizable.Pane>
  </Resizable.PaneGroup>
</PageShell>
