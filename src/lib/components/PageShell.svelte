<script lang="ts">
  // @ts-nocheck
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';

  export let title = '';
  export let description: string | null = null;
  export let backHref: string | null = null;
  export let fullWidth = false;
  export let appMode = false; // Desktop app mode - edge-to-edge, no margins

	  const defaultNavItems = [
	    { label: 'Providers', href: '/providers-info', icon: '🏢' },
	    { label: 'Provider Portal', href: '/provider-portal', icon: '👤' },
	    { label: 'Architecture', href: '/architecture', icon: '🏗️' },
	    { label: 'API Docs', href: '/api-docs', icon: 'API' },
	    { label: 'Beta Signup', href: '/beta-signup', icon: '✨' }
	  ];

	  const findTripOptions = [
	    { label: 'Chat', href: '/chat' },
	    { label: 'Map', href: '/map' }
	  ];
	  const serviceDashboardOptions = [
	    { label: 'Service Dashboard', href: '/trip-pairs' },
	    { label: 'Universal Service Dashboard', href: '/universal-service-dashboard' }
	  ];

	  export let navItems = defaultNavItems;

	  let currentPath = '/';
	  let findTripOpen = false;
	  let findTripValue = '/chat';
	  let findTripMenuRef;
	  let serviceDashOpen = false;
	  let serviceDashValue = '/trip-pairs';
	  let serviceDashMenuRef;
	  $: findTripLabel = findTripValue === '/map' ? 'Map' : 'Chat';
	  $: serviceDashLabel = serviceDashValue === '/universal-service-dashboard'
	    ? 'Universal Service Dashboard'
	    : 'Service Dashboard';
	  $: showFindTrip = !(currentPath.startsWith('/provider-portal') || currentPath === '/staff');

	  onMount(() => {
	    currentPath = window.location.hash.replace('#', '') || '/';
	    findTripValue = currentPath === '/map' ? '/map' : '/chat';
	    serviceDashValue = currentPath === '/universal-service-dashboard' ? '/universal-service-dashboard' : '/trip-pairs';
	    // Listen for hash changes
	    const handleHashChange = () => {
	      currentPath = window.location.hash.replace('#', '') || '/';
	      findTripValue = currentPath === '/map' ? '/map' : '/chat';
	      serviceDashValue = currentPath === '/universal-service-dashboard' ? '/universal-service-dashboard' : '/trip-pairs';
	    };
	    window.addEventListener('hashchange', handleHashChange);
	    const handleWindowClick = (event) => {
	      if (findTripOpen && findTripMenuRef && !findTripMenuRef.contains(event.target)) {
	        findTripOpen = false;
	      }
	      if (serviceDashOpen && serviceDashMenuRef && !serviceDashMenuRef.contains(event.target)) {
	        serviceDashOpen = false;
	      }
	    };
	    window.addEventListener('click', handleWindowClick);
	    return () => {
	      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('click', handleWindowClick);
    };
  });

	  function navigate(href: string) {
	    push(href);
	    currentPath = href;
	    findTripValue = href === '/map' ? '/map' : '/chat';
	    findTripOpen = false;
	    serviceDashValue = href === '/universal-service-dashboard' ? '/universal-service-dashboard' : '/trip-pairs';
	    serviceDashOpen = false;
	  }

	  function toggleFindTripMenu() {
	    findTripOpen = !findTripOpen;
	    if (findTripOpen) serviceDashOpen = false;
	  }

	  function handleFindTripSelect(href: string) {
	    navigate(href);
	  }

	  function toggleServiceDashMenu() {
	    serviceDashOpen = !serviceDashOpen;
	    if (serviceDashOpen) findTripOpen = false;
	  }

	  function handleServiceDashSelect(href: string) {
	    navigate(href);
	  }
</script>

<div class="h-screen w-screen bg-background text-foreground flex flex-col">
  <!-- Compact header bar - desktop app style -->
  <header class="relative z-[1200] flex-shrink-0 h-10 border-b border-border/60 bg-card flex items-center px-2 gap-1">
    <!-- Logo/brand -->
    <button
      class="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted transition text-sm font-semibold"
      on:click={() => navigate('/')}
    >
      <span class="text-primary">◆</span>
      <span>OPTIMAT</span>
    </button>

    <Separator orientation="vertical" class="h-5 mx-1" />

    <!-- Navigation tabs -->
    <nav class="flex items-center gap-0.5">
	      {#if showFindTrip}
	        <div class="relative" bind:this={findTripMenuRef}>
          <button
            class={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition
              ${currentPath === '/chat' || currentPath === '/map'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
            aria-haspopup="menu"
            aria-expanded={findTripOpen}
            on:click|stopPropagation={toggleFindTripMenu}
          >
            <span class="text-[10px] uppercase tracking-wide">Find your Trip</span>
            <span class="text-[10px] text-muted-foreground">•</span>
            <span>{findTripLabel}</span>
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {#if findTripOpen}
            <div class="absolute left-0 top-full z-[1300] mt-1 w-44 rounded-md border border-border/70 bg-card shadow-lg">
              {#each findTripOptions as option}
                <button
                  class={`flex w-full items-center justify-between px-3 py-2 text-xs transition
                    ${findTripValue === option.href ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'}`}
                  on:click={() => handleFindTripSelect(option.href)}
                >
                  <span>{option.label}</span>
                  {#if findTripValue === option.href}
                    <span class="text-[10px] text-muted-foreground">Default</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
	        </div>
	      {/if}

	      <div class="relative" bind:this={serviceDashMenuRef}>
	        <button
	          class={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition
	            ${currentPath === '/trip-pairs' || currentPath === '/trip-records' || currentPath === '/universal-service-dashboard'
	              ? 'bg-primary text-primary-foreground'
	              : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
	          aria-haspopup="menu"
	          aria-expanded={serviceDashOpen}
	          on:click|stopPropagation={toggleServiceDashMenu}
	        >
	          <span class="text-[10px] uppercase tracking-wide">Service Dashboards</span>
	          <span class="text-[10px] text-muted-foreground">•</span>
	          <span>{serviceDashLabel}</span>
	          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
	            <path d="M6 9l6 6 6-6" />
	          </svg>
	        </button>

	        {#if serviceDashOpen}
	          <div class="absolute left-0 top-full z-[1300] mt-1 w-64 rounded-md border border-border/70 bg-card shadow-lg">
	            {#each serviceDashboardOptions as option}
	              <button
	                class={`flex w-full items-center justify-between px-3 py-2 text-xs transition
	                  ${serviceDashValue === option.href ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'}`}
	                on:click={() => handleServiceDashSelect(option.href)}
	              >
	                <span>{option.label}</span>
	                {#if serviceDashValue === option.href}
	                  <span class="text-[10px] text-muted-foreground">Default</span>
	                {/if}
	              </button>
	            {/each}
	          </div>
	        {/if}
	      </div>

	      {#each navItems as item}
	        <button
	          class={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition
	            ${currentPath === item.href
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
          on:click={() => navigate(item.href)}
        >
          {#if item.icon}
            <span class="text-[10px]">{item.icon}</span>
          {/if}
          {item.label}
        </button>
      {/each}
    </nav>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Page title in header (compact) -->
    {#if title && appMode}
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="font-medium text-foreground">{title}</span>
        {#if description}
          <span class="hidden lg:inline">—</span>
          <span class="hidden lg:inline truncate max-w-xs">{description}</span>
        {/if}
      </div>
    {/if}

    <!-- Header actions slot -->
    <div class="flex items-center gap-1">
      <slot name="header-actions" />
    </div>
  </header>

  <!-- Main content area - full viewport -->
  {#if appMode}
    <!-- App mode: edge-to-edge, content fills remaining viewport -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <slot />
    </main>
  {:else}
    <!-- Standard mode with optional title section -->
    {#if title}
      <div class="flex-shrink-0 border-b border-border/40 bg-muted/30 px-4 py-3">
        <div class={`${fullWidth ? '' : 'mx-auto max-w-7xl'}`}>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-3">
              {#if backHref}
                <button
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  aria-label="Go back"
                  on:click={() => navigate(backHref)}
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 18l-6-6 6-6"></path>
                  </svg>
                </button>
              {/if}
              <div>
                <h1 class="text-base font-semibold leading-tight">{title}</h1>
                {#if description}
                  <p class="text-xs text-muted-foreground">{description}</p>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <slot name="meta" />
            </div>
          </div>
        </div>
      </div>
    {/if}

    <main class={`flex-1 overflow-auto ${fullWidth ? '' : 'mx-auto max-w-7xl w-full'} p-4`}>
      <slot />
    </main>
  {/if}
</div>
