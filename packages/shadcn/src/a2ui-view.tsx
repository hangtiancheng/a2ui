/* eslint-disable react-refresh/only-export-components */
"use client";
import {
  Component,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderMarkdown } from "@a2ui/markdown-it";
import {
  A2uiSurface,
  MarkdownContext,
  type ReactComponentImplementation,
} from "@a2ui/react/v0_9";
import {
  type A2uiClientAction,
  type A2uiMessage,
  A2uiMessageSchema,
  MessageProcessor,
  type SurfaceModel,
} from "@a2ui/web_core/v0_9";

import { shadcnCatalog } from "./catalog";

export const UI_ACTION_PREFIX = "[UI_ACTION]";

export function buildQueryFromAction(action: A2uiClientAction): string {
  return `${UI_ACTION_PREFIX} ${action.name}\ncontext: ${JSON.stringify(action.context ?? {})}`;
}

export interface A2uiViewProps {
  messages: unknown[];
  onAction?: (query: string) => void;
  onRawAction?: (action: A2uiClientAction) => void;
}

class SurfaceErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[a2ui] surface render error:", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function A2uiView({ messages, onAction, onRawAction }: A2uiViewProps) {
  const onActionRef = useRef(onAction);
  const onRawActionRef = useRef(onRawAction);
  useEffect(() => {
    onActionRef.current = onAction;
    onRawActionRef.current = onRawAction;
  }, [onAction, onRawAction]);

  const validMessages = useMemo(() => {
    const valid: A2uiMessage[] = [];
    for (const message of messages) {
      const parsed = A2uiMessageSchema.safeParse(message);
      if (parsed.success) {
        valid.push(parsed.data);
      } else {
        console.error("[a2ui] dropping invalid message:", parsed.error.issues);
      }
    }
    return valid;
  }, [messages]);

  const processor = useMemo(
    () =>
      new MessageProcessor<ReactComponentImplementation>(
        [shadcnCatalog],
        // eslint-disable-next-line react-hooks/refs
        (action) => {
          if (onRawActionRef.current) {
            onRawActionRef.current(action);
          } else {
            onActionRef.current?.(buildQueryFromAction(action));
          }
        },
      ),
    [],
  );

  const [surfaces, setSurfaces] = useState<
    SurfaceModel<ReactComponentImplementation>[]
  >(() => Array.from(processor.model.surfacesMap.values()));

  const processedCount = useRef(0);

  useEffect(() => {
    const created = processor.onSurfaceCreated((surface) => {
      setSurfaces((prev) =>
        prev.some((s) => s.id === surface.id) ? prev : [...prev, surface],
      );
    });
    const deleted = processor.onSurfaceDeleted((id) => {
      setSurfaces((prev) => prev.filter((s) => s.id !== id));
    });
    if (validMessages.length > processedCount.current) {
      const pending = validMessages.slice(processedCount.current);
      processedCount.current = validMessages.length;
      try {
        processor.processMessages(pending);
      } catch (error) {
        console.error("[a2ui] failed to process messages:", error);
      }
    }
    return () => {
      created.unsubscribe();
      deleted.unsubscribe();
    };
  }, [processor, validMessages]);

  if (surfaces.length === 0) {
    return null;
  }
  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <SurfaceErrorBoundary>
        <div className="mt-3 flex flex-col gap-3">
          {surfaces.map((surface) => (
            <A2uiSurface key={surface.id} surface={surface} />
          ))}
        </div>
      </SurfaceErrorBoundary>
    </MarkdownContext.Provider>
  );
}
