<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { createEventDispatcher } from 'svelte';
  import PageShell from '$lib/components/PageShell.svelte';
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';

  const dispatch = createEventDispatcher();
  
  let name = '';
  let phoneNumber = '';
  let submitted = false;
  let error = '';
  
  function validatePhoneNumber(phone: string) {
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    return phoneRegex.test(phone);
  }
  
  function handleSubmit() {
    error = '';
    
    if (!name.trim()) {
      error = 'Name is required';
      return;
    }
    
    if (!phoneNumber.trim()) {
      error = 'Phone number is required';
      return;
    }
    
    if (!validatePhoneNumber(phoneNumber)) {
      error = 'Please enter a valid phone number with country code';
      return;
    }
    
    // TODO: hook into backend
    submitted = true;
  }
</script>

<PageShell
  title="SMS Beta Signup"
  description="Sign up to test our upcoming SMS messaging service. We keep the flow consistent with the rest of OPTIMAT."
  backHref="/"
>
  <div class="max-w-xl">
    <Card class="shadow-sm border-border/70">
      <CardHeader>
        <CardTitle>Join the beta</CardTitle>
        <CardDescription>We will reach out with details once slots open up.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        {#if submitted}
          <div class="flex flex-col items-start gap-2 text-sm text-foreground">
            <div class="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold">Thanks!</div>
            <p>You're on the list. We'll text you soon.</p>
            <button class="text-sm text-primary underline" type="button" on:click={() => push('/')}>Return home</button>
          </div>
        {:else}
          {#if error}
            <div class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          {/if}
          <div class="space-y-2">
            <label for="name" class="text-sm font-medium text-foreground">Full name</label>
            <Input id="name" bind:value={name} placeholder="Alex Doe" />
          </div>
          <div class="space-y-2">
            <label for="phone" class="text-sm font-medium text-foreground">Phone number</label>
            <Input id="phone" type="tel" bind:value={phoneNumber} placeholder="+14155550123" />
            <p class="text-xs text-muted-foreground">Include country code so we can message you.</p>
          </div>
        {/if}
      </CardContent>
      {#if !submitted}
        <CardFooter class="flex justify-end">
          <button class="w-full inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm hover:opacity-90 transition" on:click={() => handleSubmit()}>Sign up</button>
        </CardFooter>
      {/if}
    </Card>
  </div>
</PageShell>
