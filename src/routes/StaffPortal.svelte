<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { PROVIDERS_API_BASE } from '../config';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';

  let mounted = false;
  let email = '';
  let lookupLoading = false;
  let lookupError = null;
  let provider = null;
  let editMode = false;
  let saving = false;
  let saveError = null;
  let saveSuccess = false;

  // Editable form data
  let editForm = {};

  onMount(() => {
    mounted = true;
  });

  async function lookupProvider() {
    if (!email.trim()) {
      lookupError = 'Please enter an email address';
      return;
    }

    lookupLoading = true;
    lookupError = null;
    provider = null;

    try {
      const response = await fetch(`${PROVIDERS_API_BASE}/providers`);
      if (!response.ok) {
        throw new Error(`Failed to load providers: ${response.status}`);
      }
      const result = await response.json();
      const providers = result.data || result;

      // Search for provider with matching email in contacts
      const emailLower = email.trim().toLowerCase();
      const foundProvider = providers.find(p => {
        // Check the email field (extracted from contacts)
        if (p.email && p.email.toLowerCase() === emailLower) {
          return true;
        }
        // Also check inside contacts JSON
        if (p.contacts) {
          try {
            const contacts = typeof p.contacts === 'string' ? JSON.parse(p.contacts) : p.contacts;
            // contacts might be an object with email field
            if (contacts.email && contacts.email.toLowerCase() === emailLower) {
              return true;
            }
            // or an array of contacts
            if (Array.isArray(contacts)) {
              return contacts.some(c =>
                (c.email && c.email.toLowerCase() === emailLower) ||
                (c.value && c.type?.toLowerCase() === 'email' && c.value.toLowerCase() === emailLower)
              );
            }
          } catch {
            // ignore parse errors
          }
        }
        return false;
      });

      if (foundProvider) {
        provider = foundProvider;
        editForm = { ...foundProvider };
        editMode = true; // Automatically enter edit mode
      } else {
        lookupError = 'No provider found with this email address. Please contact support if you believe this is an error.';
      }
    } catch (err) {
      lookupError = err.message;
    } finally {
      lookupLoading = false;
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      lookupProvider();
    }
  }

  async function saveProvider() {
    if (!provider) return;

    saving = true;
    saveError = null;
    saveSuccess = false;

    try {
      const providerId = provider.provider_id || provider.id;

      // Only send updatable fields to the API
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
      };

      // Remove null/undefined values
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] === null || updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      });

      const response = await fetch(`${PROVIDERS_API_BASE}/providers/${providerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to save provider' }));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const updatedProvider = await response.json();

      provider = updatedProvider;
      editForm = { ...updatedProvider };
      saveSuccess = true;

      // Clear success message after 3 seconds
      setTimeout(() => {
        saveSuccess = false;
      }, 3000);

    } catch (err) {
      saveError = err.message;
    } finally {
      saving = false;
    }
  }

  function logout() {
    provider = null;
    editForm = {};
    email = '';
    lookupError = null;
    saveError = null;
    saveSuccess = false;
    editMode = false;
  }

  function formatJsonField(value) {
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

  function enableEditMode() {
    editMode = true;
    // Copy provider data, converting object fields to JSON strings for editing
    editForm = { ...provider };

    // Convert service_zone object to formatted JSON string for textarea editing
    if (editForm.service_zone && typeof editForm.service_zone === 'object') {
      editForm.service_zone = JSON.stringify(editForm.service_zone, null, 2);
    }

    saveSuccess = false;
    saveError = null;
  }
</script>

{#if mounted}
  <div class="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
    {#if !provider}
      <!-- Email Lookup Form -->
      <div class="flex items-center justify-center min-h-screen p-4" in:fade={{ duration: 300 }}>
        <div class="w-full max-w-md">
          <div class="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            <!-- Logo/Header -->
            <div class="text-center mb-8">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-slate-900">Provider Portal</h1>
              <p class="text-slate-600 mt-2">Enter your email address to access your provider information</p>
            </div>

            <!-- Email Input -->
            <div class="space-y-4">
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <Input
                  type="email"
                  bind:value={email}
                  placeholder="your@email.com"
                  class="w-full"
                  onkeydown={handleKeydown}
                  disabled={lookupLoading}
                />
              </div>

              {#if lookupError}
                <div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" transition:fade>
                  {lookupError}
                </div>
              {/if}

              <Button
                class="w-full"
                onclick={lookupProvider}
                disabled={lookupLoading || !email.trim()}
              >
                {#if lookupLoading}
                  <span class="animate-spin mr-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                  Looking up...
                {:else}
                  Access Provider Portal
                {/if}
              </Button>
            </div>

            <!-- Help Text -->
            <p class="text-center text-xs text-slate-500 mt-6">
              If you're having trouble accessing your account, please contact OPTIMAT support.
            </p>
          </div>
        </div>
      </div>
    {:else}
      <!-- Provider Editor View -->
      <div class="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8" in:fly={{ y: 20, duration: 300 }}>
        <!-- Header -->
        <div class="bg-white rounded-xl shadow-lg border border-slate-200 mb-6">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h1 class="text-xl font-bold text-slate-900">{provider.provider_name}</h1>
              <p class="text-sm text-slate-600">Provider ID: {provider.provider_id || provider.id}</p>
            </div>
            <Button variant="outline" size="sm" onclick={logout}>
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </Button>
          </div>

          <!-- Success/Error Messages -->
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

          <!-- Provider Information Form -->
          <div class="p-6">
            <div class="grid gap-6">
              <!-- Provider Name -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Provider Name</label>
                {#if editMode}
                  <Input
                    bind:value={editForm.provider_name}
                    placeholder="Provider name"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.provider_name || '-'}</div>
                {/if}
              </div>

              <!-- Two Column Layout -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Provider Type -->
                <div>
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="block text-sm font-medium text-slate-700 mb-2">Provider Type</label>
                  {#if editMode}
                    <Input
                      bind:value={editForm.provider_type}
                      placeholder="e.g., ADA paratransit, fixed-route"
                    />
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.provider_type || '-'}</div>
                  {/if}
                </div>

                <!-- Routing Type -->
                <div>
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="block text-sm font-medium text-slate-700 mb-2">Routing Type</label>
                  {#if editMode}
                    <Input
                      bind:value={editForm.routing_type}
                      placeholder="e.g., deviated fixed-route"
                    />
                  {:else}
                    <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2">{provider.routing_type || '-'}</div>
                  {/if}
                </div>
              </div>

              <!-- Schedule Type -->
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

              <!-- Eligibility Requirements -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Eligibility Requirements</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.eligibility_reqs}
                    placeholder="Eligibility requirements (JSON or text)"
                    class="font-mono text-sm"
                    rows="3"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.eligibility_reqs) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Booking -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Booking Information</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.booking}
                    placeholder="Booking information (JSON format)"
                    class="font-mono text-sm"
                    rows="2"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.booking) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Fare -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Fare Information</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.fare}
                    placeholder="Fare information (JSON format)"
                    class="font-mono text-sm"
                    rows="2"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.fare) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Website -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Website</label>
                {#if editMode}
                  <Input
                    bind:value={editForm.website}
                    placeholder="https://example.com"
                  />
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

              <!-- Contacts -->
              <div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="block text-sm font-medium text-slate-700 mb-2">Contact Information</label>
                {#if editMode}
                  <Textarea
                    bind:value={editForm.contacts}
                    placeholder="Contact information (JSON or text)"
                    class="font-mono text-sm"
                    rows="3"
                  />
                {:else}
                  <div class="text-slate-900 bg-slate-50 rounded-md px-3 py-2 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formatJsonField(provider.contacts) || '-'}
                  </div>
                {/if}
              </div>

              <!-- Two Column Layout for Checkboxes -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Round Trip Booking -->
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

                <!-- Investigated -->
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

              <!-- Service Zone -->
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

            <!-- Action Buttons -->
            <div class="mt-8 pt-6 border-t border-slate-200 flex gap-3 justify-end">
              {#if editMode}
                <Button
                  variant="outline"
                  onclick={() => { editMode = false; editForm = { ...provider }; }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onclick={saveProvider}
                  disabled={saving}
                >
                  {#if saving}
                    <span class="animate-spin mr-2">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                    Saving...
                  {:else}
                    Save Changes
                  {/if}
                </Button>
              {:else}
                <Button onclick={enableEditMode}>
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Information
                </Button>
              {/if}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="text-center text-sm text-slate-500">
          <p>If you need assistance, please contact OPTIMAT support.</p>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Custom scrollbar for textareas */
  :global(.font-mono) {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
</style>
