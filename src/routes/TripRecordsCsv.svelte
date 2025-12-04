<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import TripRouteMap from '../components/TripRouteMap.svelte';
  import { buildProvidersApiUrl } from '../config';

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
    // Rely solely on backend data (route_polyline); no geocoding fallback
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
<div class="screen" in:fade={{ duration: 120 }}>
  <div class="map-bg">
    {#if loadingPairs && pairs.length === 0}
      <div class="state overlay">Loading map…</div>
    {:else if !hasMappable}
      <div class="state overlay">No mappable trips for this selection.</div>
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

  <aside class="panel-stack">
    <div class="card inner-sidebar">
      <div class="stack-head">
        <div>
          <p class="eyebrow">Trip Records</p>
          <div class="section-title">Trips</div>
          <p class="muted small">Select a date, then a trip. Only “All trips” available (backend sends no dates).</p>
        </div>
        <div class="view-toggle">
          <button class:view-active={viewMode === 'routes'} on:click={() => { viewMode = 'routes'; mapKey = `routes-${Date.now()}`; }}>
            Routes
          </button>
          <button class:view-active={viewMode === 'heat'} on:click={() => { viewMode = 'heat'; mapKey = `heat-${Date.now()}`; }}>
            Heatmap
          </button>
        </div>
      </div>

      <div class="chip">{visibleTrips.length} showing</div>

      <div class="date-row">
        <button class:selected={true} on:click={() => selectDate('All trips')}>
          <span class="date-label">All trips</span>
          <span class="date-meta">{pairs.length} trips</span>
        </button>
      </div>

      {#if pairsError}
        <div class="error">{pairsError}</div>
      {:else if loadingPairs}
        <p class="muted">Loading trips…</p>
      {:else if pairs.length === 0}
        <p class="muted">No trips loaded.</p>
      {:else}
        <ul>
          {#each pairs as pair (pair.trip_id)}
            <li>
              <button
                class:selected={pair.trip_id === selectedTripId}
                on:click={() => selectTrip(pair.trip_id)}
              >
                <div class="trip-top">
                  <div class="trip-id">Trip #{pair.trip_id}</div>
                  <span class="pill">{formatMinutes(pair.duration_minutes)}</span>
                </div>
                <div class="route-line">{pair.pickup_city ?? '—'} → {pair.drop_city ?? '—'}</div>
                <div class="time-line">{formatTime(pair.pick_time)} → {formatTime(pair.drop_time)}</div>
                <div class="count-line">
                  {pair.passengers_on_board ?? '—'} pax ·
                  {formatMinutes(pair.outbound_duration_minutes ?? pair.route_duration_seconds / 60)} travel
                </div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </aside>

  <section class="analysis card">
    <div class="analysis-header">
      <div>
        <p class="eyebrow">Daily Analysis</p>
        <h2>Stats for {formatDateLabel(selectedDate)}</h2>
      </div>
      <div class="chip muted">{stats.tripCount} trips analysed</div>
    </div>
    <div class="analysis-grid">
      <article>
        <p class="label">Avg distance per trip</p>
        <div class="value">{formatNumber(stats.avgDistanceKm, 'km')}</div>
        <div class="spark">
          {#each buildBins(stats.distancesKm ?? [], [5, 10, 20, 40]) as bin}
            <div class="bar" style={`width:${Math.min(100, (bin.count / Math.max(1, stats.tripCount)) * 100)}%`}>
              <span class="bar-label">{bin.label}</span>
              <span class="bar-count">{bin.count}</span>
            </div>
          {/each}
        </div>
      </article>
      <article>
        <p class="label">Avg travel time per trip</p>
        <div class="value">{formatNumber(stats.avgDurationMin, 'min')}</div>
        <div class="spark">
          {#each buildBins(stats.durationsMin ?? [], [10, 20, 40, 80]) as bin}
            <div class="bar" style={`width:${Math.min(100, (bin.count / Math.max(1, stats.tripCount)) * 100)}%`}>
              <span class="bar-label">{bin.label}</span>
              <span class="bar-count">{bin.count}</span>
            </div>
          {/each}
        </div>
      </article>
      <article>
        <p class="label">Avg speed (routed)</p>
        <div class="value">{formatNumber(stats.avgSpeedMph, 'mph')}</div>
        <p class="hint">{stats.routedCount} trips with routes</p>
      </article>
      <article>
        <p class="label">Return gap</p>
        <div class="value">{formatNumber(stats.avgReturnGapMin, 'min')}</div>
        <p class="hint">Earliest {stats.earliestPickup} · Latest {stats.latestDrop}</p>
      </article>
      <article>
        <p class="label">Passengers</p>
        <div class="value">{stats.passengers ?? '—'}</div>
        <p class="hint">Total onboard across trips</p>
      </article>
    </div>
  </section>
</div>

<style>
  .screen {
    position: relative;
    min-height: 100vh;
    background: #0f172a;
    overflow: hidden;
  }

  .screen :global(body) {
    margin: 0;
  }

  .map-bg {
    position: fixed;
    inset: 0;
    z-index: 1;
  }

  .map-bg :global(.map-container),
  .map-bg :global(.leaflet-container),
  .map-bg :global(canvas),
  .map-bg :global(svg) {
    width: 100% !important;
    height: 100% !important;
  }

  .overlay {
    z-index: 3;
  }

  .panel-stack {
    position: fixed;
    top: 0;
    right: 0;
    width: clamp(320px, 28vw, 420px);
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    max-height: 100vh;
    overflow: hidden;
  }

  .panel-stack .card {
    max-height: 70vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .panel-stack ul {
    overflow: auto;
  }

  .analysis {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    backdrop-filter: blur(6px);
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    margin: 0;
    color: #2563eb;
  }

  .map-header h1 {
    margin: 0.2rem 0 0.1rem;
    font-size: 1.6rem;
  }

  .map-header .lede {
    margin: 0;
    color: #475569;
  }

  .chip {
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    background: #eef2ff;
    color: #1e293b;
    font-weight: 600;
    border: 1px solid #cbd5e1;
  }

  .state {
    padding: 1rem;
    color: #475569;
    background: #eef2ff;
    border-radius: 12px;
    border: 1px dashed #cbd5e1;
  }

  .card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 0.85rem;
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
  }

  .outer-sidebar,
  .inner-sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .stack-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .view-toggle {
    display: inline-flex;
    gap: 0.4rem;
    background: #e2e8f0;
    padding: 0.25rem;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
  }

  .view-toggle button {
    border: none;
    background: transparent;
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 700;
    color: #334155;
  }

  .view-toggle button.view-active {
    background: #0ea5e9;
    color: white;
    box-shadow: 0 6px 18px rgba(14, 165, 233, 0.35);
  }

  .date-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.4rem;
  }

  .muted.small {
    font-size: 0.85rem;
    margin: 0.1rem 0 0;
  }

  .section-title {
    font-weight: 700;
    color: #0f172a;
  }

  .outer-sidebar ul,
  .inner-sidebar ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .outer-sidebar button,
  .inner-sidebar button {
    width: 100%;
    text-align: left;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 12px;
    padding: 0.65rem 0.7rem;
    cursor: pointer;
    transition: border 120ms ease, transform 120ms ease, box-shadow 120ms ease;
  }

  .outer-sidebar button:hover,
  .inner-sidebar button:hover {
    border-color: #94a3b8;
    transform: translateY(-1px);
  }

  .outer-sidebar button.selected,
  .inner-sidebar button.selected {
    border-color: #2563eb;
    background: #eef2ff;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
  }

  .date-label {
    display: block;
    font-weight: 700;
    color: #0f172a;
  }

  .date-meta {
    color: #475569;
    font-size: 0.9rem;
  }

  .trip-top {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
  }

  .trip-id {
    font-weight: 700;
    color: #0f172a;
  }

  .pill {
    background: #e2f3ff;
    color: #0b6cbf;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.85rem;
    border: 1px solid #cfe8ff;
  }

  .route-line,
  .time-line,
  .count-line {
    color: #475569;
    font-size: 0.95rem;
  }

  .error {
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecdd3;
    padding: 0.7rem;
    border-radius: 12px;
  }

  .muted {
    color: #94a3b8;
  }

  .analysis {
    padding: 1rem 1.25rem;
    border-radius: 16px;
  }

  .analysis.card {
    border-left: none;
    border-right: none;
    border-bottom: none;
    border-radius: 0;
  }

  .analysis-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .analysis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .analysis-grid article {
    padding: 0.75rem 0.85rem;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
  }

  .spark {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .bar {
    position: relative;
    background: linear-gradient(90deg, #c7d2fe, #93c5fd);
    border-radius: 10px;
    min-height: 20px;
    padding: 0.15rem 0.5rem;
    display: flex;
    align-items: center;
    color: #0f172a;
    font-weight: 700;
  }

  .bar-label {
    font-size: 0.85rem;
  }

  .bar-count {
    margin-left: auto;
    font-size: 0.85rem;
    color: #1f2937;
  }

  .label {
    color: #475569;
    margin: 0 0 0.15rem;
    font-size: 0.9rem;
  }

  .value {
    font-weight: 800;
    color: #0f172a;
    font-size: 1.3rem;
    margin: 0;
  }

  .hint {
    margin: 0.1rem 0 0;
    color: #6b7280;
    font-size: 0.9rem;
  }

  @media (max-width: 1100px) {
    .panel-stack {
      position: static;
      width: 100%;
      max-height: none;
      flex-direction: row;
      gap: 0.75rem;
      padding: 0;
      margin-top: 110px;
      z-index: 3;
    }

    .panel-stack .card {
      flex: 1 1 0;
      max-height: none;
    }

    .analysis {
      position: static;
      margin: 14px 18px 18px;
    }

    .screen {
      padding-bottom: 12px;
    }
  }
</style>
