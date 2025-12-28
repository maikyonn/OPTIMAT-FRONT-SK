/**
 * Geocoding Edge Function
 *
 * Provides address geocoding using the Google Places API (Text Search).
 * Returns formatted address, coordinates, and place ID.
 *
 * Usage:
 *   GET /geocode?address=123 Main St, San Francisco, CA
 *
 * Response:
 *   {
 *     "success": true,
 *     "formatted_address": "123 Main St, San Francisco, CA 94105",
 *     "lat": 37.7749,
 *     "lng": -122.4194,
 *     "place_id": "ChIJ..."
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

// Google Places API configuration
const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location";

/**
 * Response type for successful geocoding.
 */
interface GeocodeSuccessResponse {
  success: true;
  formatted_address: string;
  lat: number;
  lng: number;
  place_id: string;
}

/**
 * Response type for failed geocoding.
 */
interface GeocodeErrorResponse {
  success: false;
  error: string;
  details?: Record<string, unknown>;
}

type GeocodeResponse = GeocodeSuccessResponse | GeocodeErrorResponse;

/**
 * Google Places API response structure.
 */
interface PlacesApiResponse {
  places?: Array<{
    id?: string;
    displayName?: {
      text?: string;
      languageCode?: string;
    };
    formattedAddress?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/**
 * Geocode an address using the Google Places Text Search API.
 *
 * @param address - The address string to geocode
 * @param apiKey - Google Maps API key
 * @returns Geocoding result with coordinates and formatted address
 */
async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<GeocodeResponse> {
  const headers = {
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": PLACES_FIELD_MASK,
    "Content-Type": "application/json",
  };

  const payload = {
    textQuery: address,
    // Bias results to US (can be made configurable)
    locationBias: {
      rectangle: {
        low: { latitude: 24.396308, longitude: -125.0 },
        high: { latitude: 49.384358, longitude: -66.93457 },
      },
    },
  };

  try {
    const response = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Google Places API error ${response.status}: ${errorText}`
      );
      return {
        success: false,
        error: `Google Places API error: ${response.status}`,
        details: { status: response.status, response: errorText },
      };
    }

    const data: PlacesApiResponse = await response.json();

    // Check for API-level errors
    if (data.error) {
      console.error("Google Places API error:", data.error);
      return {
        success: false,
        error: data.error.message || "Google Places API error",
        details: { code: data.error.code, status: data.error.status },
      };
    }

    // Check if any places were found
    const places = data.places || [];
    if (places.length === 0) {
      return {
        success: false,
        error: `No results found for address: ${address}`,
      };
    }

    // Use the first result (most relevant)
    const place = places[0];

    // Extract location coordinates
    const location = place.location;
    if (!location || location.latitude === undefined || location.longitude === undefined) {
      return {
        success: false,
        error: "Location coordinates not available in response",
        details: { place },
      };
    }

    // Extract place ID
    const placeId = place.id;
    if (!placeId) {
      return {
        success: false,
        error: "Place ID not available in response",
        details: { place },
      };
    }

    // Extract formatted address
    const formattedAddress =
      place.formattedAddress || place.displayName?.text || address;

    return {
      success: true,
      formatted_address: formattedAddress,
      lat: location.latitude,
      lng: location.longitude,
      place_id: placeId,
    };
  } catch (error) {
    console.error("Geocoding request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Geocoding request failed",
    };
  }
}

/**
 * Validate the address parameter.
 *
 * @param address - The address to validate
 * @returns Error message if invalid, null if valid
 */
function validateAddress(address: string | null): string | null {
  if (!address) {
    return "Missing required parameter: address";
  }

  const trimmed = address.trim();
  if (trimmed.length === 0) {
    return "Address cannot be empty";
  }

  if (trimmed.length < 3) {
    return "Address must be at least 3 characters";
  }

  if (trimmed.length > 500) {
    return "Address exceeds maximum length of 500 characters";
  }

  return null;
}

/**
 * Main request handler for the geocode function.
 */
serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin);
  }

  // Only accept GET requests
  if (req.method !== "GET") {
    return errorResponse(
      `Method ${req.method} not allowed. Use GET.`,
      405,
      origin
    );
  }

  // Get Google Maps API key from environment
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not configured");
    return errorResponse(
      "Geocoding service not configured",
      503,
      origin
    );
  }

  // Parse URL and extract address parameter
  const url = new URL(req.url);
  const address = url.searchParams.get("address");

  // Validate address
  const validationError = validateAddress(address);
  if (validationError) {
    return errorResponse(validationError, 400, origin);
  }

  // Perform geocoding
  const result = await geocodeAddress(address!, apiKey);

  if (result.success) {
    return jsonResponse(result, 200, origin);
  } else {
    // Determine appropriate status code based on error type
    const status = result.error.includes("No results") ? 404 : 500;
    return jsonResponse(result, status, origin);
  }
});
