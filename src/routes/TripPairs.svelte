<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { buildProvidersApiUrl } from '../config';

  let summaries = [];
  let pairs = [];
  let selectedDate = null;
  let loadingSummaries = true;
  let loadingPairs = false;
  let summaryError = null;
  let pairsError = null;

  onMount(loadSummaries);

  async function loadSummaries() {
    loadingSummaries = true;
    summaryError = null;
    try {
      const response = await fetch(buildProvidersApiUrl('/trip-records/pair-summaries'));
      if (!response.ok) {
        throw new Error(`Failed to load summaries (HTTP ${response.status})`);
      }
      const data = await response.json();
      summaries = [...data].sort((a, b) => (a.service_date < b.service_date ? 1 : -1));
      if (summaries.length > 0) {
        selectDate(summaries[0].service_date, { initial: true });
      }
    } catch (error) {
      console.error('Error loading summaries', error);
      summaryError = error?.message ?? 'Unable to load summaries.';
      summaries = [];
    } finally {
      loadingSummaries = false;
    }
  }

  async function loadPairs(date) {
    if (!date) return;
    loadingPairs = true;
    pairsError = null;
    try {
      const response = await fetch(
        buildProvidersApiUrl(`/trip-records/pairs?service_date=${date}`)
      );
      if (!response.ok) {
        throw new Error(`Failed to load pairs (HTTP ${response.status})`);
      }
      pairs = await response.json();
    } catch (error) {
      console.error('Error loading trip pairs', error);
      pairsError = error?.message ?? 'Unable to load trip pairs.';
      pairs = [];
    } finally {
      loadingPairs = false;
    }
  }

  function selectDate(date, { initial = false } = {}) {
    if (!initial && date === selectedDate) {
      return;
    }
    selectedDate = date;
    loadPairs(date);
  }

  $: selectedSummary = summaries.find((item) => item.service_date === selectedDate);

  function formatDateLabel(dateString) {
    if (!dateString) return 'Unknown date';
    const value = new Date(dateString);
    if (Number.isNaN(value.getTime())) {
      return dateString;
    }
    return value.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatTime(timeString) {
    if (!timeString) return '—';
    return timeString.slice(0, 5);
  }

  function formatMinutes(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return '—';
    }
    return `${Number(value).toFixed(1)} min`;
  }
</script>

<div class="trip-pairs-page">
  <div class="content-wrapper">
    <section class="pair-list">
      <header class="page-header" in:fade={{ duration: 250 }}>
        <div>
          <h1>Trip Record Pairs</h1>
          <p>
            Review day-level yard pairings with outbound, inbound, and activity metrics. Select a date to
            explore all paired trips.
          </p>
        </div>
      </header>

      {#if summaryError}
        <div class="error-banner" in:fade>
          <p>{summaryError}</p>
        </div>
      {/if}

      {#if loadingPairs}
        <div class="loading-state" in:fade>
          <div class="spinner"></div>
          <p>Loading trip pairs…</p>
        </div>
      {:else if pairsError}
        <div class="error-banner" in:fade>
          <p>{pairsError}</p>
        </div>
      {:else if pairs.length === 0}
        <div class="empty-state" in:fade>
          <h2>No trip pairs found</h2>
          <p>Select a different date to view paired trip activity.</p>
        </div>
      {:else}
        <div class="pairs-grid">
          {#each pairs as pair (pair.service_date + '-' + pair.trip_id)}
            <article class="pair-card" in:fade>
              <header class="pair-header">
                <div>
                  <h2>Trip #{pair.trip_id}</h2>
                  <p class="meta">
                    {formatDateLabel(pair.service_date)} &middot; {pair.route ?? 'Route N/A'} &middot;
                    Vehicle {pair.vehicle ?? 'N/A'}
                  </p>
                </div>
                <div class="counts">
                  <span><strong>{pair.pickup_count}</strong> pickups</span>
                  <span><strong>{pair.drop_count}</strong> drops</span>
                </div>
              </header>

              <div class="pair-body">
                <div class="timeline">
                  <div class="timeline-item">
                    <span class="label">Leave Yard</span>
                    <span class="value">{formatTime(pair.lyard_time)}</span>
                  </div>
                  <div class="timeline-item">
                    <span class="label">First Pickup</span>
                    <span class="value">
                      {pair.first_pick_address
                        ? `${pair.first_pick_address}, ${pair.first_pick_city ?? ''}`.trim()
                        : '—'}
                    </span>
                  </div>
                  <div class="timeline-item">
                    <span class="label">Last Drop</span>
                    <span class="value">
                      {pair.last_drop_address
                        ? `${pair.last_drop_address}, ${pair.last_drop_city ?? ''}`.trim()
                        : '—'}
                    </span>
                  </div>
                  <div class="timeline-item">
                    <span class="label">Return Yard</span>
                    <span class="value">{formatTime(pair.ryard_time)}</span>
                  </div>
                </div>

                <div class="metrics">
                  <div class="metric">
                    <span>Outbound</span>
                    <strong>{formatMinutes(pair.outbound_minutes)}</strong>
                  </div>
                  <div class="metric">
                    <span>Activity</span>
                    <strong>{formatMinutes(pair.activity_minutes)}</strong>
                  </div>
                  <div class="metric">
                    <span>Inbound</span>
                    <strong>{formatMinutes(pair.inbound_minutes)}</strong>
                  </div>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <aside class="date-sidebar">
      <div class="sidebar-header">
        <h2>Service Dates</h2>
        {#if loadingSummaries}
          <div class="spinner small"></div>
        {/if}
      </div>

      {#if summaries.length === 0 && !loadingSummaries}
        <p class="sidebar-empty">No paired dates available.</p>
      {/if}

      <ul>
        {#each summaries as summary (summary.service_date)}
          <li>
            <button
              class:selected={summary.service_date === selectedDate}
              on:click={() => selectDate(summary.service_date)}
            >
              <span class="date-label">{formatDateLabel(summary.service_date)}</span>
              <span class="date-meta">{summary.pair_count} pairs</span>
            </button>
          </li>
        {/each}
      </ul>
    </aside>
  </div>

  <footer class="stats-bar" in:fade>
    {#if selectedSummary}
      <div class="stat">
        <span>Date</span>
        <strong>{formatDateLabel(selectedSummary.service_date)}</strong>
      </div>
      <div class="stat">
        <span>Total Pairs</span>
        <strong>{selectedSummary.pair_count}</strong>
      </div>
      <div class="stat">
        <span>Avg Outbound</span>
        <strong>{formatMinutes(selectedSummary.average_outbound_minutes)}</strong>
      </div>
      <div class="stat">
        <span>Avg Activity</span>
        <strong>{formatMinutes(selectedSummary.average_activity_minutes)}</strong>
      </div>
      <div class="stat">
        <span>Avg Inbound</span>
        <strong>{formatMinutes(selectedSummary.average_inbound_minutes)}</strong>
      </div>
    {:else}
      <p>Select a date to view statistics.</p>
    {/if}
  </footer>
</div>

<style>
  .trip-pairs-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f8fafc;
  }

  .content-wrapper {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .pair-list {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.8rem;
    color: #111827;
  }

  .page-header p {
    margin: 0.35rem 0 0;
    color: #4b5563;
    font-size: 0.95rem;
  }

  .error-banner {
    margin: 1.5rem 0;
    padding: 1rem;
    border-radius: 0.75rem;
    background: rgba(248, 113, 113, 0.15);
    color: #991b1b;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 0;
    color: #4b5563;
  }

  .loading-state p {
    margin: 0;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 1.25rem;
    height: 1.25rem;
  }

  .pairs-grid {
    display: grid;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .pair-card {
    background: white;
    border-radius: 1rem;
    padding: 1.25rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.04);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .pair-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .pair-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: #1f2937;
  }

  .pair-header .meta {
    margin: 0.25rem 0 0;
    color: #6b7280;
    font-size: 0.85rem;
  }

  .counts {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    color: #4338ca;
  }

  .counts strong {
    font-size: 1.1rem;
  }

  .pair-body {
    display: grid;
    gap: 1.25rem;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .timeline-item {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0.75rem;
    background: #f1f5f9;
    border-radius: 0.65rem;
    font-size: 0.9rem;
  }

  .timeline-item .label {
    font-weight: 600;
    color: #1f2937;
  }

  .timeline-item .value {
    color: #475569;
    text-align: right;
  }

  .metrics {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .metric {
    flex: 1;
    min-width: 120px;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05));
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .metric span {
    color: #4338ca;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .metric strong {
    color: #1f2937;
    font-size: 1rem;
  }

  .date-sidebar {
    width: 280px;
    border-left: 1px solid #e5e7eb;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1rem;
    overflow-y: auto;
    gap: 1rem;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1rem;
    color: #1f2937;
  }

  .date-sidebar ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .date-sidebar button {
    width: 100%;
    text-align: left;
    padding: 0.75rem;
    border: 1px solid transparent;
    border-radius: 0.75rem;
    background: #f8fafc;
    color: #0f172a;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .date-sidebar button:hover {
    border-color: rgba(99, 102, 241, 0.4);
    background: white;
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.12);
  }

  .date-sidebar button.selected {
    border-color: #6366f1;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), white);
    box-shadow: 0 12px 25px rgba(79, 70, 229, 0.14);
  }

  .date-label {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .date-meta {
    font-size: 0.8rem;
    color: #4b5563;
  }

  .sidebar-empty {
    color: #6b7280;
    font-size: 0.9rem;
  }

  .stats-bar {
    padding: 0.85rem 1.5rem;
    background: #111827;
    color: white;
    display: flex;
    gap: 1.5rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .stats-bar .stat {
    display: flex;
    flex-direction: column;
    text-align: center;
    gap: 0.25rem;
    min-width: 120px;
  }

  .stats-bar span {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.7);
  }

  .stats-bar strong {
    font-size: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1024px) {
    .date-sidebar {
      display: none;
    }

    .stats-bar {
      justify-content: flex-start;
    }
  }
</style>
