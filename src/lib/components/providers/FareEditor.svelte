<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { FARE_PAYMENT_OPTIONS, FARE_TYPE_OPTIONS, tryParseJson, type FarePayment, type FareType } from '$lib/providers/providerFields';

  export let value: unknown = null;
  export let disabled = false;
  export let jsonEnabled = true;

  let mode: 'form' | 'json' = 'form';
  let fareType: '' | FareType = '';
  let cost = '';
  let payment: '' | FarePayment = '';
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
      const t = (parsed as Record<string, unknown>).type;
      const c = (parsed as Record<string, unknown>).cost;
      const p = (parsed as Record<string, unknown>).payment;
      fareType = typeof t === 'string' ? (t as FareType) : '';
      cost = typeof c === 'string' ? c : '';
      payment = typeof p === 'string' ? (p as FarePayment) : '';
      raw = stringifyValue(parsed);
      return;
    }

    if (typeof value === 'string' && value.trim()) {
      mode = 'json';
      raw = value;
      fareType = '';
      cost = '';
      payment = '';
      formStateValid = false;
      return;
    }

    fareType = '';
    cost = '';
    payment = '';
    raw = '';
  }

  $: if (!jsonEnabled && mode === 'json' && formStateValid) {
    mode = 'form';
    jsonError = null;
  }

  $: if (initialized && mode === 'form') {
    if (!fareType) {
      value = null;
      raw = '';
    } else if (fareType === 'fixed') {
      const next = { type: fareType, ...(cost ? { cost } : {}), ...(payment ? { payment } : {}) };
      value = next;
      raw = stringifyValue(next);
    } else {
      const next = { type: fareType };
      value = next;
      if (cost) cost = '';
      if (payment) payment = '';
      raw = stringifyValue(next);
    }
  }

  function applyJson() {
    jsonError = null;
    const trimmed = raw.trim();
    if (!trimmed) {
      value = null;
      fareType = '';
      cost = '';
      payment = '';
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      value = parsed;
      const t = parsed?.type;
      const c = parsed?.cost;
      const p = parsed?.payment;
      fareType = typeof t === 'string' ? (t as FareType) : '';
      cost = typeof c === 'string' ? c : '';
      payment = typeof p === 'string' ? (p as FarePayment) : '';
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
        Choose fare type
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
    <div class="grid gap-2 sm:grid-cols-3">
      <div class="sm:col-span-1">
        <select
          class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          bind:value={fareType}
          disabled={disabled}
        >
          <option value="">—</option>
          {#each FARE_TYPE_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <div class="sm:col-span-1">
        {#if fareType === 'fixed'}
          <Input bind:value={cost} placeholder="Cost (e.g., $2.50)" disabled={disabled} />
        {:else}
          <Input value="" placeholder="Cost (n/a)" disabled />
        {/if}
      </div>

      <div class="sm:col-span-1">
        {#if fareType === 'fixed'}
          <select
            class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            bind:value={payment}
            disabled={disabled}
          >
            <option value="">Payment…</option>
            {#each FARE_PAYMENT_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        {:else}
          <Input value="" placeholder="Payment (n/a)" disabled />
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
