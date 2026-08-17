import type { A2uiMessage, A2uiClientMessage } from "@a2ui/web_core/v0_9"

interface Part {
  kind: "data" | "text" | "error" | "status-update"
  data?: Record<string, unknown>
  text?: string
  mimeType?: string
  contextId?: string
}

export class A2UIClient {
  #contextId: string | undefined

  get ready() {
    return Promise.resolve()
  }

  async send(
    message: A2uiClientMessage | string,
    onChunk?: (messages: A2uiMessage[]) => void
  ): Promise<A2uiMessage[]> {
    const body = typeof message === "string" ? message : JSON.stringify(message)

    const response = await fetch("/a2a", {
      method: "POST",
      headers: this.#contextId
        ? { "X-A2A-Context-Id": this.#contextId }
        : undefined,
      body: body,
    })

    if (
      !response.ok &&
      !response.headers.get("Content-Type")?.includes("application/json")
    ) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get("Content-Type")
    const allMessages: A2uiMessage[] = []
    const seenSurfaceIds = new Set<string>()

    if (contentType?.includes("text/event-stream")) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split(/\r?\n\r?\n/)
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6)
              try {
                const parts = JSON.parse(dataStr) as Part[]
                const chunkMessages: A2uiMessage[] = []
                for (const part of parts) {
                  if (part.kind === "status-update" && part.contextId) {
                    this.#contextId = part.contextId
                    continue
                  }
                  if (part.kind === "error") {
                    throw new Error(part.text)
                  }
                  if (part.kind === "data" && part.data) {
                    const uiMessage = part.data as unknown as A2uiMessage
                    const createSurface = (
                      uiMessage as { createSurface?: { surfaceId: string } }
                    ).createSurface
                    if (createSurface) {
                      if (seenSurfaceIds.has(createSurface.surfaceId)) continue
                      seenSurfaceIds.add(createSurface.surfaceId)
                    }
                    chunkMessages.push(uiMessage)
                  }
                }
                if (chunkMessages.length > 0) {
                  allMessages.push(...chunkMessages)
                  onChunk?.(chunkMessages)
                }
              } catch (e) {
                console.error("Error processing SSE chunk:", e)
              }
            }
          }
        }
      }
    } else {
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      const parts = data as Part[]
      for (const part of parts) {
        if (part.kind === "status-update" && part.contextId) {
          this.#contextId = part.contextId
          continue
        }
        if (part.kind === "data" && part.data) {
          allMessages.push(part.data as unknown as A2uiMessage)
        }
      }
    }

    return allMessages
  }
}
