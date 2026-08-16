import type { Request, Response } from "express";
import { v4 as uuidV4 } from "uuid";
import {
	buildBookingFormA2ui,
	buildConfirmationA2ui,
	buildRestaurantListA2ui,
} from "./a2ui-messages.js";
import { processQuery } from "./llm.js";
import { getRestaurants } from "./tools.js";

interface A2AMessage {
	messageId: string;
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

	console.log(`[handler] Processing query: "${query}"`);
	console.log(`[handler] A2UI mode: ${useA2ui}`);

	const taskId = uuidV4();
	const contextId = uuidV4();

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.status(200);

	try {
		if (useA2ui) {
			await handleA2uiStream(query, uiAction, res, taskId, contextId);
		} else {
			await handleTextStream(query, res, taskId, contextId);
		}
	} catch (err) {
		console.error("[handler] Stream error:", err);
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		res.write(
			`data: ${JSON.stringify([{ kind: "error", text: errorMsg }])}\n\n`,
		);
		res.end();
	}
}

async function handleA2uiStream(
	query: string,
	uiAction: { name: string; context: Record<string, unknown> } | null,
	res: Response,
	taskId: string,
	contextId: string,
): Promise<void> {
	let a2uiMessages: unknown[];

	if (uiAction?.name === "book_restaurant") {
		const ctx = uiAction.context;
		a2uiMessages = buildBookingFormA2ui(
			String(ctx.restaurantName || "Restaurant"),
			String(ctx.imageUrl || ""),
			String(ctx.address || ""),
		);
		sendSseParts(res, a2uiMessages);
		sendStatusUpdate(res, "input-required", taskId, contextId);
		res.end();
		return;
	}

	if (uiAction?.name === "submit_booking") {
		const ctx = uiAction.context;
		a2uiMessages = buildConfirmationA2ui(
			String(ctx.restaurantName || "Restaurant"),
			String(ctx.partySize || "2"),
			String(ctx.reservationTime || ""),
			String(ctx.dietary || ""),
			String(ctx.imageUrl || ""),
		);
		sendSseParts(res, a2uiMessages);
		sendStatusUpdate(res, "completed", taskId, contextId, true);
		res.end();
		return;
	}

	const llmResult = await processQuery(query, getRestaurants);

	if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
		const restaurantData = JSON.parse(llmResult.toolCalls[0].result);
		const title = llmResult.title || "Found Restaurants";
		a2uiMessages = buildRestaurantListA2ui(title, restaurantData);
	} else {
		const restaurants = getRestaurants("chinese", "new york", 5);
		const parsed = JSON.parse(restaurants);
		a2uiMessages = buildRestaurantListA2ui(
			llmResult.title || "Top Chinese Restaurants in New York",
			parsed,
		);
	}

	sendSseParts(res, a2uiMessages);
	sendStatusUpdate(res, "input-required", taskId, contextId);
	res.end();
}

async function handleTextStream(
	query: string,
	res: Response,
	taskId: string,
	contextId: string,
): Promise<void> {
	const llmResult = await processQuery(query, getRestaurants);

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
