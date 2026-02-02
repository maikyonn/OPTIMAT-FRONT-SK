<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { tryParseJson } from '$lib/providers/providerFields';

  export let value: unknown = null;
  export let disabled = false;
  export let jsonEnabled = true;

  let showJson = false;
  let raw = '';
  let jsonError: string | null = null;
  let fileInput: HTMLInputElement | null = null;

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
    raw = stringifyValue(tryParseJson(value));
  }

  function applyJson() {
    jsonError = null;
    const trimmed = raw.trim();
    if (!trimmed) {
      value = null;
      return;
    }
    try {
      value = JSON.parse(trimmed);
    } catch (err) {
      jsonError = err instanceof Error ? err.message : String(err);
    }
  }

  function clear() {
    value = null;
    raw = '';
    jsonError = null;
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      raw = text;
      applyJson();
    } finally {
      input.value = '';
    }
  }

  function clickUpload() {
    fileInput?.click();
  }

  $: if (!jsonEnabled && showJson) {
    showJson = false;
    jsonError = null;
  }

  onMount(loadFromValue);
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <div class="text-xs text-muted-foreground">GeoJSON FeatureCollection</div>
    <div class="flex gap-2">
      {#if jsonEnabled}
        <Button
          variant="outline"
          size="sm"
          onclick={() => { showJson = !showJson; }}
          disabled={disabled}
        >
          {showJson ? 'Hide JSON' : 'Show JSON'}
        </Button>
      {/if}
      <input
        bind:this={fileInput}
        type="file"
        accept=".json,.geojson,application/json"
        class="hidden"
        onchange={handleFileChange}
        disabled={disabled}
      />
      <Button variant="outline" size="sm" onclick={clickUpload} disabled={disabled}>
        Upload
      </Button>
      <Button variant="outline" size="sm" onclick={clear} disabled={disabled}>
        Clear
      </Button>
    </div>
  </div>

  {#if showJson && jsonEnabled}
    <Textarea bind:value={raw} class="font-mono text-sm" rows={5} disabled={disabled} />
    {#if jsonError}
      <div class="text-xs text-destructive">Invalid JSON: {jsonError}</div>
    {/if}

    <div class="flex gap-2">
      <Button variant="outline" size="sm" onclick={applyJson} disabled={disabled}>
        Apply JSON
      </Button>
    </div>
  {:else}
    {@const parsed = tryParseJson(value)}
    {#if parsed && typeof parsed === 'object' && !Array.isArray(parsed)}
      {@const geo = parsed as Record<string, unknown>}
      {@const type = typeof geo.type === 'string' ? geo.type : null}
      {@const features = geo.features}
      {@const featureCount = Array.isArray(features) ? features.length : null}
      <div class="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        {#if type === 'FeatureCollection' && typeof featureCount === 'number'}
          FeatureCollection ({featureCount} feature{featureCount === 1 ? '' : 's'})
        {:else if typeof type === 'string'}
          {type}
        {:else}
          GeoJSON set
        {/if}
      </div>
    {:else}
      <div class="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        No GeoJSON set
      </div>
    {/if}
  {/if}

</div>
