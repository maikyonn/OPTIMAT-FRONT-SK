<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fly, fade } from 'svelte/transition';
  import TripRouteMap from '../components/TripRouteMap.svelte';
  import { buildProvidersApiUrl } from '../config';

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

  function goHome() {
    push('/');
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

<button
  class="back-button"
  on:click={goHome}
  in:fly={{ x: -40, duration: 300 }}
  aria-label="Go back to home page"
>
  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
  </svg>
</button>

<div class="map-container" in:fade={{ duration: 400 }}>
  {#if trips.length > 0}
    <div class="map-overlay">
      <div>
        <div class="overlay-title">Map view</div>
        <div class="overlay-value">
          {#if overlayMode === OVERLAY_SEGMENTS}
            {mappedTripCount} of {trips.length} trips displayed
          {:else if overlayLoading}
            Loading {overlayMode === OVERLAY_DRIVING ? 'driving' : 'transit'} routes…
          {:else}
            {(overlayMode === OVERLAY_DRIVING ? drivingRoutes.length : transitRoutes.length) || 0}
            {overlayMode === OVERLAY_DRIVING ? 'driving' : 'transit'} routes displayed
          {/if}
        </div>
      </div>
      <div class="overlay-controls">
        <button
          type="button"
          class="overlay-button {overlayMode === OVERLAY_SEGMENTS ? 'active' : ''}"
          on:click={() => changeOverlayMode(OVERLAY_SEGMENTS)}
          disabled={overlayLoading}
          aria-pressed={overlayMode === OVERLAY_SEGMENTS}
        >
          Trip Segments
        </button>
        <button
          type="button"
          class="overlay-button {overlayMode === OVERLAY_DRIVING ? 'active' : ''}"
          on:click={() => changeOverlayMode(OVERLAY_DRIVING)}
          disabled={overlayLoading}
          aria-pressed={overlayMode === OVERLAY_DRIVING}
        >
          Driving Routes
        </button>
        <button
          type="button"
          class="overlay-button {overlayMode === OVERLAY_TRANSIT ? 'active' : ''}"
          on:click={() => changeOverlayMode(OVERLAY_TRANSIT)}
          disabled={overlayLoading}
          aria-pressed={overlayMode === OVERLAY_TRANSIT}
        >
          Transit Routes
        </button>
      </div>
      {#if overlayError}
        <div class="overlay-error">
          {overlayError}
        </div>
      {/if}
    </div>
  {/if}
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
</div>

<aside
  class="trips-panel"
  in:fly={{ x: 40, duration: 400, delay: 100 }}
>
  <div class="panel-inner">
    <header class="panel-header">
      <div>
        <h2>Tri Delta Transit Trips</h2>
        <p class="panel-subtitle">Historical rides sourced from Aurora</p>
      </div>
      <button class="refresh-button" on:click={loadTrips} disabled={loading}>
        {#if loading}
          <span class="spinner" aria-hidden="true"></span>
        {:else}
          ↻
        {/if}
      </button>
    </header>

    <div class="panel-content">
      {#if loading && trips.length === 0}
        <div class="state">
          <span class="spinner" aria-hidden="true"></span>
          <p>Loading trip history…</p>
        </div>
      {:else if error}
        <div class="state error">
          <p>{error}</p>
          <button class="retry-button" on:click={loadTrips}>Try again</button>
        </div>
      {:else if trips.length === 0}
        <div class="state">
          <p>No trip records are available yet.</p>
        </div>
      {:else}
        <p class="trip-count">Showing {trips.length} trips</p>
        <div class="trip-list">
          {#each trips as trip (trip.trip_id)}
            <button
              class="trip-card {selectedTrip?.trip_id === trip.trip_id ? 'selected' : ''}"
              on:click={() => selectTrip(trip)}
            >
              <div class="trip-id">Trip #{trip.trip_id}</div>
              <div class="trip-route">
                <div class="trip-label">Origin</div>
                <div class="trip-address">{maskAddress(trip.origin_address)}, {trip.origin_city}</div>
              </div>
              <div class="trip-route">
                <div class="trip-label">Destination</div>
                <div class="trip-address">{maskAddress(trip.destination_address)}, {trip.destination_city}</div>
              </div>
              <div class="trip-meta">
                <span>{formatDuration(trip.duration_hours)}</span>
                {#if trip.origin_latitude != null && trip.origin_longitude != null}
                  <span>({Number(trip.origin_latitude).toFixed(4)}, {Number(trip.origin_longitude).toFixed(4)})</span>
                {/if}
                {#if trip.destination_latitude != null && trip.destination_longitude != null}
                  <span>→ ({Number(trip.destination_latitude).toFixed(4)}, {Number(trip.destination_longitude).toFixed(4)})</span>
                {/if}
              </div>
              <div class="trip-actions">
                <span
                  role="button"
                  tabindex="0"
                  class="route-button {routeLoading ? 'disabled' : ''}"
                  aria-disabled={routeLoading ? 'true' : 'false'}
                  on:click|stopPropagation={() => {
                    if (routeLoading) return;
                    selectTrip(trip);
                    fetchDrivingRoute(trip);
                  }}
                  on:keydown|stopPropagation={(event) => {
                    if (routeLoading) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectTrip(trip);
                      fetchDrivingRoute(trip);
                    }
                  }}
                >
                  {#if routeLoading && pendingRouteMode === 'standard' && selectedTrip?.trip_id === trip.trip_id}
                    <span class="spinner" aria-hidden="true"></span>
                    <span class="route-button-label">Fetching…</span>
                  {:else}
                    <span class="route-button-label">Fetch Driving Route</span>
                  {/if}
                </span>
                <span
                  role="button"
                  tabindex="0"
                  class="route-button transit {routeLoading ? 'disabled' : ''}"
                  aria-disabled={routeLoading ? 'true' : 'false'}
                  on:click|stopPropagation={() => {
                    if (routeLoading) return;
                    selectTrip(trip);
                    fetchTransitRoute(trip);
                  }}
                  on:keydown|stopPropagation={(event) => {
                    if (routeLoading) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectTrip(trip);
                      fetchTransitRoute(trip);
                    }
                  }}
                >
                  {#if routeLoading && pendingRouteMode === 'transit' && selectedTrip?.trip_id === trip.trip_id}
                    <span class="spinner" aria-hidden="true"></span>
                    <span class="route-button-label">Fetching…</span>
                  {:else}
                    <span class="route-button-label">Fetch Transit Route</span>
                  {/if}
                </span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</aside>

{#if showRoutePanel}
  <aside
    class="route-panel"
    in:fly={{ y: 40, duration: 300, delay: 80 }}
    out:fade={{ duration: 200 }}
  >
    <div class="route-inner">
      <header class="route-header">
        <div>
          <h3>{routeMode === 'transit' ? 'Google Transit Route' : 'Google Route'}</h3>
          {#if googleRoute?.summary}
            <p class="route-summary">{googleRoute.summary}</p>
          {/if}
        </div>
        <button class="route-close" on:click={closeRoutePanel} aria-label="Close Google route panel">×</button>
      </header>

      <div class="route-content">
        {#if routeLoading}
          <div class="state">
            <span class="spinner" aria-hidden="true"></span>
            <p>Fetching {routeMode === 'transit' ? 'Google transit route' : 'Google route'}…</p>
          </div>
        {:else if routeError}
          <div class="state error">
            <p>{routeError}</p>
            {#if selectedTrip}
              <button
                class="retry-button"
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
              </button>
            {/if}
          </div>
        {:else if googleRoute}
          <div class="route-metrics">
            {#if googleRoute.distance_text}
              <div class="metric">
                <span class="metric-label">Distance</span>
                <span class="metric-value">{googleRoute.distance_text}</span>
              </div>
            {/if}
            {#if googleRoute.duration_text}
              <div class="metric">
                <span class="metric-label">Duration</span>
                <span class="metric-value">{googleRoute.duration_text}</span>
              </div>
            {/if}
          </div>

          {#if googleRoute.warnings && googleRoute.warnings.length > 0}
            <div class="route-warnings">
              <h4>Warnings</h4>
              <ul>
                {#each googleRoute.warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="route-legs">
            {#each routeLegs as leg, index}
              <div class="route-leg">
                <div class="route-leg-header">
                  <div>
                    <span class="route-leg-title">Leg {index + 1}</span>
                    {#if leg.start_address && leg.end_address}
                      <p class="route-leg-addresses">{maskAddress(leg.start_address)} → {maskAddress(leg.end_address)}</p>
                    {/if}
                  </div>
                  <div class="route-leg-metrics">
                    {#if leg.distance_text}<span>{leg.distance_text}</span>{/if}
                    {#if leg.duration_text}<span>{leg.duration_text}</span>{/if}
                  </div>
                </div>

                {#if leg.steps && leg.steps.length > 0}
                  <div class="route-leg-body">
                    {#each leg.steps as step}
                      <div class="route-step">
                        {#if step.instruction}
                          <div class="route-step-instruction">{@html step.instruction}</div>
                        {/if}
                        <div class="route-step-meta">
                          {#if step.travel_mode}<span class="route-step-mode">{step.travel_mode}</span>{/if}
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
          <div class="state">
            <p>Select a trip and fetch a Google route.</p>
          </div>
        {/if}
      </div>
    </div>
  </aside>
{/if}

<style>
  :global(body) {
    overflow: hidden;
  }

  :global(.leaflet-container) {
    height: 100vh !important;
    width: 100vw !important;
  }

  .map-container {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .map-overlay {
    position: absolute;
    top: 1.25rem;
    left: 1.25rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(6px);
    box-shadow: 0 12px 32px -18px rgba(15, 23, 42, 0.45);
    color: #111827;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 1000;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .overlay-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
  }

  .overlay-value {
    margin-top: 0.2rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1f2937;
  }

  .overlay-controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    pointer-events: auto;
  }

  .overlay-button {
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid #d1d5db;
    background: rgba(255, 255, 255, 0.9);
    color: #1f2937;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  }

  .overlay-button:hover:not(:disabled) {
    transform: translateY(-1px);
    background: rgba(37, 99, 235, 0.12);
  }

  .overlay-button.active {
    background: #2563eb;
    border-color: #1d4ed8;
    color: #fff;
    box-shadow: 0 12px 20px -12px rgba(37, 99, 235, 0.7);
  }

  .overlay-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .overlay-error {
    margin-top: 0.1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #b91c1c;
    pointer-events: auto;
  }

  .back-button {
    position: fixed;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 50;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(6px);
    color: #1f2937;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    padding: 0.75rem;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }

  .back-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 35px rgba(15, 23, 42, 0.16);
  }

  .back-button:focus {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .trips-panel {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    width: 24rem;
    height: calc(100vh - 3rem);
    max-height: calc(100vh - 3rem);
    z-index: 40;
    display: flex;
    flex-direction: column;
  }

  .panel-inner {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 1.5rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 25px 45px -12px rgba(15, 23, 42, 0.25);
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    min-height: 0;
  }

  .route-panel {
    position: fixed;
    top: 1.5rem;
    right: calc(1.5rem + 24rem + 1.25rem);
    width: 22rem;
    max-height: calc(100vh - 3rem);
    z-index: 35;
    display: flex;
  }

  .route-inner {
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(10px);
    border-radius: 1.25rem;
    border: 1px solid rgba(148, 163, 184, 0.35);
    color: #f8fafc;
    box-shadow: 0 25px 45px -18px rgba(15, 23, 42, 0.55);
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 100%;
    min-height: 0;
  }

  .route-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem 1.25rem 0.75rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.35);
    gap: 1rem;
  }

  .route-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .route-summary {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: #cbd5f5;
  }

  .route-close {
    background: transparent;
    border: 1px solid rgba(148, 163, 184, 0.45);
    border-radius: 9999px;
    width: 2.2rem;
    height: 2.2rem;
    font-size: 1.4rem;
    line-height: 1;
    color: #e2e8f0;
    cursor: pointer;
  }

  .route-close:hover {
    background: rgba(148, 163, 184, 0.15);
  }

  .route-content {
    padding: 1rem 1.25rem 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .route-metrics {
    display: flex;
    gap: 1rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: rgba(148, 163, 184, 0.12);
    padding: 0.75rem;
    border-radius: 0.75rem;
  }

  .metric-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #cbd5f5;
  }

  .metric-value {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .route-warnings {
    background: rgba(252, 165, 165, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.35);
    border-radius: 0.75rem;
    padding: 0.75rem;
  }

  .route-warnings h4 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #fecaca;
  }

  .route-warnings ul {
    margin: 0.5rem 0 0;
    padding-left: 1rem;
    color: #fee2e2;
    font-size: 0.85rem;
  }

  .route-legs {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .route-leg {
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 0.75rem;
    padding: 0.85rem;
    background: rgba(15, 23, 42, 0.55);
  }

  .route-leg-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .route-leg-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: #f8fafc;
  }

  .route-leg-addresses {
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
    color: #cbd5f5;
  }

  .route-leg-metrics {
    display: flex;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #e2e8f0;
  }

  .route-leg-body {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .route-step {
    background: rgba(30, 41, 59, 0.75);
    border-radius: 0.65rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .route-step-instruction {
    color: #e2e8f0;
    font-size: 0.85rem;
  }

  .route-step-meta {
    margin-top: 0.35rem;
    display: flex;
    gap: 0.65rem;
    font-size: 0.75rem;
    color: #cbd5f5;
  }

  .route-step-mode {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .route-content .state {
    color: #cbd5f5;
  }

  .trip-count {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
    color: #4b5563;
    font-weight: 600;
  }

  .trip-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-right: 0.5rem;
    overflow-y: auto;
  }

  .trip-card {
    text-align: left;
    width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 1rem;
    padding: 0.85rem 1rem;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 10px 25px -15px rgba(15, 23, 42, 0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    cursor: pointer;
  }

  .trip-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 30px -10px rgba(37, 99, 235, 0.18);
    border-color: rgba(37, 99, 235, 0.45);
  }

  .trip-card.selected {
    border-color: rgba(37, 99, 235, 0.55);
    box-shadow: 0 18px 32px -14px rgba(37, 99, 235, 0.35);
    background: rgba(219, 234, 254, 0.65);
  }

  .trip-id {
    font-weight: 700;
    color: #1d4ed8;
    margin-bottom: 0.5rem;
  }

  .trip-route {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.85rem;
    color: #374151;
  }

  .trip-label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
    font-size: 0.7rem;
  }

  .trip-address {
    font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    padding: 0.15rem 0.35rem;
    border-radius: 0.35rem;
    background: rgba(209, 213, 219, 0.25);
  }

  .trip-meta {
    margin-top: 0.55rem;
    display: flex;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: #4b5563;
    flex-wrap: wrap;
  }

  .trip-actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .route-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    border-radius: 9999px;
    border: 1px solid #22c55e;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  }

  .route-button.transit {
    border: 1px solid #6366f1;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    box-shadow: 0 15px 25px -12px rgba(99, 102, 241, 0.45);
  }

  .route-button:hover:not(.disabled) {
    transform: translateY(-1px);
    box-shadow: 0 15px 25px -12px rgba(34, 197, 94, 0.45);
  }

  .route-button.transit:hover:not(.disabled) {
    box-shadow: 0 15px 25px -10px rgba(99, 102, 241, 0.55);
  }

  .route-button.disabled {
    cursor: not-allowed;
    opacity: 0.7;
    box-shadow: none;
  }

  .route-button:focus-visible {
    outline: 2px solid #22d3ee;
    outline-offset: 3px;
  }

  .route-button-label {
    line-height: 1;
  }

  .state {
    text-align: center;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #4b5563;
  }

  .state.error {
    color: #b91c1c;
  }

  .retry-button {
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    border: 1px solid #ef4444;
    background: #fee2e2;
    color: #b91c1c;
    cursor: pointer;
  }

  .retry-button:hover {
    background: #fecaca;
  }

  .spinner {
    width: 1.1rem;
    height: 1.1rem;
    border: 3px solid rgba(255, 255, 255, 0.6);
    border-top-color: rgba(37, 99, 235, 0.9);
    border-radius: 9999px;
    animation: spin 0.75s linear infinite;
  }

  .route-button .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.6);
    border-top-color: rgba(15, 23, 42, 0.8);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
