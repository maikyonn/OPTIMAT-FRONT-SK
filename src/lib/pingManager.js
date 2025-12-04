/**
 * Ping Management System for OPTIMAT Map
 * Provides centralized management for map markers/pings with extensible types
 */

import { writable, derived, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

// Ping type definitions
export const PingTypes = {
  ORIGIN: 'origin',
  DESTINATION: 'destination', 
  PROVIDER: 'provider',
  SEARCH_RESULT: 'search_result',
  CUSTOM: 'custom'
};

// Default ping configurations
export const PingConfigs = {
  [PingTypes.ORIGIN]: {
    color: '#10B981', // emerald-500
    icon: '📍',
    zIndex: 1000,
    popup: true,
    draggable: false
  },
  [PingTypes.DESTINATION]: {
    color: '#EF4444', // red-500
    icon: '🎯',
    zIndex: 1000,
    popup: true,
    draggable: false
  },
  [PingTypes.PROVIDER]: {
    color: '#3B82F6', // blue-500
    icon: '🚌',
    zIndex: 900,
    popup: true,
    draggable: false
  },
  [PingTypes.SEARCH_RESULT]: {
    color: '#8B5CF6', // violet-500
    icon: '📌',
    zIndex: 800,
    popup: true,
    draggable: false
  },
  [PingTypes.CUSTOM]: {
    color: '#6B7280', // gray-500
    icon: '📍',
    zIndex: 700,
    popup: true,
    draggable: false
  }
};

/**
 * Ping data structure
 * @typedef {Object} Ping
 * @property {string} id - Unique identifier
 * @property {string} type - Ping type from PingTypes
 * @property {Array<number>} coordinates - [latitude, longitude]
 * @property {string} [label] - Display label
 * @property {string} [description] - Popup description
 * @property {Object} [metadata] - Additional data
 * @property {Object} [config] - Override default config
 * @property {number} createdAt - Timestamp
 * @property {boolean} visible - Visibility state
 */

// Core ping store
const pingStore = writable([]);

// Map focus state
const mapFocusStore = writable({
  center: [37.7749, -122.4194], // Default San Francisco
  zoom: 12,
  shouldFocus: false,
  focusId: null
});

/**
 * PingManager - Main interface for ping management
 */
export class PingManager {
  constructor() {
    this.store = pingStore;
    this.focusStore = mapFocusStore;
  }

  /**
   * Add a new ping to the map
   * @param {Object} pingData - Ping data
   * @param {string} pingData.type - Ping type
   * @param {Array<number>} pingData.coordinates - [lat, lng]
   * @param {string} [pingData.label] - Display label
   * @param {string} [pingData.description] - Popup description
   * @param {Object} [pingData.metadata] - Additional data
   * @param {Object} [pingData.config] - Override config
   * @param {boolean} [focus=true] - Whether to focus map on this ping
   * @returns {string} - Ping ID
   */
  addPing(pingData, focus = true) {
    const ping = {
      id: uuidv4(),
      type: pingData.type || PingTypes.CUSTOM,
      coordinates: pingData.coordinates,
      label: pingData.label || `${pingData.type} ping`,
      description: pingData.description || '',
      metadata: pingData.metadata || {},
      config: { ...PingConfigs[pingData.type || PingTypes.CUSTOM], ...pingData.config },
      createdAt: Date.now(),
      visible: true
    };

    // Validate coordinates
    if (!this._isValidCoordinates(ping.coordinates)) {
      throw new Error('Invalid coordinates provided');
    }

    // Add to store
    this.store.update(pings => [...pings, ping]);

    // Focus map if requested
    if (focus) {
      this.focusOnPing(ping.id);
    }

    return ping.id;
  }

  /**
   * Remove a ping by ID
   * @param {string} pingId - Ping ID to remove
   * @returns {boolean} - Success status
   */
  removePing(pingId) {
    let removed = false;
    this.store.update(pings => {
      const filtered = pings.filter(p => p.id !== pingId);
      removed = filtered.length !== pings.length;
      return filtered;
    });
    return removed;
  }

  /**
   * Remove all pings of a specific type
   * @param {string} type - Ping type to remove
   * @returns {number} - Number of pings removed
   */
  removePingsByType(type) {
    let removedCount = 0;
    this.store.update(pings => {
      const filtered = pings.filter(p => {
        if (p.type === type) {
          removedCount++;
          return false;
        }
        return true;
      });
      return filtered;
    });
    return removedCount;
  }

  /**
   * Clear all pings
   */
  clearAllPings() {
    this.store.set([]);
  }

  /**
   * Update an existing ping
   * @param {string} pingId - Ping ID
   * @param {Object} updates - Fields to update
   * @returns {boolean} - Success status
   */
  updatePing(pingId, updates) {
    let updated = false;
    this.store.update(pings => {
      return pings.map(ping => {
        if (ping.id === pingId) {
          updated = true;
          return { ...ping, ...updates };
        }
        return ping;
      });
    });
    return updated;
  }

  /**
   * Get a ping by ID
   * @param {string} pingId - Ping ID
   * @returns {Ping|null} - Ping object or null
   */
  getPing(pingId) {
    const pings = get(this.store);
    return pings.find(p => p.id === pingId) || null;
  }

  /**
   * Get all pings of a specific type
   * @param {string} type - Ping type
   * @returns {Array<Ping>} - Array of pings
   */
  getPingsByType(type) {
    const pings = get(this.store);
    return pings.filter(p => p.type === type);
  }

  /**
   * Toggle ping visibility
   * @param {string} pingId - Ping ID
   * @returns {boolean} - New visibility state
   */
  togglePingVisibility(pingId) {
    let newVisibility = false;
    this.store.update(pings => {
      return pings.map(ping => {
        if (ping.id === pingId) {
          newVisibility = !ping.visible;
          return { ...ping, visible: newVisibility };
        }
        return ping;
      });
    });
    return newVisibility;
  }

  /**
   * Focus map on a specific ping
   * @param {string} pingId - Ping ID
   * @param {number} [zoom] - Optional zoom level
   */
  focusOnPing(pingId, zoom = null) {
    const ping = this.getPing(pingId);
    if (!ping) return;

    this.focusStore.set({
      center: ping.coordinates,
      zoom: zoom || this._calculateZoomForSinglePoint(),
      shouldFocus: true,
      focusId: pingId
    });
  }

  /**
   * Focus map to fit all visible pings
   * @param {string} [type] - Optional: only fit pings of this type
   */
  focusOnAllPings(type = null) {
    const pings = get(this.store).filter(p => 
      p.visible && (type === null || p.type === type)
    );

    if (pings.length === 0) return;

    if (pings.length === 1) {
      this.focusOnPing(pings[0].id);
      return;
    }

    // Calculate bounds for multiple pings
    const bounds = this._calculateBounds(pings.map(p => p.coordinates));
    const center = this._calculateCenter(bounds);
    const zoom = this._calculateZoomForBounds(bounds);

    this.focusStore.set({
      center,
      zoom,
      shouldFocus: true,
      focusId: null
    });
  }

  /**
   * Focus map on specific coordinates
   * @param {Array<number>} coordinates - [lat, lng]
   * @param {number} [zoom=15] - Zoom level
   */
  focusOnCoordinates(coordinates, zoom = 15) {
    if (!this._isValidCoordinates(coordinates)) return;

    this.focusStore.set({
      center: coordinates,
      zoom,
      shouldFocus: true,
      focusId: null
    });
  }

  /**
   * Reset map focus trigger
   */
  resetFocus() {
    this.focusStore.update(focus => ({ ...focus, shouldFocus: false, focusId: null }));
  }

  /**
   * Batch add multiple pings
   * @param {Array<Object>} pingsData - Array of ping data
   * @param {boolean} [focus=true] - Whether to focus on all added pings
   * @returns {Array<string>} - Array of ping IDs
   */
  addPings(pingsData, focus = true) {
    const pingIds = [];
    
    this.store.update(pings => {
      const newPings = pingsData.map(pingData => {
        const ping = {
          id: uuidv4(),
          type: pingData.type || PingTypes.CUSTOM,
          coordinates: pingData.coordinates,
          label: pingData.label || `${pingData.type} ping`,
          description: pingData.description || '',
          metadata: pingData.metadata || {},
          config: { ...PingConfigs[pingData.type || PingTypes.CUSTOM], ...pingData.config },
          createdAt: Date.now(),
          visible: true
        };
        
        if (!this._isValidCoordinates(ping.coordinates)) {
          throw new Error(`Invalid coordinates provided for ping: ${JSON.stringify(pingData)}`);
        }
        
        pingIds.push(ping.id);
        return ping;
      });
      
      return [...pings, ...newPings];
    });

    if (focus && pingIds.length > 0) {
      this.focusOnAllPings();
    }

    return pingIds;
  }

  // Private helper methods
  _isValidCoordinates(coords) {
    return Array.isArray(coords) && 
           coords.length === 2 && 
           typeof coords[0] === 'number' && 
           typeof coords[1] === 'number' &&
           coords[0] >= -90 && coords[0] <= 90 &&
           coords[1] >= -180 && coords[1] <= 180;
  }

  _calculateBounds(coordinates) {
    const lats = coordinates.map(c => c[0]);
    const lngs = coordinates.map(c => c[1]);
    
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  }

  _calculateCenter(bounds) {
    return [
      (bounds.north + bounds.south) / 2,
      (bounds.east + bounds.west) / 2
    ];
  }

  _calculateZoomForBounds(bounds) {
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    const maxDiff = Math.max(latDiff, lngDiff);

    if (maxDiff > 10) return 8;
    if (maxDiff > 5) return 9;
    if (maxDiff > 2) return 10;
    if (maxDiff > 1) return 11;
    if (maxDiff > 0.5) return 12;
    if (maxDiff > 0.2) return 13;
    if (maxDiff > 0.1) return 14;
    return 15;
  }

  _calculateZoomForSinglePoint() {
    return 15;
  }
}

// Create singleton instance
export const pingManager = new PingManager();

// Export stores for component consumption
export const pings = pingManager.store;
export const mapFocus = pingManager.focusStore;

// Derived stores for convenience
export const visiblePings = derived(pings, $pings => 
  $pings.filter(ping => ping.visible)
);

export const pingsByType = derived(pings, $pings => {
  const grouped = {};
  for (const type of Object.values(PingTypes)) {
    grouped[type] = $pings.filter(p => p.type === type);
  }
  return grouped;
});

export const pingCount = derived(pings, $pings => $pings.length);
export const visiblePingCount = derived(visiblePings, $pings => $pings.length);