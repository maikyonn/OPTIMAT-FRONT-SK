<script lang="ts">
  // @ts-nocheck
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { buildProvidersApiUrl } from '../config';
  import PageShell from '$lib/components/PageShell.svelte';

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
      if (!response.ok) throw new Error(`Failed to load summaries (HTTP ${response.status})`);
      const data = await response.json();
      summaries = [...data].sort((a, b) => (a.service_date < b.service_date ? 1 : -1));
      if (summaries.length > 0) selectDate(summaries[0].service_date, { initial: true });
    } catch (error) {
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
      const response = await fetch(buildProvidersApiUrl(`/trip-records/pairs?service_date=${date}`));
      if (!response.ok) throw new Error(`Failed to load pairs (HTTP ${response.status})`);
      pairs = await response.json();
    } catch (error) {
      pairsError = error?.message ?? 'Unable to load trip pairs.';
      pairs = [];
    } finally {
      loadingPairs = false;
    }
  }

  function selectDate(date, { initial = false } = {}) {
    if (!initial && date === selectedDate) return;
    selectedDate = date;
    loadPairs(date);
  }

  $: selectedSummary = summaries.find((item) => item.service_date === selectedDate);

  const formatDateLabel = (dateString) => {
    if (!dateString) return 'Unknown date';
    const value = new Date(dateString);
    if (Number.isNaN(value.getTime())) return dateString;
    return value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTime = (timeString) => (timeString ? timeString.slice(0, 5) : '—');
  const formatMinutes = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(1)} min`);
</script>

<PageShell
  title="Trip Record Pairs"
  description="Day-level yard pairings with outbound, activity, and inbound metrics."
  backHref="/"
  fullWidth={true}
>
  <div class="trip-pairs-page">
    <div class="content-wrapper">
      <section class="pair-list">
        <header class="page-header" in:fade={{ duration: 250 }}>
          <div>
            <h1>Trip Record Pairs</h1>
            <p>Review day-level yard pairings with outbound, inbound, and activity metrics. Select a date to explore all paired trips.</p>
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
                      {formatDateLabel(pair.service_date)} · {pair.route ?? 'Route N/A'} · Vehicle {pair.vehicle ?? 'N/A'}
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
                      <span class="value">{pair.first_pick_address ? `${pair.first_pick_address}, ${pair.first_pick_city ?? ''}`.trim() : '—'}</span>
                    </div>
                    <div class="timeline-item">
                      <span class="label">Last Drop</span>
                      <span class="value">{pair.last_drop_address ? `${pair.last_drop_address}, ${pair.last_drop_city ?? ''}`.trim() : '—'}</span>
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
              <button class:selected={summary.service_date === selectedDate} on:click={() => selectDate(summary.service_date)}>
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
</PageShell>

<style>
  .trip-pairs-page {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 240px);
    background: transparent;
  }

  .content-wrapper {
    flex: 1;
    display: flex;
    gap: 1.25rem;
  }

  .pair-list {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.04);
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.6rem;
    color: var(--color-foreground);
  }

  .page-header p {
    margin: 0.35rem 0 0;
    color: var(--color-muted-foreground);
    font-size: 0.95rem;
  }

  .error-banner {
    margin: 1.5rem 0;
    padding: 1rem;
    border-radius: 0.75rem;
    background: rgba(248, 113, 113, 0.15);
    color: #991b1b;
    border: 1px solid rgba(248, 113, 113, 0.4);
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
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .pair-card {
    border: 1px solid var(--color-border);
    border-radius: 0.9rem;
    padding: 1rem;
    background: var(--color-card);
    box-shadow: 0 10px 25px rgba(0,0,0,0.03);
  }

  .pair-header {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .meta {
    color: var(--color-muted-foreground);
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
  }

  .counts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--color-muted-foreground);
    font-size: 0.9rem;
  }

  .timeline {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.5rem;
    margin: 0.75rem 0;
  }

  .timeline-item {
    background: var(--color-muted);
    border-radius: 0.6rem;
    padding: 0.6rem 0.75rem;
  }

  .timeline-item .label {
    display: block;
    color: var(--color-muted-foreground);
    font-size: 0.85rem;
  }

  .timeline-item .value {
    font-weight: 600;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .metric {
    background: var(--color-muted);
    border-radius: 0.6rem;
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .date-sidebar {
    width: clamp(260px, 26vw, 360px);
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    padding: 1rem;
    background: var(--color-card);
    box-shadow: 0 10px 25px rgba(0,0,0,0.03);
    overflow-y: auto;
    max-height: calc(100vh - 240px);
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .sidebar-empty {
    color: var(--color-muted-foreground);
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
    border: 1px solid var(--color-border);
    background: var(--color-muted);
    border-radius: 0.6rem;
    padding: 0.65rem 0.75rem;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  .date-sidebar button.selected {
    border-color: var(--color-primary);
    background: var(--color-primary) / 5;
  }

  .date-label {
    display: block;
    font-weight: 600;
  }

  .date-meta {
    display: block;
    color: var(--color-muted-foreground);
    font-size: 0.85rem;
  }

  .stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.8rem;
    background: var(--color-card);
    box-shadow: 0 10px 20px rgba(0,0,0,0.02);
    margin-top: 1rem;
  }

  .stat span {
    color: var(--color-muted-foreground);
    font-size: 0.85rem;
  }

  .stat strong {
    display: block;
    font-size: 1.05rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
