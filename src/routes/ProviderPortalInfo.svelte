<script lang="ts">
  import { fade } from 'svelte/transition';
  import { push } from 'svelte-spa-router';
  import PageShell from '$lib/components/PageShell.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { updateProvider } from '$lib/api';
  import providerSession, { clearProvider, setProvider } from '$lib/stores/providerSession';
  import mockDataEnabled from '$lib/stores/mockData';
  import { providerPortalNavItems } from '$lib/providerPortalNav';

  let editMode = false;
  let saving = false;
  let saveError: string | null = null;
  let saveSuccess = false;
  let editForm: Record<string, unknown> = {};

  $: provider = $providerSession.provider;
  $: mockEnabled = $mockDataEnabled;

  $: if (provider && !editMode) {
    editForm = { ...provider };
  }

  function enableEditMode() {
    if (!provider) return;
    editMode = true;
    editForm = { ...provider };

    if (editForm.service_zone && typeof editForm.service_zone === 'object') {
      editForm.service_zone = JSON.stringify(editForm.service_zone, null, 2);
    }

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

      let serviceZoneValue = editForm.service_zone;
      if (serviceZoneValue && typeof serviceZoneValue === 'object') {
        serviceZoneValue = JSON.stringify(serviceZoneValue);
      }

      const updatePayload = {
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
        service_zone: serviceZoneValue,
      } as Record<string, unknown>;

      Object.keys(updatePayload).forEach((key) => {
        if (updatePayload[key] === null || updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      });

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
            {#if !editMode}
              <Button onclick={enableEditMode}>Edit Information</Button>
            {/if}
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
                    <Input bind:value={editForm.provider_type} placeholder="e.g., ADA paratransit" />
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.provider_type || '-'}</div>
                  {/if}
                </div>

                <div>
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="block text-sm font-medium text-slate-700 mb-2">Routing Type</label>
                  {#if editMode}
                    <Input bind:value={editForm.routing_type} placeholder="e.g., deviated fixed-route" />
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.routing_type || '-'}</div>
                  {/if}
                </div>
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Schedule Type</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.schedule_type}
                    placeholder="Schedule type (JSON format)"
                    class="font-mono text-sm"
                    rows="2"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.schedule_type) || '-'}
                  </div>
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Eligibility Requirements</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.eligibility_reqs}
                    placeholder="Eligibility requirements"
                    class="font-mono text-sm"
                    rows="3"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.eligibility_reqs) || '-'}
                  </div>
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Booking Information</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.booking}
                    placeholder="Booking information"
                    class="font-mono text-sm"
                    rows="2"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.booking) || '-'}
                  </div>
                {/if}
              </div>

              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Fare Information</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.fare}
                    placeholder="Fare information"
                    class="font-mono text-sm"
                    rows="2"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.fare) || '-'}
                  </div>
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
                  <Textarea
                    bind:value={editForm.contacts}
                    placeholder="Contact information"
                    class="font-mono text-sm"
                    rows="3"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.contacts) || '-'}
                  </div>
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
                  <Textarea
                    bind:value={editForm.service_zone}
                    placeholder="Service zone GeoJSON (FeatureCollection format)"
                    class="font-mono text-sm"
                    rows="6"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {formatJsonField(provider.service_zone) || '-'}
                  </div>
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

<style>
  :global(.font-mono) {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
</style>
