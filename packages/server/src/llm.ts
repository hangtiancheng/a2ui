import OpenAI from "openai";
import {
	buildBookingFormA2ui,
	buildConfirmationA2ui,
	buildRestaurantListA2ui,
} from "./a2ui-messages.js";

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

const A2UI_OPEN_TAG = "<a2ui-json>";
const A2UI_CLOSE_TAG = "</a2ui-json>";

const EXAMPLE_RESTAURANTS = [
	{
		name: "Golden Dragon",
		detail: "Hand-pulled noodles and dumplings.",
		imageUrl: "http://localhost:10002/static/noodles.jpeg",
		rating: "★★★★☆",
		infoLink: "[More Info](https://example.com/golden-dragon)",
		address: "12 Mott St, New York, NY 10013",
	},
	{
		name: "Jade Garden",
		detail: "Classic Cantonese dim sum.",
		imageUrl: "http://localhost:10002/static/dimsum.jpeg",
		rating: "★★★★★",
		infoLink: "[More Info](https://example.com/jade-garden)",
		address: "88 Canal St, New York, NY 10002",
	},
];

function renderExample(name: string, messages: unknown[]): string {
	return `---BEGIN ${name}---\n${A2UI_OPEN_TAG}\n${JSON.stringify(messages)}\n${A2UI_CLOSE_TAG}\n---END ${name}---`;
}

const A2UI_SYSTEM_PROMPT = `You are a helpful restaurant finding assistant. Your final output MUST be an A2UI UI definition.

## Workflow
1. For a restaurant search query, first call the get_restaurants tool with the cuisine, location and count extracted from the query.
2. Then reply with ONLY a JSON array of A2UI v0.9 messages wrapped between ${A2UI_OPEN_TAG} and ${A2UI_CLOSE_TAG}. No prose outside the tags.
3. Order the messages top-down for streaming: createSurface first, then updateComponents with the "root" component first, then updateDataModel.
4. Copy tool results verbatim into the data model — never invent restaurants. If the tool returns an empty array, render a surface with a single Text component apologizing that no restaurants were found for that location.

## UI rules
- Restaurant search results: follow RESTAURANT_LIST_EXAMPLE (surfaceId "default"); each card's button fires the "book_restaurant" action.
- Query starting with "USER_WANTS_TO_BOOK": follow BOOKING_FORM_EXAMPLE (surfaceId "booking-form"); the submit button fires the "submit_booking" action.
- Query starting with "User submitted a booking": follow CONFIRMATION_EXAMPLE (surfaceId "confirmation").
- Always use catalogId "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json".

### Examples:
${renderExample(
	"RESTAURANT_LIST_EXAMPLE",
	buildRestaurantListA2ui(
		"Top 2 Chinese Restaurants in New York",
		EXAMPLE_RESTAURANTS,
	),
)}
${renderExample(
	"BOOKING_FORM_EXAMPLE",
	buildBookingFormA2ui(
		"Golden Dragon",
		"http://localhost:10002/static/noodles.jpeg",
		"12 Mott St, New York, NY 10013",
	),
)}
${renderExample(
	"CONFIRMATION_EXAMPLE",
	buildConfirmationA2ui(
		"Golden Dragon",
		"4",
		"2026-08-20T19:00",
		"Vegetarian",
		"http://localhost:10002/static/noodles.jpeg",
	),
)}`;

const TEXT_SYSTEM_PROMPT = `You are a helpful restaurant finding assistant. You help users find restaurants based on their criteria (cuisine, location, count).

When the user asks for restaurants:
1. Extract the cuisine type, location, and number of restaurants they want.
2. Call the get_restaurants tool with those parameters.
3. After getting results, summarize them briefly.

When the user wants to book a restaurant (query starts with "USER_WANTS_TO_BOOK"):
- Respond acknowledging the booking request.

When the user submits a booking (query starts with "User submitted a booking"):
- Respond with a confirmation message.

Always be concise and helpful.`;

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

const MESSAGE_KEYS = [
	"createSurface",
	"updateComponents",
	"updateDataModel",
	"deleteSurface",
] as const;

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
	if (messages.length === 0) return "the A2UI message array is empty";

	let hasCreateSurface = false;
	for (const [i, msg] of messages.entries()) {
		if (typeof msg !== "object" || msg === null) {
			return `message ${i} is not an object`;
		}
		const m = msg as Record<string, unknown>;
		if (m.version !== "v0.9") {
			return `message ${i} is missing version: "v0.9"`;
		}
		const keys = MESSAGE_KEYS.filter((k) => m[k] !== undefined);
		if (keys.length !== 1) {
			return `message ${i} must contain exactly one of ${MESSAGE_KEYS.join(", ")}`;
		}
		const payload = m[keys[0]] as Record<string, unknown>;
		if (typeof payload !== "object" || payload === null) {
			return `message ${i} ${keys[0]} payload is not an object`;
		}
		if (typeof payload.surfaceId !== "string" || !payload.surfaceId) {
			return `message ${i} ${keys[0]} is missing surfaceId`;
		}
		if (keys[0] === "createSurface") {
			hasCreateSurface = true;
			if (typeof payload.catalogId !== "string") {
				return `message ${i} createSurface is missing catalogId`;
			}
		}
		if (keys[0] === "updateComponents") {
			const components = payload.components;
			if (!Array.isArray(components) || components.length === 0) {
				return `message ${i} updateComponents.components must be a non-empty array`;
			}
			for (const c of components) {
				if (
					typeof c !== "object" ||
					c === null ||
					typeof (c as Record<string, unknown>).id !== "string" ||
					typeof (c as Record<string, unknown>).component !== "string"
				) {
					return `message ${i} has a component without string id/component fields`;
				}
			}
		}
		if (keys[0] === "updateDataModel" && typeof payload.path !== "string") {
			return `message ${i} updateDataModel is missing path`;
		}
	}

	if (!hasCreateSurface) {
		return "the response must contain a createSurface message";
	}
	return null;
}

async function complete(
	messages: ChatMessage[],
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
	history: ChatMessage[],
	mode: "a2ui" | "text",
	getRestaurantsFn: (
		cuisine: string,
		location: string,
		count: number,
	) => string,
): Promise<LlmResult> {
	const systemPrompt =
		mode === "a2ui" ? A2UI_SYSTEM_PROMPT : TEXT_SYSTEM_PROMPT;
	const messages: ChatMessage[] = [
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
