<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    ELIGIBILITY_PROOF_OPTIONS,
    ELIGIBILITY_TYPE_OPTIONS,
    tryParseJson,
    type EligibilityProof,
    type EligibilityType,
  } from '$lib/providers/providerFields';

  export let value: unknown = null;
  export let disabled = false;
  export let jsonEnabled = true;

  type Item = { type: '' | EligibilityType; proof: '' | EligibilityProof };

  let mode: 'form' | 'json' = 'form';
  let items: Item[] = [];
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

  function normalizeArray(input: unknown): Item[] {
    const parsed = tryParseJson(input);
    if (!parsed) return [];

    // Legacy shape: { eligibility_reqs: [...] }
    const legacy = parsed as Record<string, unknown>;
    const maybeArray =
      Array.isArray(parsed) ? parsed :
      (legacy && typeof legacy === 'object' && Array.isArray(legacy.eligibility_reqs) ? legacy.eligibility_reqs : null);

    if (!maybeArray) return [];

    return maybeArray
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const t = (entry as Record<string, unknown>).type;
        const p = (entry as Record<string, unknown>).proof;
        return {
          type: typeof t === 'string' ? (t as EligibilityType) : '',
          proof: typeof p === 'string' ? (p as EligibilityProof) : '',
        } satisfies Item;
      })
      .filter(Boolean) as Item[];
  }

  function loadFromValue() {
    jsonError = null;
    items = normalizeArray(value);
    raw = stringifyValue(items);

    if (typeof value === 'string' && value.trim() && items.length === 0) {
      // Likely malformed JSON; let user repair it
      mode = 'json';
      raw = value;
    }
  }

  $: if (!jsonEnabled && mode === 'json') {
    mode = 'form';
    jsonError = null;
  }

  function commitForm(next: Item[]) {
    items = next;
    const payload = items
      .filter((i) => i.type)
      .map((i) => ({
        type: i.type,
        ...(i.proof ? { proof: i.proof } : {}),
      }));
    value = payload;
    raw = stringifyValue(payload);
  }

  function addItem() {
    const defaults: Item = { type: 'Senior', proof: 'id-certified' };
    commitForm([...items, defaults]);
  }

  function removeItem(index: number) {
    commitForm(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, patch: Partial<Item>) {
    commitForm(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
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
      value = items.map((i) => ({
        type: i.type,
        ...(i.proof ? { proof: i.proof } : {}),
      }));
    } catch (err) {
      jsonError = err instanceof Error ? err.message : String(err);
    }
  }

  function toggleMode() {
    if (mode === 'form') {
      mode = 'json';
      raw = stringifyValue(items.map((i) => ({ type: i.type, proof: i.proof })));
      jsonError = null;
      return;
    }

    applyJson();
    if (!jsonError) mode = 'form';
  }

  onMount(loadFromValue);
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <div class="text-xs text-muted-foreground">
      {#if mode === 'form'}
        Add eligibility requirements
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
        No requirements
      </div>
    {:else}
      <div class="space-y-2">
        {#each items as item, index (index)}
          <div class="grid gap-2 sm:grid-cols-3 items-center">
            <div>
              <select
                class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={item.type}
                onchange={(e) => updateItem(index, { type: (e.target as HTMLSelectElement).value as EligibilityType })}
                disabled={disabled}
              >
                <option value="">Type…</option>
                {#each ELIGIBILITY_TYPE_OPTIONS as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>

            <div>
              <select
                class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={item.proof}
                onchange={(e) => updateItem(index, { proof: (e.target as HTMLSelectElement).value as EligibilityProof })}
                disabled={disabled}
              >
                <option value="">Proof…</option>
                {#each ELIGIBILITY_PROOF_OPTIONS as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
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
  {:else}
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
  {/if}
</div>
