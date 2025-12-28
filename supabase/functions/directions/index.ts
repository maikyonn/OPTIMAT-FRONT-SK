/**
 * Directions Edge Function
 *
 * Provides route directions using the Google Directions API.
 * Supports driving and transit modes with detailed route information.
 *
 * Usage:
 *   POST /directions
 *   Body: {
 *     "origin": "123 Main St, San Francisco, CA",
 *     "destination": "456 Market St, San Francisco, CA",
 *     "mode": "driving" | "transit"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "summary": "US-101 N",
 *     "distance_text": "5.2 mi",
 *     "distance_meters": 8369,
 *     "duration_text": "15 mins",
 *     "duration_seconds": 900,
 *     "polyline": "encoded_polyline_string",
 *     "legs": [...],
 *     "warnings": []
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

// Google Directions API endpoint
const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

// Supported travel modes
type TravelMode = "driving" | "transit";

/**
 * Request body for directions API.
 */
interface DirectionsRequest {
  origin: string;
  destination: string;
  mode?: TravelMode;
}

/**
 * Route step information.
 */
interface RouteStep {
  instruction: string | null;
  distance_text: string | null;
  distance_meters: number | null;
  duration_text: string | null;
  duration_seconds: number | null;
  travel_mode: string | null;
  polyline: string | null;
}

/**
 * Route leg information (origin to destination segment).
 */
interface RouteLeg {
  start_address: string | null;
  end_address: string | null;
  distance_text: string | null;
  distance_meters: number | null;
  duration_text: string | null;
  duration_seconds: number | null;
  steps: RouteStep[];
}

/**
 * Successful directions response.
 */
interface DirectionsSuccessResponse {
  success: true;
  summary: string | null;
  distance_text: string | null;
  distance_meters: number | null;
  duration_text: string | null;
  duration_seconds: number | null;
  polyline: string | null;
  legs: RouteLeg[];
  warnings: string[];
}

/**
 * Failed directions response.
 */
interface DirectionsErrorResponse {
  success: false;
  error: string;
  warnings?: string[];
  details?: Record<string, unknown>;
}

type DirectionsResponse = DirectionsSuccessResponse | DirectionsErrorResponse;

/**
 * Google Directions API response structure.
 */
interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes?: Array<{
    summary?: string;
    overview_polyline?: { points?: string };
    warnings?: string[];
    legs?: Array<{
      start_address?: string;
      end_address?: string;
      distance?: { text?: string; value?: number };
      duration?: { text?: string; value?: number };
      steps?: Array<{
        html_instructions?: string;
        distance?: { text?: string; value?: number };
        duration?: { text?: string; value?: number };
        travel_mode?: string;
        polyline?: { points?: string };
      }>;
    }>;
  }>;
}

/**
 * Parse steps from Google Directions API response.
 *
 * @param steps - Raw steps from API response
 * @returns Parsed route steps
 */
function parseSteps(
  steps: NonNullable<
    NonNullable<
      NonNullable<GoogleDirectionsResponse["routes"]>[0]["legs"]
    >[0]["steps"]
  >
): RouteStep[] {
  return steps.map((step) => ({
    instruction: step.html_instructions || null,
    distance_text: step.distance?.text || null,
    distance_meters: step.distance?.value ?? null,
    duration_text: step.duration?.text || null,
    duration_seconds: step.duration?.value ?? null,
    travel_mode: step.travel_mode || null,
    polyline: step.polyline?.points || null,
  }));
}

/**
 * Parse legs from Google Directions API response.
 *
 * @param legs - Raw legs from API response
 * @returns Parsed route legs
 */
function parseLegs(
  legs: NonNullable<
    NonNullable<GoogleDirectionsResponse["routes"]>[0]["legs"]
  >
): RouteLeg[] {
  return legs.map((leg) => ({
    start_address: leg.start_address || null,
    end_address: leg.end_address || null,
    distance_text: leg.distance?.text || null,
    distance_meters: leg.distance?.value ?? null,
    duration_text: leg.duration?.text || null,
    duration_seconds: leg.duration?.value ?? null,
    steps: parseSteps(leg.steps || []),
  }));
}

/**
 * Aggregate a numeric metric across all legs.
 *
 * @param legs - Route legs
 * @param key - The metric key to aggregate
 * @returns Sum of the metric across all legs, or null if none available
 */
function aggregateMetric(
  legs: RouteLeg[],
  key: "distance_meters" | "duration_seconds"
): number | null {
  const values = legs
    .map((leg) => leg[key])
    .filter((v): v is number => v !== null);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Get directions between two locations.
 *
 * @param origin - Starting location (address or coordinates)
 * @param destination - Ending location (address or coordinates)
 * @param mode - Travel mode (driving or transit)
 * @param apiKey - Google Maps API key
 * @returns Directions result with route information
 */
async function getDirections(
  origin: string,
  destination: string,
  mode: TravelMode,
  apiKey: string
): Promise<DirectionsResponse> {
  // Build request parameters
  const params = new URLSearchParams({
    origin,
    destination,
    mode,
    key: apiKey,
  });

  // Add transit-specific parameters
  if (mode === "transit") {
    params.set("transit_routing_preference", "less_walking");
  }

  try {
    const response = await fetch(`${DIRECTIONS_URL}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Google Directions API HTTP error ${response.status}: ${errorText}`
      );
      return {
        success: false,
        error: `Directions API returned HTTP ${response.status}`,
        details: { status: response.status, response: errorText },
      };
    }

    const data: GoogleDirectionsResponse = await response.json();

    // Check API status
    if (data.status !== "OK") {
      const message =
        data.error_message || data.status || "Directions request failed";
      console.warn(`Directions API returned status ${data.status}: ${message}`);
      return {
        success: false,
        error: message,
        warnings: [],
        details: { status: data.status },
      };
    }

    // Check for routes
    const routes = data.routes || [];
    if (routes.length === 0) {
      return {
        success: false,
        error: "No routes found between the specified locations",
      };
    }

    // Use the primary (first) route
    const primaryRoute = routes[0];
    const legs = parseLegs(primaryRoute.legs || []);

    // Aggregate metrics
    const totalDurationSeconds = aggregateMetric(legs, "duration_seconds");
    const totalDistanceMeters = aggregateMetric(legs, "distance_meters");

    // Use first leg's text representations for convenience
    const durationText = legs[0]?.duration_text || null;
    const distanceText = legs[0]?.distance_text || null;

    return {
      success: true,
      summary: primaryRoute.summary || null,
      distance_text: distanceText,
      distance_meters: totalDistanceMeters,
      duration_text: durationText,
      duration_seconds: totalDurationSeconds,
      polyline: primaryRoute.overview_polyline?.points || null,
      legs,
      warnings: primaryRoute.warnings || [],
    };
  } catch (error) {
    console.error("Directions request failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Directions request failed",
    };
  }
}

/**
 * Validate the directions request body.
 *
 * @param body - The request body to validate
 * @returns Error message if invalid, null if valid
 */
function validateRequest(
  body: unknown
): { error: string } | { data: DirectionsRequest } {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be a JSON object" };
  }

  const { origin, destination, mode } = body as Record<string, unknown>;

  // Validate origin
  if (!origin || typeof origin !== "string") {
    return { error: "Missing or invalid 'origin' parameter" };
  }
  if (origin.trim().length === 0) {
    return { error: "Origin cannot be empty" };
  }
  if (origin.length > 500) {
    return { error: "Origin exceeds maximum length of 500 characters" };
  }

  // Validate destination
  if (!destination || typeof destination !== "string") {
    return { error: "Missing or invalid 'destination' parameter" };
  }
  if (destination.trim().length === 0) {
    return { error: "Destination cannot be empty" };
  }
  if (destination.length > 500) {
    return { error: "Destination exceeds maximum length of 500 characters" };
  }

  // Validate mode (optional, defaults to driving)
  let validatedMode: TravelMode = "driving";
  if (mode !== undefined) {
    if (typeof mode !== "string") {
      return { error: "Mode must be a string" };
    }
    const normalizedMode = mode.toLowerCase();
    if (normalizedMode !== "driving" && normalizedMode !== "transit") {
      return { error: "Mode must be 'driving' or 'transit'" };
    }
    validatedMode = normalizedMode as TravelMode;
  }

  return {
    data: {
      origin: origin.trim(),
      destination: destination.trim(),
      mode: validatedMode,
    },
  };
}

/**
 * Main request handler for the directions function.
 */
serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin);
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return errorResponse(
      `Method ${req.method} not allowed. Use POST.`,
      405,
      origin
    );
  }

  // Get Google Maps API key from environment
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not configured");
    return errorResponse(
      "Directions service not configured",
      503,
      origin
    );
  }

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      "Invalid JSON in request body",
      400,
      origin
    );
  }

  // Validate request
  const validation = validateRequest(body);
  if ("error" in validation) {
    return errorResponse(validation.error, 400, origin);
  }

  const { origin: routeOrigin, destination, mode } = validation.data;

  // Get directions
  const result = await getDirections(routeOrigin, destination, mode!, apiKey);

  if (result.success) {
    return jsonResponse(result, 200, origin);
  } else {
    // Determine appropriate status code
    let status = 500;
    if (result.error.includes("No routes found")) {
      status = 404;
    } else if (result.error.includes("ZERO_RESULTS")) {
      status = 404;
    } else if (result.error.includes("NOT_FOUND")) {
      status = 404;
    } else if (result.error.includes("INVALID_REQUEST")) {
      status = 400;
    }

    return jsonResponse(result, status, origin);
  }
});
