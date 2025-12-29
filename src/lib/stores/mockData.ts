import { writable } from 'svelte/store';

const mockDataEnabled = writable(false);

export function setMockDataEnabled(enabled: boolean) {
  mockDataEnabled.set(enabled);
}

export default mockDataEnabled;
