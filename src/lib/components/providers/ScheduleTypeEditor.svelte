<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    ADVANCE_NOTICE_OPTIONS,
    SCHEDULE_TYPE_OPTIONS,
    tryParseJson,
    type ScheduleTypeKind,
  } from '$lib/providers/providerFields';

  export let value: unknown = null;
  export let disabled = false;
  export let jsonEnabled = true;

  let mode: 'form' | 'json' = 'form';
  let scheduleType: '' | ScheduleTypeKind = '';
  let advanceNotice = '';
  let raw = '';
  let jsonError: string | null = null;

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

    const parsed = tryParseJson(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const t = (parsed as Record<string, unknown>).type;
      const notice = (parsed as Record<string, unknown>).advance_notice;
      scheduleType = typeof t === 'string' ? (t as ScheduleTypeKind) : '';
      advanceNotice = typeof notice === 'string' ? notice : '';
      raw = stringifyValue(parsed);
      return;
    }

    // Malformed (or legacy) value - default to raw mode so it can be repaired
    if (typeof value === 'string' && value.trim()) {
      mode = 'json';
      raw = value;
      scheduleType = '';
      advanceNotice = '';
      return;
    }

    scheduleType = '';
    advanceNotice = '';
    raw = '';
  }

  $: if (!jsonEnabled && mode === 'json') {
    mode = 'form';
    jsonError = null;
  }

  function commitForm() {
    if (!scheduleType) {
      value = null;
      raw = '';
      return;
    }

    if (scheduleType === 'in-advance-book') {
      value = {
        type: scheduleType,
        ...(advanceNotice ? { advance_notice: advanceNotice } : {}),
      };
      raw = stringifyValue(value);
      return;
    }

    value = { type: scheduleType };
    raw = stringifyValue(value);
  }

  function applyJson() {
    jsonError = null;
    const trimmed = raw.trim();
    if (!trimmed) {
      value = null;
      scheduleType = '';
      advanceNotice = '';
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      value = parsed;
      const t = parsed?.type;
      const notice = parsed?.advance_notice;
      scheduleType = typeof t === 'string' ? (t as ScheduleTypeKind) : '';
      advanceNotice = typeof notice === 'string' ? notice : '';
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
    if (!jsonError) {
      mode = 'form';
    }
  }

  onMount(loadFromValue);
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <div class="text-xs text-muted-foreground">
      {#if mode === 'form'}
        Choose a schedule type
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
          bind:value={scheduleType}
          onchange={commitForm}
          disabled={disabled}
        >
          <option value="">—</option>
          {#each SCHEDULE_TYPE_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <div>
        {#if scheduleType === 'in-advance-book'}
          <select
            class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            bind:value={advanceNotice}
            onchange={commitForm}
            disabled={disabled}
          >
            <option value="">Advance notice…</option>
            {#each ADVANCE_NOTICE_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        {:else}
          <Input value="" placeholder="Advance notice (n/a)" disabled />
        {/if}
      </div>
    </div>
  {:else}
    <Textarea bind:value={raw} class="font-mono text-sm" rows={4} disabled={disabled} />
    {#if jsonError}
      <div class="text-xs text-destructive">Invalid JSON: {jsonError}</div>
    {/if}
    <div class="flex gap-2">
      <Button variant="outline" size="sm" onclick={applyJson} disabled={disabled}>
        Apply JSON
      </Button>
    </div>
  {/if}
</div>
