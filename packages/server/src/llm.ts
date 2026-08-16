import OpenAI from "openai";

const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || "",
	baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

interface ToolCallResult {
	name: string;
	result: string;
}

interface LlmResult {
	text: string;
	title?: string;
	toolCalls: ToolCallResult[];
}

const SYSTEM_PROMPT = `You are a helpful restaurant finding assistant. You help users find restaurants based on their criteria (cuisine, location, count).

When the user asks for restaurants:
1. Extract the cuisine type, location, and number of restaurants they want.
2. Call the get_restaurants tool with those parameters.
3. After getting results, provide a brief summary title like "Top 5 Chinese Restaurants in New York".

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

export async function processQuery(
	query: string,
	getRestaurantsFn: (
		cuisine: string,
		location: string,
		count: number,
	) => string,
): Promise<LlmResult> {
	const messages: OpenAI.ChatCompletionMessageParam[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		{ role: "user", content: query },
	];

	const toolCalls: ToolCallResult[] = [];
	let title = "";
	let maxRounds = 3;

	while (maxRounds-- > 0) {
		const response = await client.chat.completions.create({
			model: MODEL,
			messages,
			tools: TOOLS,
			temperature: 0.7,
		});

		const choice = response.choices[0];
		if (!choice) {
			return { text: "No response from LLM", toolCalls };
		}

		const assistantMessage = choice.message;

		if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
			messages.push(assistantMessage);

			for (const toolCall of assistantMessage.tool_calls) {
				if (toolCall.type !== "function") continue;
				if (toolCall.function.name === "get_restaurants") {
					const args = JSON.parse(toolCall.function.arguments);
					const cuisine = args.cuisine || "chinese";
					const location = args.location || "new york";
					const count = args.count || 5;

					console.log(
						`[llm] Tool call: get_restaurants(${cuisine}, ${location}, ${count})`,
					);
					const result = getRestaurantsFn(cuisine, location, count);
					toolCalls.push({ name: "get_restaurants", result });

					messages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: result,
					});
				}
			}
			continue;
		}

		const text = assistantMessage.content || "";

		const titleMatch = text.match(
			/(?:top|best|found)\s+(\d+\s+)?(.+?)(?:\s+in\s+|\s+at\s+)(.+)/i,
		);
		if (titleMatch) {
			title = text
				.split("\n")[0]
				.replace(/^[#\s*]+/, "")
				.trim();
		}
		if (!title && toolCalls.length > 0) {
			title = "Restaurant Recommendations";
		}

		return { text, title, toolCalls };
	}

	return { text: "Processing complete.", title, toolCalls };
}
