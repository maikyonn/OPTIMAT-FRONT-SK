/**
 * Health Check Edge Function
 *
 * Simple health probe endpoint for service monitoring.
 * Returns a JSON response indicating the service is operational.
 *
 * Usage:
 *   GET /health
 *
 * Response:
 *   { "status": "ok" }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
} from "../_shared/cors.ts";

/**
 * Main request handler for the health check function.
 */
serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin);
  }

  // Return health status
  return jsonResponse({ status: "ok" }, 200, origin);
});
