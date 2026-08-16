const A2UI_MIME_TYPE = "application/a2ui+json";
const SERVER_URL = "http://localhost:10002";

export class A2UIClient {
  #serverUrl: string;
  #contextId: string | undefined;

  constructor(serverUrl: string = "") {
    this.#serverUrl = serverUrl || SERVER_URL;
  }

  async send(message: any | string): Promise<any[]> {
    let parts: Array<{
      kind: string;
      text?: string;
      data?: unknown;
      mimeType?: string;
    }>;

    if (typeof message === "string") {
      try {
        const parsed = JSON.parse(message);
        if (typeof parsed === "object" && parsed !== null) {
          parts = [{ kind: "data", data: parsed, mimeType: A2UI_MIME_TYPE }];
        } else {
          parts = [{ kind: "text", text: message }];
        }
      } catch {
        parts = [{ kind: "text", text: message }];
      }
    } else {
      parts = [{ kind: "data", data: message, mimeType: A2UI_MIME_TYPE }];
    }

    const payload = {
      message: {
        messageId: crypto.randomUUID(),
        ...(this.#contextId ? { contextId: this.#contextId } : {}),
        role: "user",
        parts,
        kind: "message",
      },
    };

    const response = await fetch(`${this.#serverUrl}/a2a`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-A2A-Extensions": "https://a2ui.org/a2a-extension/a2ui/v0.9",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `Server error: ${response.status}`);
    }

    const contentType = response.headers.get("Content-Type") || "";

    if (contentType.includes("text/event-stream")) {
      const messages: any[] = [];
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split(/\r?\n\r?\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              try {
                const parts = JSON.parse(dataStr);
                for (const part of parts) {
                  if (part.kind === "status-update" && part.contextId) {
                    this.#contextId = part.contextId;
                    continue;
                  }
                  if (part.kind === "data" && part.data) {
                    messages.push(part.data);
                  }
                }
              } catch (e) {
                console.error("Error parsing SSE chunk:", e);
              }
            }
          }
        }
      }
      return messages;
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const messages: any[] = [];
    if (Array.isArray(data)) {
      for (const part of data) {
        if (part.kind === "status-update" && part.contextId) {
          this.#contextId = part.contextId;
          continue;
        }
        if (part.kind === "data" && part.data) {
          messages.push(part.data);
        }
      }
    }
    return messages;
  }
}
