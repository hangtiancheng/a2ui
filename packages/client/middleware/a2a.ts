import { IncomingMessage, ServerResponse } from "http";
import type { Plugin, ViteDevServer } from "vite";
import * as crypto from "crypto";

const A2UI_MIME_TYPE = "application/a2ui+json";
const SERVER_URL = process.env["A2A_SERVER_URL"] || "http://localhost:10002";

const isJson = (str: string) => {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

export const plugin = (): Plugin => {
  return {
    name: "a2a-handler",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/a2a",
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== "POST") {
            next();
            return;
          }

          let originalBody = "";
          const MAX_PAYLOAD_SIZE = 1024 * 1024;

          req.on("data", (chunk: Buffer) => {
            originalBody += chunk.toString();
            if (originalBody.length > MAX_PAYLOAD_SIZE) {
              res.statusCode = 413;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Payload too large" }));
              req.destroy();
            }
          });

          req.on("end", async () => {
            if (res.writableEnded) return;

            let parts: Array<{
              kind: string;
              text?: string;
              data?: unknown;
              mimeType?: string;
            }>;

            if (isJson(originalBody)) {
              console.log("[a2a-middleware] Received JSON UI event:", originalBody);
              const clientEvent = JSON.parse(originalBody);
              parts = [
                {
                  kind: "data",
                  data: clientEvent,
                  mimeType: A2UI_MIME_TYPE,
                },
              ];
            } else {
              console.log("[a2a-middleware] Received text query:", originalBody);
              parts = [
                {
                  kind: "text",
                  text: originalBody,
                },
              ];
            }

            const contextIdHeader = req.headers["x-a2a-context-id"];
            const contextId =
              typeof contextIdHeader === "string" && contextIdHeader ? contextIdHeader : undefined;

            const messagePayload = {
              message: {
                messageId: crypto.randomUUID(),
                ...(contextId ? { contextId } : {}),
                role: "user",
                parts,
                kind: "message",
              },
            };

            try {
              const response = await fetch(`${SERVER_URL}/a2a`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-A2A-Extensions": "https://a2ui.org/a2a-extension/a2ui/v0.9",
                },
                body: JSON.stringify(messagePayload),
              });

              if (!response.ok) {
                const errText = await response.text();
                res.statusCode = response.status;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: errText || `Server error: ${response.status}`,
                  }),
                );
                return;
              }

              const contentType = response.headers.get("Content-Type") || "";

              if (contentType.includes("text/event-stream")) {
                res.statusCode = 200;
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (reader) {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (res.destroyed) break;
                    const text = decoder.decode(value, { stream: true });
                    res.write(text);
                  }
                }
                res.end();
              } else {
                const data = await response.json();
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-store");
                res.end(JSON.stringify(data));
              }
            } catch (e: unknown) {
              console.error("Error proxying to A2A server:", e);
              const errorMessage = e instanceof Error ? e.message : String(e);
              if (!res.headersSent) {
                res.statusCode = 502;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: errorMessage }));
              } else {
                res.write(`data: ${JSON.stringify([{ kind: "error", text: errorMessage }])}\n\n`);
                res.end();
              }
            }
          });
        },
      );
    },
  };
};
