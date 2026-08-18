import OpenAI from "openai";
import { A2uiMessageListSchema } from "@a2ui/web_core/v0_9";
import {
  A2UI_CLOSE_TAG,
  A2UI_OPEN_TAG,
  A2UI_SYSTEM_PROMPT,
  TEXT_SYSTEM_PROMPT,
} from "./prompt.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export type ChatMessage = OpenAI.ChatCompletionMessageParam;

interface ToolCallResult {
  name: string;
  result: string;
}

export interface LlmResult {
  text: string;
  a2uiMessages?: unknown[];
  toolCalls: ToolCallResult[];
}

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_restaurants",
      description: "Get a list of restaurants based on cuisine and location.",
      parameters: {
        type: "object",
        properties: {
          cuisine: {
            type: "string",
            description:
              "The type of cuisine (e.g., chinese, italian, japanese)",
          },
          location: {
            type: "string",
            description:
              "The city or area to search in (e.g., New York, San Francisco)",
          },
          count: {
            type: "number",
            description: "Number of restaurants to return (default 5)",
          },
        },
        required: ["cuisine", "location"],
      },
    },
  },
];

function extractA2uiJson(text: string): {
  messages?: unknown[];
  error?: string;
} {
  const start = text.indexOf(A2UI_OPEN_TAG);
  const end = text.lastIndexOf(A2UI_CLOSE_TAG);
  if (start === -1 || end === -1 || end <= start) {
    return {
      error: `output is not wrapped in ${A2UI_OPEN_TAG}...${A2UI_CLOSE_TAG} tags`,
    };
  }
  const raw = text.slice(start + A2UI_OPEN_TAG.length, end).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      error: `invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const messages = Array.isArray(parsed) ? parsed : [parsed];
  const validationError = validateA2uiMessages(messages);
  if (validationError) return { error: validationError };
  return { messages };
}

function validateA2uiMessages(messages: unknown[]): string | null {
  const result = A2uiMessageListSchema.safeParse(messages);
  if (!result.success) {
    return result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  }
  return null;
}

async function complete(
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<OpenAI.ChatCompletion.Choice | undefined> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    tools: TOOLS,
    temperature: 0.2,
  });
  return response.choices[0];
}

/**
 * Runs one conversational turn. `history` carries prior turns for the same
 * contextId and is mutated to include this turn (user, assistant and tool
 * messages), so follow-up requests keep conversation state.
 */
export async function processQuery(
  query: string,
  history: OpenAI.ChatCompletionMessageParam[],
  mode: "a2ui" | "text",
  getRestaurantsFn: (
    cuisine: string,
    location: string,
    count: number,
  ) => string,
): Promise<LlmResult> {
  const systemPrompt =
    mode === "a2ui" ? A2UI_SYSTEM_PROMPT : TEXT_SYSTEM_PROMPT;
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: query },
  ];
  const historyStart = 1 + history.length;

  const toolCalls: ToolCallResult[] = [];
  let finalText = "";
  let maxRounds = 3;

  try {
    while (maxRounds-- > 0) {
      const choice = await complete(messages);
      if (!choice) {
        return { text: "No response from LLM", toolCalls };
      }

      const assistantMessage = choice.message;

      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== "function") continue;
          let result = "[]";
          if (toolCall.function.name === "get_restaurants") {
            const args = JSON.parse(toolCall.function.arguments || "{}");
            const cuisine = String(args.cuisine || "");
            const location = String(args.location || "");
            const count = Number(args.count) || 5;

            console.log(
              `[llm] Tool call: get_restaurants(${cuisine}, ${location}, ${count})`,
            );
            result = getRestaurantsFn(cuisine, location, count);
            toolCalls.push({ name: "get_restaurants", result });
          }
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue;
      }

      finalText = assistantMessage.content || "";
      messages.push({ role: "assistant", content: finalText });

      if (mode === "text") {
        return { text: finalText, toolCalls };
      }

      const extracted = extractA2uiJson(finalText);
      if (extracted.messages) {
        return { text: finalText, a2uiMessages: extracted.messages, toolCalls };
      }

      // One corrective retry, mirroring the upstream sample's
      // validation-and-retry loop.
      console.warn(
        `[llm] Invalid A2UI output (${extracted.error}), retrying once`,
      );
      messages.push({
        role: "user",
        content: `Your previous response was invalid: ${extracted.error}. Respond again with ONLY the corrected JSON array of A2UI v0.9 messages wrapped between ${A2UI_OPEN_TAG} and ${A2UI_CLOSE_TAG}.`,
      });

      const retryChoice = await complete(messages);
      const retryText = retryChoice?.message.content || "";
      messages.push({ role: "assistant", content: retryText });

      const retried = extractA2uiJson(retryText);
      if (retried.messages) {
        return { text: retryText, a2uiMessages: retried.messages, toolCalls };
      }

      console.error(`[llm] Retry still invalid: ${retried.error}`);
      return {
        text: "I'm sorry, I was unable to generate a valid UI for that request. Please try again.",
        toolCalls,
      };
    }

    return { text: finalText || "Processing complete.", toolCalls };
  } finally {
    history.push(...messages.slice(historyStart));
  }
}
