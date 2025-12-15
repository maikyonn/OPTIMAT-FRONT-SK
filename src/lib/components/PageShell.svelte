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

  const navItems = [
    { label: 'Map', href: '/map', icon: '🗺️' },
    { label: 'Chat', href: '/chat', icon: '💬' },
    { label: 'Providers', href: '/providers-info', icon: '🏢' },
    { label: 'Trip Pairs', href: '/trip-pairs', icon: '📊' },
    { label: 'Beta Signup', href: '/beta-signup', icon: '✨' }
  ];

  let currentPath = '/';

  onMount(() => {
    currentPath = window.location.hash.replace('#', '') || '/';
    // Listen for hash changes
    const handleHashChange = () => {
      currentPath = window.location.hash.replace('#', '') || '/';
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });

  function navigate(href: string) {
    push(href);
    currentPath = href;
  }
</script>

<div class="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
  <!-- Compact header bar - desktop app style -->
  <header class="flex-shrink-0 h-10 border-b border-border/60 bg-card flex items-center px-2 gap-1">
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
      {#each navItems as item}
        <button
          class={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition
            ${currentPath === item.href
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
          on:click={() => navigate(item.href)}
        >
          <span class="text-[10px]">{item.icon}</span>
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
