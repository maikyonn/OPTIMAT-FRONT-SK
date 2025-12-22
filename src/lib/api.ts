/**
 * OPTIMAT Frontend API Module
 *
 * This module provides a unified API interface using Supabase Edge Functions.
 * All API calls are routed through Supabase Edge Functions with REST-style routing.
 */

import {
  isSupabaseConfigured,
  fetchEdgeFunction,
  getEdgeFunctionUrl,
  getAuthHeaders,
} from './supabase';

// =============================================================================
// Types
// =============================================================================

export interface GeocodeResult {
  success: boolean;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  formatted_address?: string;
  place_id?: string;
  message?: string;
  error?: string;
}

export interface Provider {
  id?: string;
  provider_id?: string | number;
  provider_name: string;
  provider_type: string;
  provider_org?: string;
  service_zone?: string | object;
  service_hours?: string | object;
  eligibility_reqs?: string | string[] | object;
  booking?: string | object;
  website?: string;
  latitude?: number;
  longitude?: number;
  routing_type?: string;
  schedule_type?: string | object;
  fare?: string | object;
  contacts?: string | object;
  _zone_color?: string;
}

export interface ProviderFilterRequest {
  source_address: string;
  destination_address: string;
  eligibility_type?: string;
  schedule_type?: string;
  provider_type?: string;
}

export interface ProviderFilterResponse {
  data: Provider[];
  source_address?: string;
  destination_address?: string;
  source_coords?: { lat: number; lng: number };
  destination_coords?: { lat: number; lng: number };
  public_transit?: {
    journey_description?: string;
    routes?: unknown[];
  };
}

export interface ConversationMessage {
  id?: string;
  role: 'human' | 'ai' | 'assistant' | 'user' | 'system';
  content: string;
  created_at?: string;
  conversation_id?: string;
}

export interface Conversation {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
  messages?: ConversationMessage[];
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  message_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ChatStreamEvent {
  event: 'tool_start' | 'tool_end' | 'token' | 'message' | 'done' | 'error';
  tool?: string;
  content?: string;
  message?: string;
  attachments?: unknown[];
}

export interface DirectionsRequest {
  origin: string;
  destination: string;
  mode?: 'driving' | 'transit' | 'walking' | 'bicycling';
}

export interface DirectionsResponse {
  success: boolean;
  distance?: { text: string; value: number };
  duration?: { text: string; value: number };
  start_address?: string;
  end_address?: string;
  steps?: DirectionStep[];
  polyline?: string;
  error?: string;
}

export interface DirectionStep {
  instruction: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  travel_mode?: string;
  transit_details?: unknown;
}

export interface TripRecordPair {
  trip_id: number;
  pickup_sequence: number;
  drop_sequence: number;
  pick_time: string;
  drop_time: string;
  pickup_address: string;
  pickup_city: string;
  drop_address: string;
  drop_city: string;
  passengers_on_board: number;
  trip_id_return?: number;
  return_pick_time?: string;
  duration_minutes: number;
  return_gap_minutes?: number;
  route_polyline?: string;
  route_distance_meters?: number;
  route_duration_seconds?: number;
  route_summary?: string;
}

export interface TripRecordStats {
  total_records: number;
  with_return_count: number;
  pct_with_return: number;
  avg_duration_minutes: number;
  median_duration_minutes: number;
  p90_duration_minutes: number;
  avg_return_gap_minutes: number;
  earliest_pick_time: string;
  latest_drop_time: string;
  top_pickup_hotspots: { label: string; city: string; count: number }[];
  top_drop_hotspots: { label: string; city: string; count: number }[];
  busiest_pick_hours: { hour: number; count: number }[];
}

export interface HealthCheckResponse {
  status: string;
  ok?: boolean;
}

// =============================================================================
// API Configuration Check
// =============================================================================

/**
 * Check if API is configured and ready
 */
export function isApiConfigured(): boolean {
  return isSupabaseConfigured();
}

// =============================================================================
// Provider API Functions
// =============================================================================

/**
 * Geocode an address to coordinates
 *
 * @param address - Address string to geocode
 * @returns Geocode result with coordinates
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const { data, error } = await fetchEdgeFunction<GeocodeResult>('geocode', {
    params: { address },
  });

  if (error) {
    return { success: false, message: error.message };
  }

  if (!data) {
    return { success: false, message: 'No data returned' };
  }

  // Normalize coordinates format
  return {
    ...data,
    coordinates: data.coordinates || (data.lat && data.lng ? {
      latitude: data.lat,
      longitude: data.lng,
    } : undefined),
  };
}

/**
 * Get all providers
 *
 * @returns List of all providers
 */
export async function getAllProviders(): Promise<{ data: Provider[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<{ data: Provider[] }>('providers');
  return { data: data?.data || null, error };
}

/**
 * Search providers by query
 *
 * @param query - Search query string
 * @returns Matching providers
 */
export async function searchProviders(
  query: string
): Promise<{ data: Provider[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<Provider[]>('providers/search', {
    params: { q: query },
  });
  return { data, error };
}

/**
 * Filter providers based on origin/destination and criteria
 *
 * @param request - Filter parameters
 * @returns Filtered providers list
 */
export async function filterProviders(
  request: ProviderFilterRequest
): Promise<{ data: ProviderFilterResponse | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<ProviderFilterResponse>('providers/filter', {
    method: 'POST',
    body: request,
  });
  return { data, error };
}

/**
 * Get provider service zone by ID
 *
 * @param providerId - Provider ID
 * @returns Service zone GeoJSON data
 */
export async function getProviderServiceZone(
  providerId: string | number
): Promise<{ data: unknown | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction(`providers/${providerId}/service-zone`);
  return { data, error };
}

/**
 * Get a single provider by ID
 *
 * @param providerId - Provider ID
 * @returns Provider data
 */
export async function getProvider(
  providerId: string | number
): Promise<{ data: Provider | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<Provider>(`providers/${providerId}`);
  return { data, error };
}

/**
 * Update a provider
 *
 * @param providerId - Provider ID
 * @param providerData - Updated provider data
 * @returns Updated provider
 */
export async function updateProvider(
  providerId: string | number,
  providerData: Partial<Provider>
): Promise<{ data: Provider | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<Provider>(`providers/${providerId}`, {
    method: 'PUT',
    body: providerData,
  });
  return { data, error };
}

// =============================================================================
// Geocode API Functions
// =============================================================================

/**
 * Geocode an address using the dedicated geocode edge function
 * (Alternative to providers/geocode endpoint)
 *
 * @param address - Address to geocode
 * @returns Geocode result
 */
export async function geocode(address: string): Promise<GeocodeResult> {
  return geocodeAddress(address);
}

// =============================================================================
// Directions API Functions
// =============================================================================

/**
 * Get directions between two locations
 *
 * @param request - Directions request with origin, destination, and mode
 * @returns Directions response with route information
 */
export async function getDirections(
  request: DirectionsRequest
): Promise<{ data: DirectionsResponse | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<DirectionsResponse>('directions', {
    method: 'POST',
    body: request,
  });
  return { data, error };
}

// =============================================================================
// Chat API Functions
// =============================================================================

/**
 * Check chat server health
 *
 * @returns True if server is online
 */
export async function checkChatHealth(): Promise<boolean> {
  try {
    const { error } = await fetchEdgeFunction<HealthCheckResponse>('health');
    return error === null;
  } catch {
    return false;
  }
}

/**
 * Create a new conversation
 *
 * @param title - Optional conversation title
 * @returns New conversation data
 */
export async function createConversation(
  title: string = 'New Chat'
): Promise<{ data: Conversation | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<Conversation>('conversations', {
    method: 'POST',
    body: { title },
  });
  return { data, error };
}

/**
 * Get a conversation by ID with messages
 *
 * @param conversationId - Conversation ID
 * @returns Conversation with messages
 */
export async function getConversation(
  conversationId: string
): Promise<{ data: Conversation | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<Conversation>(`conversations/${conversationId}`);
  return { data, error };
}

/**
 * List all conversations
 *
 * @returns List of conversations
 */
export async function listConversations(): Promise<{ data: Conversation[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<Conversation[]>('conversations');
  return { data, error };
}

/**
 * Delete a conversation
 *
 * @param conversationId - Conversation ID to delete
 * @returns Success status
 */
export async function deleteConversation(
  conversationId: string
): Promise<{ error: Error | null }> {
  const { error } = await fetchEdgeFunction(`conversations/${conversationId}`, {
    method: 'DELETE',
  });
  return { error };
}

/**
 * Send a chat message and get response (non-streaming)
 *
 * @param conversationId - Conversation ID
 * @param message - Message content
 * @returns Chat response
 */
export async function sendChatMessage(
  conversationId: string,
  message: string
): Promise<{ data: ChatResponse | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<ChatResponse>('chat', {
    method: 'POST',
    body: {
      conversation_id: conversationId,
      message,
    },
  });
  return { data, error };
}

/**
 * Stream chat response (SSE)
 *
 * @param conversationId - Conversation ID
 * @param newMessage - New message to send
 * @returns Async generator of chat events
 */
export async function* streamChatResponse(
  conversationId: string,
  newMessage: ConversationMessage
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const url = getEdgeFunctionUrl('chat');
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversation_id: conversationId,
      message: newMessage.content,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6)) as ChatStreamEvent;
            yield event;
          } catch (e) {
            console.warn('Failed to parse SSE event:', line, e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// Messages API Functions
// =============================================================================

/**
 * Get messages for a conversation
 *
 * @param conversationId - Conversation ID
 * @returns List of messages
 */
export async function getMessages(
  conversationId: string
): Promise<{ data: ConversationMessage[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<ConversationMessage[]>(
    `messages?conversation_id=${conversationId}`
  );
  return { data, error };
}

/**
 * Create a message in a conversation
 *
 * @param conversationId - Conversation ID
 * @param role - Message role (user, assistant, system)
 * @param content - Message content
 * @returns Created message
 */
export async function createMessage(
  conversationId: string,
  role: string,
  content: string
): Promise<{ data: ConversationMessage | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<ConversationMessage>('messages', {
    method: 'POST',
    body: {
      conversation_id: conversationId,
      role,
      content,
    },
  });
  return { data, error };
}

// =============================================================================
// Trip Records API Functions
// =============================================================================

/**
 * Get trip record pairs
 *
 * @returns List of trip record pairs
 */
export async function getTripRecordPairs(): Promise<{ data: TripRecordPair[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<TripRecordPair[]>('trip-records/pairs');
  return { data, error };
}

/**
 * Get trip record pair summaries
 *
 * @returns List of pair summaries
 */
export async function getTripRecordPairSummaries(): Promise<{ data: unknown[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<unknown[]>('trip-records/pair-summaries');
  return { data, error };
}

/**
 * Get enriched trip record pairs from CSV
 *
 * @returns Enriched trip pairs with routing data
 */
export async function getTripRecordCSVPairs(): Promise<{ data: TripRecordPair[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<TripRecordPair[]>('trip-records/csv/pairs');
  return { data, error };
}

/**
 * Get grouped trip record pairs (outbound/return structure)
 *
 * @returns Grouped trip pairs
 */
export async function getTripRecordCSVPairsGrouped(): Promise<{ data: unknown[] | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<unknown[]>('trip-records/csv/pairs-grouped');
  return { data, error };
}

/**
 * Get trip record statistics
 *
 * @returns Trip record statistics
 */
export async function getTripRecordStats(): Promise<{ data: TripRecordStats | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<TripRecordStats>('trip-records/csv/stats');
  return { data, error };
}

// =============================================================================
// Replay & Examples API Functions
// =============================================================================

export interface ChatExample {
  id: string;
  conversation_id: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  is_active?: boolean;
  created_at?: string;
}

/**
 * List chat examples
 *
 * @param isActive - Filter by active status
 * @returns List of chat examples
 */
export async function listChatExamples(
  isActive?: boolean
): Promise<{ data: ChatExample[] | null; error: Error | null }> {
  const params: Record<string, string> = {};
  if (isActive !== undefined) {
    params.is_active = String(isActive);
  }
  const { data, error } = await fetchEdgeFunction<ChatExample[]>('chat-examples', { params });
  return { data, error };
}

/**
 * Delete a chat example
 *
 * @param exampleId - Example ID to delete
 * @returns Success status
 */
export async function deleteChatExample(
  exampleId: string
): Promise<{ error: Error | null }> {
  const { error } = await fetchEdgeFunction(`chat-examples/${exampleId}`, {
    method: 'DELETE',
  });
  return { error };
}

/**
 * Save conversation as example
 *
 * @param conversationId - Conversation ID
 * @param options - Example metadata
 * @returns Saved example data
 */
export async function saveConversationAsExample(
  conversationId: string,
  options: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
  }
): Promise<{ data: unknown | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction('chat-examples', {
    method: 'POST',
    body: {
      conversation_id: conversationId,
      ...options,
    },
  });
  return { data, error };
}

/**
 * Load example replay data
 *
 * @param conversationId - Conversation ID
 * @returns Replay data with states and config
 */
export async function loadExampleReplayData(
  conversationId: string
): Promise<{ data: unknown | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction(`replay/${conversationId}`);
  return { data, error };
}

/**
 * Get conversation messages (for legacy fallback)
 *
 * @param conversationId - Conversation ID
 * @returns Messages data
 */
export async function getConversationMessages(
  conversationId: string
): Promise<{ data: { messages: ConversationMessage[] } | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<{ messages: ConversationMessage[] }>(
    `conversations/${conversationId}/messages`
  );
  return { data, error };
}

/**
 * Get conversation tool calls (for legacy fallback)
 *
 * @param conversationId - Conversation ID
 * @returns Tool calls data
 */
export async function getConversationToolCalls(
  conversationId: string
): Promise<{ data: { tool_calls: ToolCall[] } | null; error: Error | null }> {
  const { data, error } = await fetchEdgeFunction<{ tool_calls: ToolCall[] }>(
    `conversations/${conversationId}/tool-calls`
  );
  return { data, error };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get API mode information for debugging
 */
export function getApiModeInfo(): {
  mode: 'supabase';
  supabaseConfigured: boolean;
} {
  return {
    mode: 'supabase',
    supabaseConfigured: isSupabaseConfigured(),
  };
}

/**
 * Re-export Supabase utilities for components that need direct access
 */
export { getEdgeFunctionUrl, getAuthHeaders, isSupabaseConfigured };
