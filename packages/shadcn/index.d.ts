import type { ReactComponentImplementation } from "@a2ui/react/v0_9"
import type { Catalog } from "@a2ui/web_core/v0_9"
import type { A2uiClientAction } from "@a2ui/web_core/v0_9"

export declare const BASIC_CATALOG_ID: string
export declare const shadcnCatalog: Catalog<ReactComponentImplementation>

export declare const UI_ACTION_PREFIX: string
export declare function buildQueryFromAction(action: A2uiClientAction): string

export interface A2uiViewProps {
  messages: unknown[]
  onAction?: (query: string) => void
  onRawAction?: (action: A2uiClientAction) => void
}
export declare function A2uiView(props: A2uiViewProps): React.JSX.Element | null
