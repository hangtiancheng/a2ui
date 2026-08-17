import type { Theme } from "@a2ui/react"

export interface AppConfig {
  key: string
  title: string
  heroImage?: string
  heroImageDark?: string
  placeholder: string
  loadingText?: string | string[]
  serverUrl?: string
  theme?: Theme
}
