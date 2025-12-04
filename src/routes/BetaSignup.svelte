<script>
  import { push } from 'svelte-spa-router';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let name = '';
  let phoneNumber = '';
  let submitted = false;
  let error = '';
  
  function validatePhoneNumber(phone) {
    // Basic validation for phone number
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
      error = 'Please enter a valid phone number';
      return;
    }
    
    // TODO: Add API call to save beta tester info
    submitted = true;
  }
  
  function handleBack() {
    push('/');
  }
</script>

<main class="min-h-screen bg-gray-100 p-8 flex justify-center">
  <div class="w-full max-w-md">
    <div class="bg-white shadow-lg rounded-3xl p-8">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-900">SMS Beta Test Signup</h1>
        <button
          class="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          on:click={handleBack}
        >
          Back to Home
        </button>
      </div>
      
      {#if submitted}
        <div class="text-center py-8">
          <svg class="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <h2 class="text-2xl font-semibold text-gray-800 mb-2">Thank You!</h2>
          <p class="text-gray-600 mb-6">You've successfully signed up for our SMS messaging service beta test.</p>
          <p class="text-gray-600">We'll contact you soon with further instructions.</p>
          <button
            class="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            on:click={handleBack}
          >
            Return to Home
          </button>
        </div>
      {:else}
        <p class="mb-6 text-gray-600">
          Sign up to be among the first to test our new SMS messaging service! Enter your details below.
        </p>
        
        <form on:submit|preventDefault={handleSubmit} class="space-y-6">
          {#if error}
            <div class="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          {/if}
          
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              id="name"
              bind:value={name}
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your full name"
            />
          </div>
          
          <div>
            <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              id="phone"
              bind:value={phoneNumber}
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your phone number"
            />
            <p class="text-xs text-gray-500 mt-1">Format: +1XXXXXXXXXX (include country code)</p>
          </div>
          
          <button
            type="submit"
            class="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign Up for Beta
          </button>
        </form>
      {/if}
    </div>
  </div>
</main> 