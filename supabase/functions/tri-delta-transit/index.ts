/**
 * Tri Delta Transit Edge Function
 *
 * Handles Tri Delta Transit historical data endpoints:
 * - GET /tri-delta-transit/trips - List historical trips
 * - GET /tri-delta-transit/routes?mode=driving|transit - Get route overlays
 *
 * Uses tri_delta_transit and transit_driving_driving tables.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders,
  errorResponse,
  handleCorsPreflightRequest,
  jsonResponse,
} from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";

// Type definitions

interface TriDeltaTrip {
  trip_id: number;
  origin_address: string;
  origin_city: string;
  destination_address: string;
  destination_city: string;
  duration_hours: number;
  origin_latitude: number | null;
  origin_longitude: number | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  origin_geometry: string | null;
  destination_geometry: string | null;
}

interface TriDeltaRouteOverlay {
  trip_id: number;
  mode: "driving" | "transit";
  summary: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  polyline: string | null;
  warnings: string[];
}

type RouteMode = "driving" | "transit";

/**
 * Parse route info from URL path.
 */
function parseRoute(pathname: string): { segments: string[] } {
  const cleanPath = pathname.replace(/^\/tri-delta-transit\/?/, "").replace(/\/$/, "");
  const segments = cleanPath.split("/").filter(Boolean);
  return { segments };
}

/**
 * List historical Tri Delta Transit trips.
 */
async function listTriDeltaTrips(origin?: string | null): Promise<Response> {
  try {
    const supabase = createServiceClient();

    // Query the tri_delta_transit table
    const { data, error } = await supabase
      .from("tri_delta_transit")
      .select(`
        "Trip ID",
        "Origin Address",
        "Origin City",
        "Destination Address",
        "Destination City",
        "Duration (hours)",
        "Origin Latitude",
        "Origin Longitude",
        "Destination Latitude",
        "Destination Longitude",
        "Origin Geometry",
        "Destination Geometry"
      `)
      .order("Trip ID");

    if (error) {
      console.error("Error fetching tri delta trips:", error);
      return errorResponse(`Database error: ${error.message}`, 500, origin);
    }

    if (!data) {
      return jsonResponse([], 200, origin);
    }

    // Transform column names to match API response format
    const trips: TriDeltaTrip[] = data.map((row) => ({
      trip_id: row["Trip ID"],
      origin_address: row["Origin Address"],
      origin_city: row["Origin City"],
      destination_address: row["Destination Address"],
      destination_city: row["Destination City"],
      duration_hours: row["Duration (hours)"],
      origin_latitude: row["Origin Latitude"],
      origin_longitude: row["Origin Longitude"],
      destination_latitude: row["Destination Latitude"],
      destination_longitude: row["Destination Longitude"],
      origin_geometry: row["Origin Geometry"],
      destination_geometry: row["Destination Geometry"],
    }));

    return jsonResponse(trips, 200, origin);
  } catch (err) {
    console.error("Unexpected error in listTriDeltaTrips:", err);
    return errorResponse("Internal server error", 500, origin);
  }
}

/**
 * List route overlays for Tri Delta trips.
 */
async function listTriDeltaRouteOverlays(
  mode: RouteMode,
  origin?: string | null
): Promise<Response> {
  try {
    const supabase = createServiceClient();

    // Determine column prefix based on mode
    const prefix = mode === "transit" ? "transit" : "driving";

    // Query the transit_driving_driving table
    const { data, error } = await supabase
      .from("transit_driving_driving")
      .select(`
        trip_id,
        ${prefix}_summary,
        ${prefix}_distance_meters,
        ${prefix}_duration_seconds,
        ${prefix}_polyline,
        ${prefix}_warnings
      `)
      .not(`${prefix}_polyline`, "is", null)
      .order("trip_id");

    if (error) {
      console.error("Error fetching route overlays:", error);
      return errorResponse(`Database error: ${error.message}`, 500, origin);
    }

    if (!data) {
      return jsonResponse([], 200, origin);
    }

    // Transform to API response format
    const routes: TriDeltaRouteOverlay[] = data.map((row) => {
      // Parse warnings if it's a string
      let warnings: string[] = [];
      const warningsData = row[`${prefix}_warnings`];
      if (warningsData) {
        if (typeof warningsData === "string") {
          try {
            warnings = JSON.parse(warningsData);
          } catch {
            warnings = [];
          }
        } else if (Array.isArray(warningsData)) {
          warnings = warningsData;
        }
      }

      return {
        trip_id: row.trip_id,
        mode,
        summary: row[`${prefix}_summary`] || null,
        distance_meters: row[`${prefix}_distance_meters`] || null,
        duration_seconds: row[`${prefix}_duration_seconds`] || null,
        polyline: row[`${prefix}_polyline`] || null,
        warnings,
      };
    });

    return jsonResponse(routes, 200, origin);
  } catch (err) {
    console.error("Unexpected error in listTriDeltaRouteOverlays:", err);
    return errorResponse("Internal server error", 500, origin);
  }
}

/**
 * Validate route mode parameter.
 */
function validateMode(mode: string | null): mode is RouteMode {
  return mode === "driving" || mode === "transit";
}

/**
 * Main request handler.
 */
serve(async (req: Request): Promise<Response> => {
  const requestOrigin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(requestOrigin);
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // Parse route
    const { segments } = parseRoute(pathname);

    console.log(`[TriDeltaTransit] ${method} ${pathname} - segments:`, segments);

    // Route handling
    // GET /tri-delta-transit/trips - List trips
    if (method === "GET" && segments[0] === "trips" && segments.length === 1) {
      return await listTriDeltaTrips(requestOrigin);
    }

    // GET /tri-delta-transit/routes?mode=driving|transit - Get route overlays
    if (method === "GET" && segments[0] === "routes" && segments.length === 1) {
      const mode = url.searchParams.get("mode") || "driving";

      if (!validateMode(mode)) {
        return errorResponse(
          `Invalid mode parameter. Must be 'driving' or 'transit'.`,
          400,
          requestOrigin
        );
      }

      return await listTriDeltaRouteOverlays(mode, requestOrigin);
    }

    // Route not found
    return errorResponse(`Not found: ${method} ${pathname}`, 404, requestOrigin);
  } catch (err) {
    console.error("Unhandled error:", err);
    return errorResponse("Internal server error", 500, requestOrigin);
  }
});
