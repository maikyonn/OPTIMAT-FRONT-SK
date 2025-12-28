/**
 * Tool Calls API Edge Function for OPTIMAT
 * Provides read access to tool call history for conversations.
 *
 * Routes:
 * - GET /?conversation_id=:id - Get all tool calls for a conversation
 * - GET /?conversation_id=:id&tool_name=:name - Get tool calls filtered by type
 * - GET /recent?conversation_id=:id&limit=:n - Get recent tool calls across all types
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import {
  createOptimatClient,
  sanitizeRecord,
  TABLES,
} from "../_shared/supabase.ts";

// Types
interface ToolCall {
  id: string;
  conversation_id: string;
  tool_name: string;
  tool_input?: Record<string, unknown>;
  result_data?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  created_at: string;
}

interface FindProvidersCall {
  id: string;
  conversation_id: string;
  tool_call_id?: string;
  source_address?: string;
  destination_address?: string;
  provider_data?: Record<string, unknown>;
  public_transit_data?: Record<string, unknown>;
  message_timestamp?: string;
  created_at: string;
}

interface SearchAddressesCall {
  id: string;
  conversation_id: string;
  tool_call_id?: string;
  query_text?: string;
  places_data?: Record<string, unknown>;
  message_timestamp?: string;
  created_at: string;
}

interface GetProviderInfoCall {
  id: string;
  conversation_id: string;
  tool_call_id?: string;
  provider_id?: number;
  provider_info?: Record<string, unknown>;
  message_timestamp?: string;
  created_at: string;
}

interface GeneralQuestionCall {
  id: string;
  conversation_id: string;
  tool_call_id?: string;
  question?: string;
  search_results?: Record<string, unknown>;
  sources?: Array<Record<string, unknown>>;
  message_timestamp?: string;
  created_at: string;
}

// Parse URL path
function parseUrlPath(url: string): { isRecent: boolean } {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  // Check for /tool-calls/recent pattern
  const idx = pathParts.findIndex((p) => p === "tool-calls");
  if (idx !== -1 && pathParts[idx + 1] === "recent") {
    return { isRecent: true };
  }

  // Also check if last part is "recent"
  if (pathParts[pathParts.length - 1] === "recent") {
    return { isRecent: true };
  }

  return { isRecent: false };
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin);
  }

  // Only accept GET requests
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405, origin);
  }

  try {
    // Initialize Supabase client with optimat schema
    const supabase = createOptimatClient();

    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversation_id");
    const toolName = url.searchParams.get("tool_name");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const { isRecent } = parseUrlPath(req.url);

    if (!conversationId) {
      return errorResponse("conversation_id query parameter required", 400, origin);
    }

    // Verify conversation exists
    const { data: conversation, error: convError } = await supabase
      .from(TABLES.CONVERSATIONS)
      .select("id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return errorResponse("Conversation not found", 404, origin);
    }

    if (isRecent) {
      // Get recent tool calls across all types
      return await getRecentToolCalls(supabase, conversationId, limit, origin);
    }

    if (toolName) {
      // Get tool calls filtered by type
      return await getToolCallsByType(supabase, conversationId, toolName, origin);
    }

    // Get all tool calls for the conversation
    return await getAllToolCalls(supabase, conversationId, origin);
  } catch (error) {
    console.error("Tool calls error:", error);
    return errorResponse(
      `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      500,
      origin
    );
  }
});

/**
 * Get all tool calls for a conversation, organized by type.
 */
async function getAllToolCalls(
  supabase: ReturnType<typeof createOptimatClient>,
  conversationId: string,
  origin: string | null
): Promise<Response> {
  // Fetch all tool call types in parallel
  const [findProvidersResult, searchAddressesResult, getProviderInfoResult, generalQuestionResult] = await Promise.all([
    supabase
      .from(TABLES.FIND_PROVIDERS_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    supabase
      .from(TABLES.SEARCH_ADDRESSES_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    supabase
      .from(TABLES.GET_PROVIDER_INFO_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    supabase
      .from(TABLES.GENERAL_QUESTION_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  return jsonResponse(
    {
      conversation_id: conversationId,
      tool_calls: {
        find_providers: (findProvidersResult.data || []).map((c) => sanitizeRecord(c)),
        search_addresses: (searchAddressesResult.data || []).map((c) => sanitizeRecord(c)),
        get_provider_info: (getProviderInfoResult.data || []).map((c) => sanitizeRecord(c)),
        general_provider_question: (generalQuestionResult.data || []).map((c) => sanitizeRecord(c)),
      },
    },
    200,
    origin
  );
}

/**
 * Get tool calls filtered by tool type.
 */
async function getToolCallsByType(
  supabase: ReturnType<typeof createOptimatClient>,
  conversationId: string,
  toolName: string,
  origin: string | null
): Promise<Response> {
  let tableName: string;

  switch (toolName) {
    case "find_providers":
      tableName = TABLES.FIND_PROVIDERS_CALLS;
      break;
    case "search_addresses":
    case "search_addresses_from_user_query":
      tableName = TABLES.SEARCH_ADDRESSES_CALLS;
      break;
    case "get_provider_info":
      tableName = TABLES.GET_PROVIDER_INFO_CALLS;
      break;
    case "general_provider_question":
    case "general_question":
      tableName = TABLES.GENERAL_QUESTION_CALLS;
      break;
    default:
      return errorResponse(`Unknown tool name: ${toolName}`, 400, origin);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`Error fetching ${toolName} calls:`, error);
    return errorResponse(`Error fetching tool calls`, 500, origin);
  }

  return jsonResponse(
    {
      conversation_id: conversationId,
      tool_name: toolName,
      calls: (data || []).map((c) => sanitizeRecord(c)),
    },
    200,
    origin
  );
}

/**
 * Get recent tool calls across all types, sorted by created_at.
 */
async function getRecentToolCalls(
  supabase: ReturnType<typeof createOptimatClient>,
  conversationId: string,
  limit: number,
  origin: string | null
): Promise<Response> {
  // Fetch from all tables
  const [findProvidersResult, searchAddressesResult, getProviderInfoResult, generalQuestionResult] = await Promise.all([
    supabase
      .from(TABLES.FIND_PROVIDERS_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from(TABLES.SEARCH_ADDRESSES_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from(TABLES.GET_PROVIDER_INFO_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from(TABLES.GENERAL_QUESTION_CALLS)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  // Normalize all tool calls to a common format
  const allCalls: ToolCall[] = [];

  for (const call of findProvidersResult.data || []) {
    allCalls.push({
      id: call.id,
      conversation_id: call.conversation_id,
      tool_name: "find_providers",
      result_data: {
        data: call.provider_data?.data || call.provider_data || [],
        source_address: call.source_address,
        destination_address: call.destination_address,
        public_transit: call.public_transit_data,
      },
      parameters: {
        source_address: call.source_address,
        destination_address: call.destination_address,
      },
      created_at: call.created_at,
    });
  }

  for (const call of searchAddressesResult.data || []) {
    allCalls.push({
      id: call.id,
      conversation_id: call.conversation_id,
      tool_name: "search_addresses_from_user_query",
      result_data: call.places_data,
      parameters: {
        user_query: call.query_text,
      },
      created_at: call.created_at,
    });
  }

  for (const call of getProviderInfoResult.data || []) {
    allCalls.push({
      id: call.id,
      conversation_id: call.conversation_id,
      tool_name: "get_provider_info",
      result_data: call.provider_info,
      parameters: {
        provider_id: call.provider_id,
      },
      created_at: call.created_at,
    });
  }

  for (const call of generalQuestionResult.data || []) {
    allCalls.push({
      id: call.id,
      conversation_id: call.conversation_id,
      tool_name: "general_provider_question",
      result_data: {
        query: call.question,
        answer: (call.search_results as Record<string, unknown> | null)?.answer ?? null,
        sources: call.sources || [],
      },
      parameters: {
        question: call.question,
      },
      created_at: call.created_at,
    });
  }

  // Sort by created_at descending and limit
  allCalls.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const limitedCalls = allCalls.slice(0, limit);

  return jsonResponse(
    {
      conversation_id: conversationId,
      tool_calls: limitedCalls.map((c) => sanitizeRecord(c as unknown as Record<string, unknown>)),
    },
    200,
    origin
  );
}
