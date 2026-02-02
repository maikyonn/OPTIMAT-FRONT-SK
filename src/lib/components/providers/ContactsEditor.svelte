<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { tryParseJson } from '$lib/providers/providerFields';

  export let value: unknown = null;
  export let disabled = false;
  export let jsonEnabled = true;

  type Item = { name: string; email: string };

  let mode: 'form' | 'json' = 'form';
  let items: Item[] = [];
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

  function normalizeArray(input: unknown): Item[] {
    const parsed = tryParseJson(input);
    if (!parsed) return [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const name = (entry as Record<string, unknown>).name;
        const email = (entry as Record<string, unknown>).email;
        return {
          name: typeof name === 'string' ? name : '',
          email: typeof email === 'string' ? email : '',
        } satisfies Item;
      })
      .filter(Boolean) as Item[];
  }

  function loadFromValue() {
    jsonError = null;
    formStateValid = true;
    items = normalizeArray(value);
    raw = stringifyValue(items);

    if (typeof value === 'string' && value.trim() && items.length === 0) {
      mode = 'json';
      raw = value;
      formStateValid = false;
    }
  }

  $: if (!jsonEnabled && mode === 'json' && formStateValid) {
    mode = 'form';
    jsonError = null;
  }

  $: if (initialized && mode === 'form') {
    const payload = items
      .map((i) => ({ name: i.name?.trim() || '', email: i.email?.trim() || '' }))
      .filter((i) => i.name || i.email);
    value = payload;
    raw = stringifyValue(payload);
  }

  function addItem() {
    items = [...items, { name: '', email: '' }];
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  function applyJson() {
    jsonError = null;
    const trimmed = raw.trim();
    if (!trimmed) {
      value = [];
      items = [];
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      items = normalizeArray(parsed);
    } catch (err) {
      jsonError = err instanceof Error ? err.message : String(err);
    }
  }

  function toggleMode() {
    if (mode === 'form') {
      mode = 'json';
      raw = stringifyValue(items);
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
        Add contacts
      {:else}
        Edit raw JSON (advanced)
      {/if}
    </div>
    <div class="flex gap-2">
      {#if mode === 'form'}
        <Button variant="outline" size="sm" onclick={addItem} disabled={disabled}>
          Add
        </Button>
      {/if}
      {#if jsonEnabled}
        <Button variant="outline" size="sm" onclick={toggleMode} disabled={disabled}>
          {mode === 'form' ? 'Raw JSON' : 'Form'}
        </Button>
      {/if}
    </div>
  </div>

  {#if mode === 'form'}
    {#if items.length === 0}
      <div class="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        No contacts
      </div>
    {:else}
      <div class="space-y-2">
        {#each items as item, index (index)}
          <div class="grid gap-2 sm:grid-cols-3 items-center">
            <div>
              <Input bind:value={items[index].name} placeholder="Name" disabled={disabled} />
            </div>
            <div>
              <Input bind:value={items[index].email} placeholder="Email" disabled={disabled} />
            </div>
            <div class="flex justify-end">
              <Button variant="outline" size="sm" onclick={() => removeItem(index)} disabled={disabled}>
                Remove
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if jsonEnabled}
    <Textarea
      bind:value={raw}
      class="font-mono text-sm"
      rows={6}
      disabled={disabled}
    />
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
