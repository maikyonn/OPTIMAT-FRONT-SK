<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { BOOKING_METHOD_OPTIONS, tryParseJson, type BookingMethod } from '$lib/providers/providerFields';

  export let value: unknown = null;
  export let disabled = false;
  export let jsonEnabled = true;

  let mode: 'form' | 'json' = 'form';
  let method: '' | BookingMethod = '';
  let details = '';
  let raw = '';
  let jsonError: string | null = null;
  let initialized = false;
  let formStateValid = true;

  function stringifyValue(input: unknown): string {
    if (input === null || input === undefined) return '';
    if (typeof input === 'string') return input;
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  }

  function loadFromValue() {
    jsonError = null;
    formStateValid = true;
    const parsed = tryParseJson(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const m = (parsed as Record<string, unknown>).method;
      const d = (parsed as Record<string, unknown>).details;
      method = typeof m === 'string' ? (m as BookingMethod) : '';
      details = typeof d === 'string' ? d : '';
      raw = stringifyValue(parsed);
      return;
    }

    if (typeof value === 'string' && value.trim()) {
      mode = 'json';
      raw = value;
      method = '';
      details = '';
      formStateValid = false;
      return;
    }

    method = '';
    details = '';
    raw = '';
  }

  $: if (!jsonEnabled && mode === 'json' && formStateValid) {
    mode = 'form';
    jsonError = null;
  }

  $: if (initialized && mode === 'form') {
    if (!method) {
      value = null;
      raw = '';
    } else if (method === 'none') {
      const next = { method };
      value = next;
      if (details) details = '';
      raw = stringifyValue(next);
    } else {
      const next = { method, ...(details ? { details } : {}) };
      value = next;
      raw = stringifyValue(next);
    }
  }

  function applyJson() {
    jsonError = null;
    const trimmed = raw.trim();
    if (!trimmed) {
      value = null;
      method = '';
      details = '';
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      value = parsed;
      const m = parsed?.method;
      const d = parsed?.details;
      method = typeof m === 'string' ? (m as BookingMethod) : '';
      details = typeof d === 'string' ? d : '';
      formStateValid = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
    } catch (err) {
      jsonError = err instanceof Error ? err.message : String(err);
    }
  }

  function toggleMode() {
    if (mode === 'form') {
      mode = 'json';
      raw = stringifyValue(tryParseJson(value));
      jsonError = null;
      return;
    }

    applyJson();
    if (!jsonError) mode = 'form';
  }

  onMount(() => {
    loadFromValue();
    initialized = true;
  });
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <div class="text-xs text-muted-foreground">
      {#if mode === 'form'}
        Choose a booking method
      {:else}
        Edit raw JSON (advanced)
      {/if}
    </div>
    {#if jsonEnabled}
      <Button variant="outline" size="sm" onclick={toggleMode} disabled={disabled}>
        {mode === 'form' ? 'Raw JSON' : 'Form'}
      </Button>
    {/if}
  </div>

  {#if mode === 'form'}
    <div class="grid gap-2 sm:grid-cols-2">
      <div>
        <select
          class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          bind:value={method}
          disabled={disabled}
        >
          <option value="">—</option>
          {#each BOOKING_METHOD_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <div>
        {#if method === 'call'}
          <Input bind:value={details} placeholder="Phone number" disabled={disabled} />
        {:else if method === 'app'}
          <Input bind:value={details} placeholder="App details (e.g., Lyft/Uber)" disabled={disabled} />
        {:else}
          <Input value="" placeholder="Details (n/a)" disabled />
        {/if}
      </div>
    </div>
  {:else if jsonEnabled}
    <Textarea bind:value={raw} class="font-mono text-sm" rows={4} disabled={disabled} />
    {#if jsonError}
      <div class="text-xs text-destructive">Invalid JSON: {jsonError}</div>
    {/if}
    <div class="flex gap-2">
      <Button variant="outline" size="sm" onclick={applyJson} disabled={disabled}>
        Apply JSON
      </Button>
    </div>
  {:else}
    <div class="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      JSON is hidden. Enable “Show JSON” to repair this field.
    </div>
  {/if}
</div>
