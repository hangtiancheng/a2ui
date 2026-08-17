import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SyntheticEvent,
} from "react"

import type { A2uiClientAction, A2uiMessage } from "@a2ui/web_core/v0_9"
import { CircleAlert, Moon, SendHorizontal, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { A2uiView } from "./a2ui-view"
import { A2UIClient } from "./client"
import { type AppConfig, galleryConfig, restaurantConfig } from "./configs"
import {
  createBookingFormMessages,
  createConfirmationMessages,
  createGalleryMessages,
  createRestaurantListMessages,
} from "./mock"

const configs: Record<string, AppConfig> = {
  restaurant: restaurantConfig,
  gallery: galleryConfig,
}

const urlParams = new URLSearchParams(window.location.search)
const isMockMode = urlParams.get("mock") === "true"

export function App() {
  const config = useMemo(() => {
    const appKey = urlParams.get("app") || "restaurant"
    return configs[appKey] || configs.restaurant
  }, [])

  const client = useMemo(() => new A2UIClient(), [])

  useEffect(() => {
    document.title = config.title
  }, [config])

  return <ShellContent config={config} client={client} />
}

interface ShellContentProps {
  config: AppConfig
  client: A2UIClient
}

function ShellContent({ config, client }: ShellContentProps) {
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<A2uiMessage[]>([])
  const [loadingTextIndex, setLoadingTextIndex] = useState(0)
  const [requestCount, setRequestCount] = useState(0)
  const { theme, setTheme } = useTheme()

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  useEffect(() => {
    if (!requesting) return
    if (!Array.isArray(config.loadingText) || config.loadingText.length <= 1)
      return

    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % config.loadingText!.length)
    }, 2000)

    return () => clearInterval(interval)
  }, [requesting, config.loadingText])

  const getMockResponse = useCallback(
    (message: { action?: A2uiClientAction } | string): A2uiMessage[] => {
      if (config.key === "gallery") {
        return createGalleryMessages()
      }

      if (typeof message === "object" && "action" in message && message.action) {
        const action = message.action
        const context = action.context || {}

        if (action.name === "book_restaurant") {
          return createBookingFormMessages(
            String(context.restaurantName || "Restaurant"),
            String(context.imageUrl || ""),
            String(context.address || "")
          )
        }

        if (action.name === "submit_booking") {
          return createConfirmationMessages(
            String(context.restaurantName || "Restaurant"),
            String(context.partySize || "2"),
            String(context.reservationTime || ""),
            String(context.dietary || ""),
            String(context.imageUrl || "")
          )
        }
      }

      return createRestaurantListMessages()
    },
    [config.key]
  )

  const sendAndProcess = useCallback(
    async (message: { version: "v0.9"; action: A2uiClientAction } | string) => {
      try {
        setRequesting(true)
        setError(null)
        setLoadingTextIndex(0)
        setMessages([])
        setRequestCount((c) => c + 1)

        if (isMockMode) {
          await new Promise((resolve) => setTimeout(resolve, 800))
          const response = getMockResponse(message)
          setMessages(response)
        } else {
          const response = await client.send(message, (chunkMessages) => {
            setMessages((prev) => [...prev, ...chunkMessages])
          })
          setMessages(response)
        }
      } catch (err) {
        console.error("Error sending message:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setRequesting(false)
      }
    },
    [client, getMockResponse]
  )

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      const body = formData.get("body") as string
      if (!body) return
      sendAndProcess(body)
    },
    [sendAndProcess]
  )

  const loadingText = useMemo(() => {
    if (!config.loadingText) return "Awaiting an answer..."
    if (Array.isArray(config.loadingText)) {
      return config.loadingText[loadingTextIndex]
    }
    return config.loadingText
  }, [config.loadingText, loadingTextIndex])

  const hasSurfaces = messages.length > 0
  const showForm = !requesting && messages.length === 0

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center px-4 pb-8">
      {isMockMode && (
        <Badge variant="secondary" className="fixed top-6 left-4 z-10">
          Mock Mode
        </Badge>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="fixed top-4 right-4 z-10 rounded-full"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <Sun /> : <Moon />}
      </Button>

      {showForm && (
        <form
          className="flex w-full flex-1 flex-col items-center justify-center gap-6 py-8"
          onSubmit={handleSubmit}
        >
          {config.heroImage && (
            <div
              className="aspect-video w-full max-w-md [background-image:var(--background-image-light)] bg-contain bg-center bg-no-repeat dark:[background-image:var(--background-image-dark)]"
              style={
                {
                  "--background-image-light": `url(${config.heroImage})`,
                  "--background-image-dark": `url(${config.heroImageDark || config.heroImage})`,
                } as React.CSSProperties
              }
            />
          )}
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            {config.title}
          </h1>
          <InputGroup className="h-12 rounded-full">
            <InputGroupInput
              required
              defaultValue={config.placeholder}
              autoComplete="off"
              id="body"
              name="body"
              type="text"
              disabled={requesting}
              className="px-4"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-sm"
                className="rounded-full"
                disabled={requesting}
              >
                <SendHorizontal />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      )}

      {requesting && (
        <div className="flex min-h-52 w-full flex-1 flex-col items-center justify-center gap-4">
          <Spinner className="size-8" />
          <div className="text-muted-foreground">{loadingText}</div>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-6">
          <CircleAlert />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      {hasSurfaces && (
        <section className="w-full py-3">
          <A2uiView
            key={requestCount}
            messages={messages}
            onRawAction={(action) =>
              sendAndProcess({ version: "v0.9", action })
            }
          />
        </section>
      )}
    </div>
  )
}

export default App
