import type { Request, Response } from "express";
import { v4 as uuidV4 } from "uuid";
import { processQuery } from "./llm.js";
import { getRestaurants } from "./tools.js";
import type { OpenAI } from "openai";

interface A2AMessage {
  messageId: string;
  contextId?: string;
  role: string;
  parts: Array<{
    kind: string;
    text?: string;
    data?: unknown;
    mimeType?: string;
  }>;
  kind: string;
}

interface A2ARequest {
  message: A2AMessage;
}

const A2UI_MIME_TYPE = "application/a2ui+json";

// Conversation history per A2A contextId, so follow-up turns (e.g. booking a
// restaurant from a previous search) keep state, like the upstream sample's
// per-context sessions. Simple LRU caps memory for this demo server.
const MAX_SESSIONS = 100;
const MAX_HISTORY_MESSAGES = 20;
const sessions = new Map<string, OpenAI.ChatCompletionMessageParam[]>();

function getSession(contextId: string): OpenAI.ChatCompletionMessageParam[] {
  let history = sessions.get(contextId);
  if (history) {
    sessions.delete(contextId);
  } else {
    history = [];
    if (sessions.size >= MAX_SESSIONS) {
      const oldest = sessions.keys().next().value;
      if (oldest !== undefined) sessions.delete(oldest);
    }
  }
  sessions.set(contextId, history);
  return history;
}

function trimHistory(history: OpenAI.ChatCompletionMessageParam[]): void {
  // Avoid splitting an assistant tool_calls message from its tool results.
  while (
    history.length > MAX_HISTORY_MESSAGES ||
    (history.length > 0 && history[0].role === "tool")
  ) {
    history.shift();
  }
}

export async function handleA2ARequest(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as A2ARequest;

  if (!body?.message?.parts) {
    res.status(400).json({ error: "Invalid request: missing message.parts" });
    return;
  }

  const requestedExtensions = (req.headers["x-a2a-extensions"] as string) || "";
  const useA2ui = requestedExtensions.includes("a2ui");

  let query = "";
  let uiAction: { name: string; context: Record<string, unknown> } | null =
    null;

  for (const part of body.message.parts) {
    if (part.kind === "text" && part.text) {
      query = part.text;
    } else if (part.kind === "data" && part.data) {
      const data = part.data as Record<string, unknown>;
      if (data.version === "v0.9" && data.action) {
        uiAction = data.action as {
          name: string;
          context: Record<string, unknown>;
        };
      }
    }
  }

  if (uiAction) {
    query = buildQueryFromAction(uiAction);
  }

  if (!query) {
    res.status(400).json({ error: "No query or action found in message" });
    return;
  }

  const contextId =
    typeof body.message.contextId === "string" && body.message.contextId
      ? body.message.contextId
      : uuidV4();
  const taskId = uuidV4();
  const history = getSession(contextId);

  console.log(`[handler] Processing query: "${query}"`);
  console.log(`[handler] A2UI mode: ${useA2ui}, contextId: ${contextId}`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.status(200);

  try {
    if (useA2ui) {
      await handleA2uiStream(query, uiAction, history, res, taskId, contextId);
    } else {
      await handleTextStream(query, history, res, taskId, contextId);
    }
  } catch (err) {
    console.error("[handler] Stream error:", err);
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    res.write(
      `data: ${JSON.stringify([{ kind: "error", text: errorMsg }])}\n\n`,
    );
    res.end();
  } finally {
    trimHistory(history);
  }
}

async function handleA2uiStream(
  query: string,
  uiAction: { name: string; context: Record<string, unknown> } | null,
  history: OpenAI.ChatCompletionMessageParam[],
  res: Response,
  taskId: string,
  contextId: string,
): Promise<void> {
  // The LLM generates the A2UI messages directly (search results, booking
  // form and confirmation alike); there are no server-side UI templates.
  const llmResult = await processQuery(query, history, "a2ui", getRestaurants);

  if (!llmResult.a2uiMessages) {
    // No valid A2UI even after the retry: surface an honest text apology
    // instead of falling back to canned data.
    res.write(
      `data: ${JSON.stringify([{ kind: "text", text: llmResult.text }])}\n\n`,
    );
    sendStatusUpdate(res, "input-required", taskId, contextId);
    res.end();
    return;
  }

  // KNOWN GAP (intentionally not fixed in this iteration): the LLM call is
  // non-streaming, so every A2UI message is flushed in a single SSE event
  // rather than streamed incrementally like the upstream ADK sample.
  sendSseParts(res, llmResult.a2uiMessages);

  if (uiAction?.name === "submit_booking") {
    sendStatusUpdate(res, "completed", taskId, contextId, true);
  } else {
    sendStatusUpdate(res, "input-required", taskId, contextId);
  }
  res.end();
}

async function handleTextStream(
  query: string,
  history: OpenAI.ChatCompletionMessageParam[],
  res: Response,
  taskId: string,
  contextId: string,
): Promise<void> {
  const llmResult = await processQuery(query, history, "text", getRestaurants);

  const textResponse = llmResult.text || "I found some restaurants for you.";
  const parts = [{ kind: "text", text: textResponse }];

  res.write(`data: ${JSON.stringify(parts)}\n\n`);
  sendStatusUpdate(res, "input-required", taskId, contextId);
  res.end();
}

function sendSseParts(res: Response, a2uiMessages: unknown[]): void {
  const parts = a2uiMessages.map((msg) => ({
    kind: "data",
    data: msg,
    mimeType: A2UI_MIME_TYPE,
  }));
  res.write(`data: ${JSON.stringify(parts)}\n\n`);
}

function sendStatusUpdate(
  res: Response,
  state: string,
  taskId: string,
  contextId: string,
  isFinal = false,
): void {
  const statusUpdate = {
    kind: "status-update",
    taskId,
    contextId,
    status: {
      state,
      message: {
        messageId: uuidV4(),
        role: "agent",
        parts: [],
        kind: "message",
      },
    },
    final: isFinal,
  };
  res.write(`data: ${JSON.stringify([statusUpdate])}\n\n`);
}

function buildQueryFromAction(action: {
  name: string;
  context: Record<string, unknown>;
}): string {
  const ctx = action.context;

  if (action.name === "book_restaurant") {
    return `USER_WANTS_TO_BOOK: ${ctx.restaurantName}, Address: ${ctx.address}, ImageURL: ${ctx.imageUrl}`;
  }

  if (action.name === "submit_booking") {
    return `User submitted a booking for ${ctx.restaurantName} for ${ctx.partySize} people at ${ctx.reservationTime} with dietary requirements: ${ctx.dietary}. The image URL is ${ctx.imageUrl}`;
  }

  return `User submitted an event: ${action.name} with data: ${JSON.stringify(ctx)}`;
}
