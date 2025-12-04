# OPTIMAT Ping Management System

A centralized system for managing map markers (pings) in the OPTIMAT transportation service platform. This system provides a clean interface for adding, removing, and controlling map focus for different types of location markers.

## Core Features

- **Centralized Management**: All map markers are managed through a single interface
- **Extensible Types**: Support for different ping types (origin, destination, providers, custom)
- **Map Focus Control**: Intelligent map centering and zoom based on ping locations
- **Reactive State**: Svelte stores for reactive UI updates
- **Metadata Support**: Rich metadata support for each ping
- **Batch Operations**: Add/remove multiple pings efficiently

## Quick Start

```javascript
import { pingManager, PingTypes } from '../lib/pingManager.js';

// Add a simple ping
const pingId = pingManager.addPing({
  type: PingTypes.ORIGIN,
  coordinates: [37.7749, -122.4194],
  label: 'Starting Point',
  description: 'San Francisco, CA'
});

// Focus map on all pings
pingManager.focusOnAllPings();

// Remove a ping
pingManager.removePing(pingId);
```

## Architecture

### Core Components

1. **PingManager Class** (`/lib/pingManager.js`)
   - Main interface for ping operations
   - Singleton instance available as `pingManager`

2. **Svelte Stores**
   - `pings`: All pings array
   - `mapFocus`: Map focus state
   - `visiblePings`: Filtered visible pings
   - `pingsByType`: Pings grouped by type

3. **Ping Types**
   - `ORIGIN`: Route starting points
   - `DESTINATION`: Route ending points  
   - `PROVIDER`: Transportation provider locations
   - `SEARCH_RESULT`: Search result locations
   - `CUSTOM`: User-defined locations

### Data Structure

```javascript
{
  id: "uuid-string",              // Unique identifier
  type: "origin",                 // Ping type
  coordinates: [lat, lng],        // Geographic coordinates
  label: "Display Name",          // Marker label
  description: "Details...",      // Popup description
  metadata: { },                  // Additional data
  config: { },                   // Display configuration
  createdAt: 1234567890,         // Timestamp
  visible: true                  // Visibility state
}
```

## API Reference

### PingManager Methods

#### Adding Pings

```javascript
// Add single ping
pingManager.addPing(pingData, focus = true)

// Add multiple pings
pingManager.addPings(pingsArray, focus = true)
```

**Parameters:**
- `pingData`: Object with ping properties
- `focus`: Whether to auto-focus map (default: true)

**Returns:** Ping ID(s)

#### Removing Pings

```javascript
// Remove by ID
pingManager.removePing(pingId)

// Remove by type
pingManager.removePingsByType(PingTypes.CUSTOM)

// Remove all
pingManager.clearAllPings()
```

#### Querying Pings

```javascript
// Get ping by ID
const ping = pingManager.getPing(pingId)

// Get pings by type
const origins = pingManager.getPingsByType(PingTypes.ORIGIN)
```

#### Map Focus Control

```javascript
// Focus on specific ping
pingManager.focusOnPing(pingId, zoom)

// Focus on all visible pings
pingManager.focusOnAllPings()

// Focus on pings of specific type
pingManager.focusOnAllPings(PingTypes.PROVIDER)

// Focus on coordinates
pingManager.focusOnCoordinates([lat, lng], zoom)
```

#### Updating Pings

```javascript
// Update ping properties
pingManager.updatePing(pingId, { 
  label: 'New Label',
  visible: false 
})

// Toggle visibility
pingManager.togglePingVisibility(pingId)
```

### Svelte Store Usage

```svelte
<script>
  import { pings, visiblePings, pingsByType, mapFocus } from '../lib/pingManager.js';
</script>

<!-- Reactive display -->
<p>Total pings: {$pings.length}</p>
<p>Visible pings: {$visiblePings.length}</p>
<p>Origins: {$pingsByType.origin.length}</p>

<!-- Map center from focus state -->
<Map options={{ center: $mapFocus.center, zoom: $mapFocus.zoom }}>
  {#each $visiblePings as ping}
    <Marker latLng={ping.coordinates} popup={ping.label} />
  {/each}
</Map>
```

## Ping Types & Configuration

### Built-in Types

```javascript
export const PingTypes = {
  ORIGIN: 'origin',           // 📍 Green
  DESTINATION: 'destination', // 🎯 Red  
  PROVIDER: 'provider',       // 🚌 Blue
  SEARCH_RESULT: 'search_result', // 📌 Purple
  CUSTOM: 'custom'           // 📍 Gray
};
```

### Default Configurations

Each ping type has default styling:

```javascript
[PingTypes.ORIGIN]: {
  color: '#10B981',    // emerald-500
  icon: '📍',
  zIndex: 1000,
  popup: true,
  draggable: false
}
```

### Custom Configuration

Override defaults when adding pings:

```javascript
pingManager.addPing({
  type: PingTypes.CUSTOM,
  coordinates: [lat, lng],
  label: 'Special Location',
  config: {
    color: '#FF0000',
    icon: '⭐',
    zIndex: 1500,
    draggable: true
  }
});
```

## Integration Examples

### Transportation Form Integration

```javascript
// Handle address geocoding
async function handleOriginUpdate(address) {
  const coordinates = await geocodeAddress(address);
  
  // Remove existing origin
  pingManager.removePingsByType(PingTypes.ORIGIN);
  
  // Add new origin ping
  pingManager.addPing({
    type: PingTypes.ORIGIN,
    coordinates,
    label: 'Origin',
    description: address,
    metadata: { address }
  });
  
  // Auto-focus if destination exists
  const destinations = pingManager.getPingsByType(PingTypes.DESTINATION);
  if (destinations.length > 0) {
    pingManager.focusOnAllPings();
  }
}
```

### Provider Results Integration

```javascript
// Display provider locations
function displayProviders(providers) {
  // Clear existing provider pings
  pingManager.removePingsByType(PingTypes.PROVIDER);
  
  // Add provider pings
  const providerPings = providers
    .filter(p => p.latitude && p.longitude)
    .map(provider => ({
      type: PingTypes.PROVIDER,
      coordinates: [provider.latitude, provider.longitude],
      label: provider.name,
      description: `${provider.name}\nType: ${provider.type}`,
      metadata: { provider }
    }));
  
  pingManager.addPings(providerPings);
  pingManager.focusOnAllPings();
}
```

### Search Results Integration

```javascript
// Add search result markers
function displaySearchResults(results) {
  const searchPings = results.map(result => ({
    type: PingTypes.SEARCH_RESULT,
    coordinates: result.coordinates,
    label: result.name,
    description: result.description,
    metadata: { 
      category: result.category,
      rating: result.rating 
    }
  }));
  
  pingManager.addPings(searchPings, true);
}
```

## Advanced Usage

### Custom Ping Types

Extend the system with custom types:

```javascript
// Define custom type
const CustomTypes = {
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  ATTRACTION: 'attraction'
};

// Add with custom configuration
pingManager.addPing({
  type: CustomTypes.RESTAURANT,
  coordinates: [lat, lng],
  label: 'Great Restaurant',
  config: {
    color: '#FFA500',
    icon: '🍽️',
    zIndex: 950
  }
});
```

### Batch Operations with Filtering

```javascript
// Filter and update multiple pings
const outdatedPings = pingManager.getPingsByType(PingTypes.SEARCH_RESULT)
  .filter(ping => Date.now() - ping.createdAt > 3600000); // 1 hour old

outdatedPings.forEach(ping => {
  pingManager.updatePing(ping.id, { 
    visible: false,
    config: { ...ping.config, opacity: 0.5 }
  });
});
```

### Dynamic Focus Management

```javascript
// Smart focus based on context
function smartFocus() {
  const origins = pingManager.getPingsByType(PingTypes.ORIGIN);
  const destinations = pingManager.getPingsByType(PingTypes.DESTINATION);
  const providers = pingManager.getPingsByType(PingTypes.PROVIDER);
  
  if (providers.length > 0) {
    // Focus on all if providers are shown
    pingManager.focusOnAllPings();
  } else if (origins.length > 0 && destinations.length > 0) {
    // Focus on route
    pingManager.focusOnAllPings();
  } else if (origins.length > 0) {
    // Focus on origin
    pingManager.focusOnPing(origins[0].id);
  }
}
```

## Best Practices

### Performance

1. **Batch Operations**: Use `addPings()` for multiple markers
2. **Selective Updates**: Update specific properties rather than replacing pings
3. **Visibility Management**: Hide rather than remove for temporary states
4. **Focus Control**: Disable auto-focus for batch operations

### State Management

1. **Cleanup**: Remove pings when components unmount
2. **Type Organization**: Use appropriate ping types for clear semantics
3. **Metadata**: Store relevant data in metadata for easy access
4. **Reactive Updates**: Leverage Svelte stores for automatic UI updates

### User Experience

1. **Smart Focusing**: Auto-focus on relevant pings
2. **Visual Hierarchy**: Use z-index and styling to prioritize important pings
3. **Clear Labels**: Provide descriptive labels and popup content
4. **Progressive Disclosure**: Show relevant pings based on user context

## Error Handling

The ping manager includes built-in validation:

```javascript
try {
  pingManager.addPing({
    type: PingTypes.ORIGIN,
    coordinates: [91, 181], // Invalid coordinates
    label: 'Test'
  });
} catch (error) {
  console.error('Invalid coordinates provided');
}
```

Common validation checks:
- Coordinate validity (lat: -90 to 90, lng: -180 to 180)
- Required properties (type, coordinates)
- Array format for coordinates

## Migration Guide

### From Direct Marker Management

**Before:**
```javascript
let originMarker = [lat, lng];
let destinationMarker = [lat, lng];

// Manual map updates
$: mapCenter = calculateCenter(originMarker, destinationMarker);
```

**After:**
```javascript
// Add origin ping
pingManager.addPing({
  type: PingTypes.ORIGIN,
  coordinates: [lat, lng]
});

// Automatic map focusing
pingManager.focusOnAllPings();
```

### From Custom Marker Arrays

**Before:**
```javascript
let markers = [
  { lat, lng, type: 'origin' },
  { lat, lng, type: 'destination' }
];
```

**After:**
```javascript
const pings = markers.map(marker => ({
  type: marker.type === 'origin' ? PingTypes.ORIGIN : PingTypes.DESTINATION,
  coordinates: [marker.lat, marker.lng],
  label: marker.type.charAt(0).toUpperCase() + marker.type.slice(1)
}));

pingManager.addPings(pings);
```

## Troubleshooting

### Common Issues

1. **Pings not appearing**: Check coordinate validity and ping visibility
2. **Map not focusing**: Ensure `shouldFocus` trigger is handled
3. **Store not updating**: Verify store subscriptions in components
4. **Performance issues**: Use batch operations for multiple pings

### Debug Tools

```javascript
// Log all pings
console.log('Current pings:', get(pings));

// Check focus state
console.log('Focus state:', get(mapFocus));

// Ping counts by type
console.log('Ping counts:', get(pingsByType));
```

## Examples

See `/components/PingControls.svelte` for a complete example component demonstrating all ping management features.