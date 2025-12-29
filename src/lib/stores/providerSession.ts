import { writable } from 'svelte/store';
import type { Provider } from '$lib/api';

type ProviderSession = {
  provider: Provider | null;
};

const providerSession = writable<ProviderSession>({ provider: null });

export function setProvider(provider: Provider) {
  providerSession.set({ provider });
}

export function clearProvider() {
  providerSession.set({ provider: null });
}

export default providerSession;
