<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import TripRouteMap from '../components/TripRouteMap.svelte';
  import { buildProvidersApiUrl } from '../config';
  import PageShell from '$lib/components/PageShell.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Resizable from '$lib/components/ui/resizable/index.js';

  const DEFAULT_CENTER = [37.99, -121.85];
  const DEFAULT_ZOOM = 11;

  let pairs = [];
  let selectedDate = 'All trips';
  let selectedTripId = null;
  let loadingPairs = false;
  let pairsError = null;
  let mapKey = 'map-default';
  let viewMode = 'routes'; // 'routes' | 'heat'

  onMount(() => {
    loadPairs();
  });

  async function loadPairs() {
    loadingPairs = true;
    pairsError = null;
    pairs = [];
    selectedTripId = null;
    try {
      const res = await fetch(buildProvidersApiUrl(`/trip-records/csv/pairs`));
      if (!res.ok) throw new Error(`Failed to load trips (HTTP ${res.status})`);
      const data = await res.json();
      pairs = await attachGeocodes(data);
      selectedTripId = null;
      mapKey = `all-${Date.now()}`;
    } catch (err) {
      pairsError = err?.message ?? 'Unable to load trip pairs.';
      pairs = [];
    } finally {
      loadingPairs = false;
    }
  }

  function selectDate(label) {
    selectedDate = label;
    selectedTripId = null;
    mapKey = `all-${Date.now()}`;
  }

  function selectTrip(tripId) {
    selectedTripId = tripId;
    mapKey = `trip-${tripId}-${Date.now()}`;
  }

  function formatDateLabel(dateString) {
    return dateString;
  }

  const formatTime = (value) => (value ? value.slice(0, 5) : '—');
  const formatMinutes = (value) =>
    value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(1)} min`;

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

  function mapCenterForTrip(trip) {
    if (trip?.route_polyline) {
      const coords = decodePolyline(trip.route_polyline);
      if (coords.length > 0) return centerFromCoords(coords);
    }
    return DEFAULT_CENTER;
  }

  function mapCenterForSelection(list) {
    const allCoords = list
      .filter((p) => p.route_polyline)
      .flatMap((p) => decodePolyline(p.route_polyline));
    if (allCoords.length === 0) return DEFAULT_CENTER;
    return centerFromCoords(allCoords);
  }

  function centerFromCoords(coords) {
    if (!coords || coords.length === 0) return DEFAULT_CENTER;
    const lats = coords.map((c) => c[0]);
    const lngs = coords.map((c) => c[1]);
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }

  async function attachGeocodes(rawPairs) {
    return rawPairs;
  }

  const toMinutes = (timeStr) => {
    if (!timeStr) return null;
    const [h, m, s] = timeStr.split(':').map(Number);
    if ([h, m].some((n) => Number.isNaN(n))) return null;
    return h * 60 + m + (Number.isNaN(s) ? 0 : s / 60);
  };

  function buildStats(list) {
    const distanceMeters = list.map((t) => Number(t.route_distance_meters)).filter((n) => Number.isFinite(n));
    const durationSeconds = list.map((t) => Number(t.route_duration_seconds)).filter((n) => Number.isFinite(n));
    const returnGaps = list
      .map((t) => Number(t.return_gap_minutes))
      .filter((n) => Number.isFinite(n));
    const pickups = list.map((t) => toMinutes(t.pick_time)).filter((n) => n != null);
    const drops = list.map((t) => toMinutes(t.drop_time)).filter((n) => n != null);
    const passengers = list
      .map((t) => Number(t.passengers_on_board))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0);

    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const safeAvg = (arr) => (arr.length ? sum(arr) / arr.length : null);

    const totalMeters = sum(distanceMeters);
    const totalSeconds = sum(durationSeconds);

    const avgSpeedMph = totalSeconds > 0 ? (totalMeters / 1609.344) / (totalSeconds / 3600) : null;

    const formatClock = (mins) => {
      if (mins == null) return '—';
      const h = Math.floor(mins / 60) % 24;
      const m = Math.round(mins % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const avgDistance = safeAvg(distanceMeters);
    const avgDuration = safeAvg(durationSeconds);

    return {
      tripCount: list.length,
      routedCount: distanceMeters.length,
      distancesKm: distanceMeters.map((m) => m / 1000),
      durationsMin: durationSeconds.map((s) => s / 60),
      avgDistanceKm: avgDistance == null ? null : avgDistance / 1000,
      avgDurationMin: avgDuration == null ? null : avgDuration / 60,
      avgSpeedMph,
      avgReturnGapMin: safeAvg(returnGaps),
      earliestPickup: formatClock(pickups.length ? Math.min(...pickups) : null),
      latestDrop: formatClock(drops.length ? Math.max(...drops) : null),
      passengers,
    };
  }

  const formatNumber = (value, unit, digits = 1) =>
    value == null || Number.isNaN(value) ? '—' : `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`;

  const buildBins = (values, edges) => {
    const counts = new Array(edges.length + 1).fill(0);
    values.forEach((v) => {
      const idx = edges.findIndex((edge) => v <= edge);
      counts[idx === -1 ? edges.length : idx] += 1;
    });
    return counts.map((count, i) => {
      const label = i === 0
        ? `≤${edges[0]}`
        : i === edges.length
          ? `>${edges[edges.length - 1]}`
          : `${edges[i - 1]}–${edges[i]}`;
      return { label, count };
    });
  };

  $: selectedTrip = pairs.find((p) => p.trip_id === selectedTripId);
  $: visibleTrips = selectedTripId ? pairs.filter((p) => p.trip_id === selectedTripId) : pairs;
  $: drivingRoutes = visibleTrips
    .filter((p) => p.route_polyline)
    .map((p) => ({ trip_id: p.trip_id, coordinates: decodePolyline(p.route_polyline) }));
  $: hasMappable = drivingRoutes.length > 0;
  $: stats = buildStats(visibleTrips);
  $: mapCenter = selectedTrip ? mapCenterForTrip(selectedTrip) : mapCenterForSelection(visibleTrips);
  $: focusRoute = drivingRoutes.length ? drivingRoutes[0].coordinates : [];
  $: heatPoints = (() => {
    const pts = [];
    drivingRoutes.forEach((r) => {
      r.coordinates.forEach((c, idx) => {
        if (idx === 0 || idx === r.coordinates.length - 1 || idx % 5 === 0) {
          pts.push(c);
        }
      });
    });
    return pts;
  })();
</script>

<PageShell
  title="Trip Records CSV"
  description="Explore uploaded paired trip records with return gaps, hotspots, and time-of-day insights."
  appMode={true}
>
  <!-- Main horizontal layout: Left (Map + Stats) | Right (Trips full height) -->
  <Resizable.PaneGroup direction="horizontal" class="flex-1 h-full">
    <!-- Left: Nested vertical panels (Map top, Stats bottom) -->
    <Resizable.Pane defaultSize={65} minSize={40} class="relative">
      <Resizable.PaneGroup direction="vertical" class="h-full">
        <!-- Top: Map Panel -->
        <Resizable.Pane defaultSize={60} minSize={40} class="relative">
          <div class="absolute inset-0" in:fade={{ duration: 400 }}>
            <div class="absolute top-4 left-4 z-10 rounded-xl border border-border/70 bg-background/90 px-4 py-3 shadow">
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Map view</div>
              <div class="text-sm font-semibold">
                {#if loadingPairs && pairs.length === 0}
                  Loading map…
                {:else if !hasMappable}
                  No mappable trips for this selection
                {:else}
                  {visibleTrips.length} trips displayed
                {/if}
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant={viewMode === 'routes' ? 'secondary' : 'outline'} on:click={() => { viewMode = 'routes'; mapKey = `routes-${Date.now()}`; }}>Routes</Button>
                <Button size="sm" variant={viewMode === 'heat' ? 'secondary' : 'outline'} on:click={() => { viewMode = 'heat'; mapKey = `heat-${Date.now()}`; }}>Heatmap</Button>
              </div>
            </div>
            {#if loadingPairs && pairs.length === 0}
              <div class="flex h-full items-center justify-center text-sm text-muted-foreground">Loading map…</div>
            {:else if !hasMappable}
              <div class="flex h-full items-center justify-center text-sm text-muted-foreground">No mappable trips for this selection.</div>
            {:else}
              <TripRouteMap
                mapKey={mapKey}
                center={mapCenter}
                zoom={selectedTrip ? 13 : DEFAULT_ZOOM}
                overlayMode={viewMode === 'heat' ? 'heat' : 'driving'}
                overlaySegments={[]}
                drivingRoutes={drivingRoutes}
                transitRoutes={[]}
                routeCoordinates={focusRoute}
                routeMode={viewMode === 'heat' ? 'selected' : 'selected'}
                selectedTripId={selectedTripId}
                heatPoints={heatPoints}
              />
            {/if}
          </div>
        </Resizable.Pane>

        <Resizable.Handle withHandle />

        <!-- Bottom: Stats/Analysis Panel -->
        <Resizable.Pane defaultSize={40} minSize={20} class="flex flex-col overflow-hidden bg-card border-t border-border/40">
          <!-- Stats Header -->
          <div class="flex-shrink-0 border-b border-border/40 px-3 py-2 bg-muted/30">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Daily Analysis</span>
                <p class="text-xs text-muted-foreground">Stats for {formatDateLabel(selectedDate)}</p>
              </div>
              <div class="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground">{stats.tripCount} trips</div>
            </div>
          </div>
          <!-- Stats Content -->
          <div class="flex-1 overflow-y-auto p-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                <p class="text-xs text-muted-foreground mb-1">Avg distance per trip</p>
                <div class="text-base font-semibold">{formatNumber(stats.avgDistanceKm, 'km')}</div>
                <div class="mt-2 space-y-1">
                  {#each buildBins(stats.distancesKm ?? [], [5, 10, 20, 40]) as bin}
                    <div class="flex items-center gap-2 text-xs">
                      <div class="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                        <div class="h-full bg-primary/60" style={`width:${Math.min(100, (bin.count / Math.max(1, stats.tripCount)) * 100)}%`}></div>
                      </div>
                      <span class="text-muted-foreground w-16">{bin.label}</span>
                      <span class="font-medium w-8 text-right">{bin.count}</span>
                    </div>
                  {/each}
                </div>
              </div>
              <div class="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                <p class="text-xs text-muted-foreground mb-1">Avg duration per trip</p>
                <div class="text-base font-semibold">{formatNumber(stats.avgDurationMin, 'min')}</div>
                <div class="mt-2 space-y-1">
                  {#each buildBins(stats.durationsMin ?? [], [10, 20, 40, 60]) as bin}
                    <div class="flex items-center gap-2 text-xs">
                      <div class="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                        <div class="h-full bg-primary/60" style={`width:${Math.min(100, (bin.count / Math.max(1, stats.tripCount)) * 100)}%`}></div>
                      </div>
                      <span class="text-muted-foreground w-16">{bin.label}</span>
                      <span class="font-medium w-8 text-right">{bin.count}</span>
                    </div>
                  {/each}
                </div>
              </div>
              <div class="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                <p class="text-xs text-muted-foreground mb-1">Avg return gap</p>
                <div class="text-base font-semibold">{formatNumber(stats.avgReturnGapMin, 'min')}</div>
              </div>
              <div class="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                <p class="text-xs text-muted-foreground mb-1">Earliest pickup</p>
                <div class="text-base font-semibold">{stats.earliestPickup}</div>
              </div>
              <div class="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                <p class="text-xs text-muted-foreground mb-1">Latest drop</p>
                <div class="text-base font-semibold">{stats.latestDrop}</div>
              </div>
              <div class="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                <p class="text-xs text-muted-foreground mb-1">Passengers moved</p>
                <div class="text-base font-semibold">{stats.passengers}</div>
              </div>
              <div class="col-span-2 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                <p class="text-xs text-muted-foreground mb-1">Avg speed (all routed trips)</p>
                <div class="text-base font-semibold">{formatNumber(stats.avgSpeedMph, 'mph')}</div>
              </div>
            </div>
          </div>
        </Resizable.Pane>
      </Resizable.PaneGroup>
    </Resizable.Pane>

    <Resizable.Handle withHandle />

    <!-- Right: Trips List Panel (full height) -->
    <Resizable.Pane defaultSize={35} minSize={25} class="bg-card border-l border-border/40 flex flex-col overflow-hidden">
      <!-- Trips Header -->
      <div class="flex-shrink-0 border-b border-border/40 px-3 py-2 bg-muted/30">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trip Records</span>
            <p class="text-xs text-muted-foreground">CSV paired trip records</p>
          </div>
          <div class="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground">{visibleTrips.length} showing</div>
        </div>
      </div>
      <!-- Date Filter (placeholder) -->
      <div class="flex-shrink-0 px-3 pt-2 pb-1">
        <button class="w-full flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground" on:click={() => selectDate('All trips')}>
          <span>All trips</span>
          <span class="text-xs text-muted-foreground">{pairs.length} trips</span>
        </button>
      </div>
      <!-- Trips Content -->
      <div class="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {#if pairsError}
          <div class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{pairsError}</div>
        {:else if loadingPairs}
          <div class="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p>Loading trips…</p>
          </div>
        {:else if pairs.length === 0}
          <p class="text-sm text-muted-foreground">No trips loaded.</p>
        {:else}
          {#each pairs as pair (pair.trip_id)}
            <button
              class={`w-full rounded-lg border px-3 py-3 text-left shadow-sm transition hover:border-primary/60 ${pair.trip_id === selectedTripId ? 'border-primary/60 bg-primary/5' : 'border-border/70 bg-card'}`}
              on:click={() => selectTrip(pair.trip_id)}
            >
              <div class="flex items-center justify-between text-sm font-semibold">
                <div>Trip #{pair.trip_id}</div>
                <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{formatMinutes(pair.duration_minutes)}</span>
              </div>
              <div class="mt-1 text-sm text-muted-foreground">{pair.pickup_city ?? '—'} → {pair.drop_city ?? '—'}</div>
              <div class="text-xs text-muted-foreground">{formatTime(pair.pick_time)} → {formatTime(pair.drop_time)}</div>
              <div class="mt-1 text-xs text-muted-foreground">
                {pair.passengers_on_board ?? '—'} pax · {formatMinutes(pair.outbound_duration_minutes ?? pair.route_duration_seconds / 60)} travel
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </Resizable.Pane>
  </Resizable.PaneGroup>
</PageShell>
