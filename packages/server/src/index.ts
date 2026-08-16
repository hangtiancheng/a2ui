import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createAgentCard } from "./agent-card.js";
import { handleA2ARequest } from "./handler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || "10002", 10);
const HOST = process.env.HOST || "localhost";

app.use(
	cors({
		origin: /http:\/\/localhost:\d+/,
		credentials: true,
	}),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.text({ limit: "1mb", type: "text/plain" }));

app.get("/.well-known/agent-card.json", (_req, res) => {
	const baseUrl = `http://${HOST}:${PORT}`;
	res.json(createAgentCard(baseUrl));
});

app.post("/a2a", async (req, res) => {
	try {
		await handleA2ARequest(req, res);
	} catch (err) {
		console.error("[server] Unhandled error:", err);
		if (!res.headersSent) {
			res.status(500).json({
				error: err instanceof Error ? err.message : "Internal server error",
			});
		}
	}
});

const imagesDir = path.join(__dirname, "..", "images");
app.use("/static", express.static(imagesDir));

app.listen(PORT, HOST, () => {
	console.log(
		`[server] A2UI Restaurant Agent running at http://${HOST}:${PORT}`,
	);
	console.log(
		`[server] Agent card: http://${HOST}:${PORT}/.well-known/agent-card.json`,
	);
	console.log(`[server] Model: ${process.env.OPENAI_MODEL || "gpt-4o"}`);
	console.log(
		`[server] Base URL: ${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}`,
	);
});
