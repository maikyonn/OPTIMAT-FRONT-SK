<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { push } from 'svelte-spa-router';
  import PageShell from '$lib/components/PageShell.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import ScheduleTypeEditor from '$lib/components/providers/ScheduleTypeEditor.svelte';
  import EligibilityReqsEditor from '$lib/components/providers/EligibilityReqsEditor.svelte';
  import BookingEditor from '$lib/components/providers/BookingEditor.svelte';
  import FareEditor from '$lib/components/providers/FareEditor.svelte';
  import ContactsEditor from '$lib/components/providers/ContactsEditor.svelte';
  import ServiceZoneEditor from '$lib/components/providers/ServiceZoneEditor.svelte';
  import { updateProvider, type Provider } from '$lib/api';
  import providerSession, { clearProvider, setProvider } from '$lib/stores/providerSession';
  import mockDataEnabled from '$lib/stores/mockData';
  import { providerPortalNavItems } from '$lib/providerPortalNav';
  import {
    PROVIDER_TYPE_OPTIONS,
    ROUTING_TYPE_OPTIONS,
    formatBooking,
    formatContacts,
    formatEligibilityReqs,
    formatFare,
    formatScheduleType,
    formatServiceZone,
    tryParseJson,
  } from '$lib/providers/providerFields';

  let editMode = false;
  let saving = false;
  let saveError: string | null = null;
  let saveSuccess = false;
  let editForm: Record<string, any> = {};
  let jsonEnabled = false;

  $: provider = $providerSession.provider as Provider | null;
  $: mockEnabled = $mockDataEnabled;

  $: if (provider && !editMode) {
    editForm = { ...provider };
  }

  onMount(() => {
    jsonEnabled = localStorage.getItem('optimat-provider-json') === 'true';
  });

  function toggleJsonEnabled() {
    jsonEnabled = !jsonEnabled;
    localStorage.setItem('optimat-provider-json', String(jsonEnabled));
  }

  function enableEditMode() {
    if (!provider) return;
    editMode = true;
    editForm = { ...provider };

    saveSuccess = false;
    saveError = null;
  }

  async function saveProvider() {
    if (!provider) return;

    saving = true;
    saveError = null;
    saveSuccess = false;

    try {
      const providerId = provider.provider_id || provider.id;

      const canonicalizeForDiff = (v: unknown) => {
        if (v === undefined) return '__undefined__';
        const parsed = tryParseJson(v);
        if (parsed === undefined) return '__undefined__';
        try {
          return JSON.stringify(parsed);
        } catch {
          return String(parsed);
        }
      };

      const candidates: Record<string, unknown> = {
        provider_name: editForm.provider_name,
        provider_type: editForm.provider_type,
        routing_type: editForm.routing_type,
        schedule_type: editForm.schedule_type,
        eligibility_reqs: editForm.eligibility_reqs,
        booking: editForm.booking,
        fare: editForm.fare,
        contacts: editForm.contacts,
        website: editForm.website,
        round_trip_booking: editForm.round_trip_booking,
        investigated: editForm.investigated,
        service_zone: editForm.service_zone,
      };

      const updatePayload: Record<string, unknown> = {};
      for (const [key, nextValue] of Object.entries(candidates)) {
        if (nextValue === undefined) continue;
        const currentValue = (provider as unknown as Record<string, unknown>)[key];
        if (canonicalizeForDiff(currentValue) !== canonicalizeForDiff(nextValue)) {
          updatePayload[key] = nextValue;
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        editMode = false;
        return;
      }

      // Basic shape validation for structured JSON fields (prevents storing invalid scalars)
      const jsonFieldErrors: string[] = [];
      if ('provider_name' in updatePayload) {
        const name = String(updatePayload.provider_name || '').trim();
        if (!name) jsonFieldErrors.push('Provider Name is required');
      }
      if ('schedule_type' in updatePayload) {
        const schedule = tryParseJson(updatePayload.schedule_type);
        if (schedule !== null && schedule !== undefined && schedule !== '' && (typeof schedule !== 'object' || Array.isArray(schedule))) {
          jsonFieldErrors.push('Schedule Type must be a JSON object');
        }
      }
      if ('booking' in updatePayload) {
        const booking = tryParseJson(updatePayload.booking);
        if (booking !== null && booking !== undefined && booking !== '' && (typeof booking !== 'object' || Array.isArray(booking))) {
          jsonFieldErrors.push('Booking must be a JSON object');
        }
      }
      if ('fare' in updatePayload) {
        const fare = tryParseJson(updatePayload.fare);
        if (fare !== null && fare !== undefined && fare !== '' && (typeof fare !== 'object' || Array.isArray(fare))) {
          jsonFieldErrors.push('Fare must be a JSON object');
        }
      }
      if ('contacts' in updatePayload) {
        const contacts = tryParseJson(updatePayload.contacts);
        if (contacts !== null && contacts !== undefined && contacts !== '' && !Array.isArray(contacts)) {
          jsonFieldErrors.push('Contacts must be a JSON array');
        }
      }
      if ('eligibility_reqs' in updatePayload) {
        const eligibility = tryParseJson(updatePayload.eligibility_reqs);
        if (eligibility !== null && eligibility !== undefined && eligibility !== '' && !Array.isArray(eligibility)) {
          jsonFieldErrors.push('Eligibility Requirements must be a JSON array');
        }
      }
      if ('service_zone' in updatePayload) {
        const zone = tryParseJson(updatePayload.service_zone);
        if (zone !== null && zone !== undefined && zone !== '' && (typeof zone !== 'object' || Array.isArray(zone))) {
          jsonFieldErrors.push('Service Zone must be a GeoJSON object');
        }
      }

      if (jsonFieldErrors.length > 0) {
        throw new Error(jsonFieldErrors.join('; '));
      }

      const { data: updatedProvider, error: updateError } = await updateProvider(providerId, updatePayload);

      if (updateError) {
        throw updateError;
      }

      if (!updatedProvider) {
        throw new Error('Failed to save provider - no data returned');
      }

      setProvider(updatedProvider);
      editForm = { ...updatedProvider };
      editMode = false;
      saveSuccess = true;

      setTimeout(() => {
        saveSuccess = false;
      }, 3000);

    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }

  function formatJsonField(value: unknown) {
    if (!value) return '';
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  }

  function logout() {
    clearProvider();
    push('/provider-portal');
  }

  function toggleMockData() {
    mockDataEnabled.update((value) => !value);
  }

  function goToLogin() {
    push('/provider-portal');
  }
</script>

<PageShell appMode={true} navItems={providerPortalNavItems}>
  <div slot="header-actions" class="flex items-center gap-2 text-xs text-muted-foreground">
    {#if provider}
      <span><span class="text-foreground font-medium">Provider View:</span> {provider.provider_name}</span>
      <Button variant="outline" size="sm" onclick={logout}>Sign out</Button>
    {:else}
      <span>Public View</span>
    {/if}
    <Button variant="outline" size="sm" onclick={toggleMockData}>
      {mockEnabled ? 'Mock Data: On' : 'Mock Data: Off'}
    </Button>
  </div>

  <div class="flex-1 overflow-auto p-6">
    {#if !provider}
      <div class="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6" in:fade={{ duration: 200 }}>
        <h2 class="text-lg font-semibold text-slate-900">Sign in to view provider info</h2>
        <p class="text-sm text-slate-600 mt-2">Your provider profile and edit tools are available after you sign in.</p>
        <Button class="mt-4" onclick={goToLogin}>Go to Provider Portal</Button>
      </div>
    {:else}
      <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-xl shadow-lg border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h1 class="text-xl font-bold text-slate-900">{provider.provider_name}</h1>
              <p class="text-sm text-slate-600">Provider ID: {provider.provider_id || provider.id}</p>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" onclick={toggleJsonEnabled}>
                {jsonEnabled ? 'Hide JSON' : 'Show JSON'}
              </Button>
              {#if !editMode}
                <Button onclick={enableEditMode}>Edit Information</Button>
              {/if}
            </div>
          </div>

          {#if saveSuccess}
            <div class="mx-6 mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" transition:fade>
              Your changes have been saved successfully!
            </div>
          {/if}
          {#if saveError}
            <div class="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" transition:fade>
              {saveError}
            </div>
          {/if}

          <div class="p-6">
            <div class="grid gap-6">
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Provider Name</label>
                {#if editMode}
                  <Input bind:value={editForm.provider_name} placeholder="Provider name" />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.provider_name || '-'}</div>
                {/if}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="block text-sm font-medium text-slate-700 mb-2">Provider Type</label>
                  {#if editMode}
                    <Input bind:value={editForm.provider_type} list="provider-type-options" placeholder="Select or type…" />
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.provider_type || '-'}</div>
                  {/if}
                </div>

                <div>
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="block text-sm font-medium text-slate-700 mb-2">Routing Type</label>
                  {#if editMode}
                    <Input bind:value={editForm.routing_type} list="routing-type-options" placeholder="Select or type…" />
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.routing_type || '-'}</div>
                  {/if}
                </div>
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Schedule Type</label>
                {#if editMode}
                  <ScheduleTypeEditor bind:value={editForm.schedule_type} disabled={saving} jsonEnabled={jsonEnabled} />
                {:else}
                  {#if jsonEnabled}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatJsonField(provider.schedule_type) || '-'}
                    </div>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">
                      {formatScheduleType(provider.schedule_type) || '-'}
                    </div>
                  {/if}
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Eligibility Requirements</label>
                {#if editMode}
                  <EligibilityReqsEditor bind:value={editForm.eligibility_reqs} disabled={saving} jsonEnabled={jsonEnabled} />
                {:else}
                  {#if jsonEnabled}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatJsonField(provider.eligibility_reqs) || '-'}
                    </div>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatEligibilityReqs(provider.eligibility_reqs) || '-'}
                    </div>
                  {/if}
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Booking Information</label>
                {#if editMode}
                  <BookingEditor bind:value={editForm.booking} disabled={saving} jsonEnabled={jsonEnabled} />
                {:else}
                  {#if jsonEnabled}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatJsonField(provider.booking) || '-'}
                    </div>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatBooking(provider.booking) || '-'}
                    </div>
                  {/if}
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Fare Information</label>
                {#if editMode}
                  <FareEditor bind:value={editForm.fare} disabled={saving} jsonEnabled={jsonEnabled} />
                {:else}
                  {#if jsonEnabled}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatJsonField(provider.fare) || '-'}
                    </div>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatFare(provider.fare) || '-'}
                    </div>
                  {/if}
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Website</label>
                {#if editMode}
                  <Input bind:value={editForm.website} placeholder="https://example.com" />
                {:else}
                  {#if provider.website}
                    <a
                      href={provider.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary hover:underline bg-slate-50 rounded-md px-3 py-2 block"
                    >
                      {provider.website}
                    </a>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">-</div>
                  {/if}
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Contact Information</label>
                {#if editMode}
                  <ContactsEditor bind:value={editForm.contacts} disabled={saving} jsonEnabled={jsonEnabled} />
                {:else}
                  {#if jsonEnabled}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatJsonField(provider.contacts) || '-'}
                    </div>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {formatContacts(provider.contacts) || '-'}
                    </div>
                  {/if}
                {/if}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="block text-sm font-medium text-slate-700 mb-2">Round Trip Booking</label>
                  {#if editMode}
                    <label class="flex items-center gap-3 cursor-pointer bg-slate-50 rounded-md px-3 py-2">
                      <input
                        type="checkbox"
                        bind:checked={editForm.round_trip_booking}
                        class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span class="text-sm text-slate-700">Requires round trip booking</span>
                    </label>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">
                      {#if provider.round_trip_booking === true}
                        <span class="text-green-600 font-medium">Yes</span>
                      {:else if provider.round_trip_booking === false}
                        <span class="text-slate-500">No</span>
                      {:else}
                        <span class="text-slate-400">-</span>
                      {/if}
                    </div>
                  {/if}
                </div>

                <div>
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="block text-sm font-medium text-slate-700 mb-2">Investigated</label>
                  {#if editMode}
                    <label class="flex items-center gap-3 cursor-pointer bg-slate-50 rounded-md px-3 py-2">
                      <input
                        type="checkbox"
                        bind:checked={editForm.investigated}
                        class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span class="text-sm text-slate-700">Provider has been investigated</span>
                    </label>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">
                      {#if provider.investigated === true}
                        <span class="text-green-600 font-medium">Yes</span>
                      {:else if provider.investigated === false}
                        <span class="text-slate-500">No</span>
                      {:else}
                        <span class="text-slate-400">-</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">
                  Service Zone (GeoJSON)
                  {#if provider.has_service_zone}
                    <span class="ml-2 text-green-600 text-xs font-normal">Has zone</span>
                  {:else}
                    <span class="ml-2 text-amber-600 text-xs font-normal">No zone defined</span>
                  {/if}
                </label>
                {#if editMode}
                  <ServiceZoneEditor bind:value={editForm.service_zone} disabled={saving} jsonEnabled={jsonEnabled} />
                {:else}
                  {#if jsonEnabled}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {formatJsonField(provider.service_zone) || '-'}
                    </div>
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 text-sm">
                      {formatServiceZone(provider.service_zone) || '-'}
                    </div>
                  {/if}
                {/if}
              </div>
            </div>

            <div class="mt-8 pt-6 border-t border-slate-200 flex gap-3 justify-end">
              {#if editMode}
                <Button
                  variant="outline"
                  onclick={() => { editMode = false; editForm = { ...provider }; }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onclick={saveProvider} disabled={saving}>
                  {#if saving}
                    <span class="animate-spin mr-2">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                    Saving…
                  {:else}
                    Save Changes
                  {/if}
                </Button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</PageShell>

<!-- Datalists for suggestive inputs -->
<datalist id="provider-type-options">
  {#each PROVIDER_TYPE_OPTIONS as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</datalist>

<datalist id="routing-type-options">
  {#each ROUTING_TYPE_OPTIONS as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</datalist>

<style>
  :global(.font-mono) {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
</style>
