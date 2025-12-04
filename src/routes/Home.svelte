<script>
  import { push } from 'svelte-spa-router';
  import { fade, fly } from 'svelte/transition';
  import { onMount } from 'svelte';

  let mounted = false;
  
  onMount(() => {
    mounted = true;
  });

  function navigateToMap() {
    push('/map');
  }

  function navigateToChat() {
    push('/chat');
  }

  function navigateToTripHistory() {
    push('/trip-history');
  }

  function navigateToTripRecordsCsv() {
    push('/trip-records-csv');
  }

  const apiLinks = [
    {
      title: 'Provider Map',
      description: 'Interactive map of service providers',
      url: 'https://api-providers.optimat.us/providers/map',
      icon: '🗺️'
    },
    {
      title: 'Provider API Docs',
      description: 'Provider matching API documentation',
      url: 'https://api-providers.optimat.us/docs',
      icon: '📚'
    },
    {
      title: 'Chat Interface',
      description: 'AI-powered transportation assistant',
      url: 'https://api-chat.optimat.us/',
      icon: '💬'
    },
    {
      title: 'Chat API Docs',
      description: 'Chat API documentation',
      url: 'https://api-chat.optimat.us/docs',
      icon: '📖'
    },
    {
      title: 'Admin Logs',
      description: 'Chat conversation logs',
      url: 'https://api-chat.optimat.us/admin/logs',
      icon: '📊'
    }
  ];
</script>

<main class="h-screen w-screen overflow-hidden relative">
  <!-- Background Image -->
  <div 
    class="absolute inset-0 bg-cover bg-center bg-no-repeat"
    style="background-image: url('https://its.berkeley.edu/sites/default/files/styles/openberkeley_image_full/public/general/15548045457_dcb7955f22_o.jpg')"
  ></div>
  
  <!-- Gradient Overlay -->
  <div class="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-indigo-100/80"></div>
  
  <!-- Content -->
  <div class="relative z-10 h-full w-full flex items-center justify-center p-6 md:p-8">
    <div class="w-full max-w-6xl">
    {#if mounted}
      <!-- Hero Section -->
      <div class="text-center mb-8 md:mb-10" in:fade={{ duration: 800, delay: 200 }}>
        <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-4" in:fly={{ y: -50, duration: 1000, delay: 400 }}>
          Welcome to <span class="text-indigo-600">OPTIMAT</span>
        </h1>
        <p class="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto" in:fly={{ y: 30, duration: 800, delay: 600 }}>
          Your comprehensive service for finding paratransit providers. Connect with transportation options 
          that meet your accessibility needs through our intelligent matching system.
        </p>
      </div>

      <!-- Main Action Cards -->
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8" in:fly={{ y: 50, duration: 800, delay: 800 }}>
        <!-- Map Option -->
        <div class="group cursor-pointer" role="button" tabindex="0" on:click={navigateToMap} on:keypress={navigateToMap}>
          <div class="bg-white rounded-xl shadow-lg p-6 md:p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100">
            <div class="text-center">
              <div class="text-4xl md:text-5xl mb-4 transform transition-transform duration-300 group-hover:scale-110">🗺️</div>
              <h3 class="text-lg md:text-xl font-bold text-gray-900 mb-3">Interactive Map</h3>
              <p class="text-sm text-gray-600 mb-6">
                Use our interactive map to visually explore transportation providers and their service areas. Search by location and see real-time results.
              </p>
              <div class="bg-indigo-600 text-white px-6 py-3 rounded-lg text-sm font-semibold transform transition-all duration-300 group-hover:bg-indigo-700 inline-block">
                Open Map Interface
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Option -->
        <div class="group cursor-pointer" role="button" tabindex="0" on:click={navigateToChat} on:keypress={navigateToChat}>
          <div class="bg-white rounded-xl shadow-lg p-6 md:p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100">
            <div class="text-center">
              <div class="text-4xl md:text-5xl mb-4 transform transition-transform duration-300 group-hover:scale-110">💬</div>
              <h3 class="text-lg md:text-xl font-bold text-gray-900 mb-3">AI Chat Assistant</h3>
              <p class="text-sm text-gray-600 mb-6">
                Get personalized transportation recommendations from our AI assistant. Includes interactive demo examples to explore different scenarios.
              </p>
              <div class="bg-green-600 text-white px-6 py-3 rounded-lg text-sm font-semibold transform transition-all duration-300 group-hover:bg-green-700 inline-block">
                Start Conversation
              </div>
            </div>
          </div>
        </div>

        <!-- Trip History Option -->
        <div class="group cursor-pointer" role="button" tabindex="0" on:click={navigateToTripHistory} on:keypress={navigateToTripHistory}>
          <div class="bg-white rounded-xl shadow-lg p-6 md:p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100">
            <div class="text-center">
              <div class="text-4xl md:text-5xl mb-4 transform transition-transform duration-300 group-hover:scale-110">🧭</div>
              <h3 class="text-lg md:text-xl font-bold text-gray-900 mb-3">Trip History</h3>
              <p class="text-sm text-gray-600 mb-6">
                Visualize historic Tri Delta Transit trips to understand service patterns across the region.
              </p>
              <div class="bg-orange-500 text-white px-6 py-3 rounded-lg text-sm font-semibold transform transition-all duration-300 group-hover:bg-orange-600 inline-block">
                Explore Trips
              </div>
            </div>
          </div>
        </div>

        <!-- CSV Trip Pairs Option -->
        <div class="group cursor-pointer" role="button" tabindex="0" on:click={navigateToTripRecordsCsv} on:keypress={navigateToTripRecordsCsv}>
          <div class="bg-white rounded-xl shadow-lg p-6 md:p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100">
            <div class="text-center">
              <div class="text-4xl md:text-5xl mb-4 transform transition-transform duration-300 group-hover:scale-110">📑</div>
              <h3 class="text-lg md:text-xl font-bold text-gray-900 mb-3">CSV Trip Records</h3>
              <p class="text-sm text-gray-600 mb-6">
                Explore uploaded paired trip records with return gaps, hotspots, and time-of-day insights.
              </p>
              <div class="bg-sky-600 text-white px-6 py-3 rounded-lg text-sm font-semibold transform transition-all duration-300 group-hover:bg-sky-700 inline-block">
                View CSV Pairs
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Documentation Links -->
      <div class="bg-white rounded-lg shadow-md p-4 md:p-5 border border-gray-100 mt-6 md:mt-8" in:fly={{ y: 50, duration: 800, delay: 1000 }}>
        <h2 class="text-sm md:text-base font-bold text-gray-900 mb-3 text-center">API Documentation & Tools</h2>
        <div class="grid grid-cols-5 gap-2">
          {#each apiLinks as link, index}
            <a 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="group block p-2 rounded border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all duration-300"
              in:fly={{ y: 30, duration: 600, delay: 1200 + (index * 100) }}
            >
              <div class="text-center">
                <div class="text-base md:text-lg mb-1 transform transition-transform duration-300 group-hover:scale-110">{link.icon}</div>
                <h3 class="font-semibold text-gray-900 text-[9px] md:text-[10px]">{link.title}</h3>
              </div>
            </a>
          {/each}
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center mt-6 md:mt-8" in:fade={{ duration: 600, delay: 1400 }}>
        <p class="text-[10px] md:text-xs text-gray-500">
          Built for accessible transportation • Open source • Community driven
        </p>
      </div>
    {/if}
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  .group:focus {
    outline: none;
  }
  
  .group:focus > div {
    box-shadow: 0 0 0 2px #4f46e5;
  }
</style>
