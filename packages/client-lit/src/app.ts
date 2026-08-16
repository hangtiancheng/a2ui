import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { createElement, type IconNode, Moon, SendHorizontal, Sun, X } from "lucide";
import { type SnackbarMessage, SnackType } from "./types/types.js";
import { Snackbar } from "./ui/snackbar.js";

import * as v0_9 from "@a2ui/web_core/v0_9";
import { basicCatalog, Context } from "@a2ui/lit/v0_9";
import { renderMarkdown } from "@a2ui/markdown-it";

import { A2UIClient } from "./client.js";
import { restaurantConfig, localConfig, type AppConfig } from "./configs/configs.js";

const configs: Record<string, AppConfig> = {
  restaurant: restaurantConfig,
  local: localConfig,
};

type MarkdownRendererFn = (value: string, options?: any) => Promise<string>;

function icon(node: IconNode, classes = "size-6") {
  const el = createElement(node);
  el.setAttribute("class", classes);
  return el;
}

@customElement("a2ui-shell")
export class A2UILayoutEditor extends SignalWatcher(LitElement) {
  @provide({ context: Context.markdown })
  markdownRenderer: MarkdownRendererFn = (value: string, options?: any) => {
    return Promise.resolve(renderMarkdown(value, options));
  };

  @state()
  private _requesting = false;

  @state()
  private _lastMessages: any[] = [];

  @state()
  config: AppConfig = restaurantConfig;

  @state()
  private _loadingTextIndex = 0;
  private _loadingInterval: number | undefined;

  @state()
  private _isLocalMode = false;

  @state()
  private _localFileName = "";

  @state()
  private _toastMessage = "";

  @state()
  private _toastType = "info";

  private _toastTimeout: number | undefined;

  @state()
  private _isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  private _processor = new v0_9.MessageProcessor(
    [basicCatalog],
    async (action: v0_9.A2uiClientAction): Promise<any> => {
      console.debug("Handling action", action);
      const context: Record<string, any> = { ...action.context };

      if (this._isLocalMode) {
        this.showToast(`Action dispatched: "${action.name}"`, "info");
        return;
      }

      const message = {
        version: "v0.9",
        action: {
          name: action.name,
          surfaceId: action.surfaceId,
          sourceComponentId: action.sourceComponentId,
          context,
        },
      };

      await this.#sendAndProcessMessage(message);
    },
  );

  private _a2uiClient!: A2UIClient;
  @query("ui-snackbar")
  private snackbar!: Snackbar;

  private _pendingSnackbarMessages: Array<{
    message: SnackbarMessage;
    replaceAll: boolean;
  }> = [];

  private _error: string | undefined;

  /* Render into light DOM so global Tailwind utilities apply. */
  createRenderRoot() {
    return this;
  }

  #maybeRenderError() {
    if (!this._error) return nothing;
    return html`<div
      class="mt-6 w-full rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      ${this._error}
    </div>`;
  }

  connectedCallback() {
    super.connectedCallback();

    this.className =
      "relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center px-4 pb-8 text-slate-900 dark:text-slate-100";

    if (this._isDarkMode) {
      document.body.classList.add("dark");
    }

    const urlParams = new URLSearchParams(window.location.search);
    const appKey = urlParams.get("app");
    if (appKey && !configs[appKey]) {
      this._pendingSnackbarMessages.push({
        message: {
          id: crypto.randomUUID(),
          message: `App "${appKey}" is not available. Falling back to Restaurant Finder.`,
          type: SnackType.WARNING,
          persistent: false,
        },
        replaceAll: false,
      });
    }
    this.config = (appKey && configs[appKey]) || restaurantConfig;

    if (
      this.config.cssOverrides &&
      !document.adoptedStyleSheets.includes(this.config.cssOverrides)
    ) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.config.cssOverrides];
    }
    document.title = this.config.title;

    this._a2uiClient = new A2UIClient(this.config.serverUrl);
  }

  protected firstUpdated() {
    if (this._pendingSnackbarMessages.length > 0) {
      for (const { message, replaceAll } of this._pendingSnackbarMessages) {
        this.snackbar.show(message, replaceAll);
      }
      this._pendingSnackbarMessages = [];
    }
  }

  render() {
    return [
      this.#renderLocalModeHeader(),
      this.#renderThemeToggle(),
      this.#maybeRenderForm(),
      this.#maybeRenderData(),
      this.#maybeRenderError(),
      this.#renderToast(),
      html`<ui-snackbar></ui-snackbar>`,
    ];
  }

  #renderLocalModeHeader() {
    if (!this._isLocalMode) return nothing;
    return html`
      <div
        class="mb-6 flex w-full items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 dark:border-slate-600 dark:bg-slate-800"
      >
        <span class="flex items-center gap-2 text-sm text-indigo-900 dark:text-slate-100">
          Loaded local mockup: <strong>${this._localFileName}</strong>
        </span>
        <button
          type="button"
          class="flex cursor-pointer items-center rounded-full p-1 text-indigo-800 transition-colors hover:bg-indigo-100 dark:text-slate-100 dark:hover:bg-slate-700"
          @click=${this.#clearLocalFile}
          title="Clear local mockup"
        >
          ${icon(X, "size-5")}
        </button>
      </div>
    `;
  }

  #toggleDarkMode() {
    this._isDarkMode = !this._isDarkMode;
    document.body.classList.toggle("dark", this._isDarkMode);
    document.body.classList.toggle("light", !this._isDarkMode);
  }

  #renderThemeToggle() {
    return html`<button
      type="button"
      class="fixed top-3 right-4 z-10 flex size-12 cursor-pointer items-center justify-center rounded-full bg-white text-indigo-700 shadow-md transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      @click=${this.#toggleDarkMode}
    >
      ${icon(this._isDarkMode ? Sun : Moon)}
    </button>`;
  }

  #maybeRenderForm() {
    if (this._requesting) return nothing;
    if (this._lastMessages.length > 0) return nothing;
    if (this._isLocalMode) return nothing;

    if (this.config.key === "local") {
      return html`
        <div class="mt-16 mb-8 flex flex-col items-center text-center">
          <h1 class="mb-4 text-4xl font-bold tracking-tight text-indigo-900 dark:text-slate-100">
            ${this.config.title}
          </h1>
          <p class="mb-3 max-w-xl text-base leading-relaxed text-slate-700 dark:text-slate-200">
            Upload an A2UI JSON mockup file to render and test your interactive layouts locally.
          </p>
          <p class="max-w-xl text-sm leading-normal text-slate-500 dark:text-slate-400">
            Supports A2UI Protocol v0.9. Only supports the basic catalog for now.
          </p>
        </div>
        <div
          class="mx-auto mb-16 flex w-full max-w-xl flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-indigo-400 bg-white/60 p-12 text-center dark:border-slate-600 dark:bg-slate-800/60"
        >
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 font-medium text-white shadow-md transition hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-lg"
            @click=${this.#triggerFileUpload}
          >
            Browse JSON File
          </button>
          <input
            type="file"
            accept=".json"
            id="local-file-input"
            class="hidden"
            @change=${this.#onLocalFileChange}
          />
          <div class="mt-6 w-full border-t border-slate-200 pt-5 dark:border-slate-700">
            <h3 class="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              Or quick-load a built-in sample:
            </h3>
            <div class="grid w-full grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
              <button
                type="button"
                class="cursor-pointer rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-indigo-800 transition-colors hover:border-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                @click=${() => this.#loadBuiltinSample("contact_card.json")}
              >
                Contact Card
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-indigo-800 transition-colors hover:border-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                @click=${() => this.#loadBuiltinSample("workspace_settings.json")}
              >
                Workspace Setup
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return html`<form
      class="flex w-full flex-1 flex-col items-center justify-center gap-6 py-8"
      @submit=${async (evt: Event) => {
        evt.preventDefault();
        if (!(evt.target instanceof HTMLFormElement)) return;
        const data = new FormData(evt.target);
        const body = data.get("body") ?? null;
        if (!body) return;
        await this.#sendAndProcessMessage(body as any);
      }}
    >
      ${
        this.config.heroImage
          ? html`<div
              style=${styleMap({
                "--background-image-light": `url(${this.config.heroImage})`,
                "--background-image-dark": `url(${this.config.heroImageDark ?? this.config.heroImage})`,
              })}
              class="aspect-video w-full max-w-md bg-contain bg-center bg-no-repeat [background-image:var(--background-image-light)] dark:[background-image:var(--background-image-dark)]"
            ></div>`
          : nothing
      }
      <h1 class="text-4xl font-bold tracking-tight text-indigo-900 dark:text-slate-100">
        ${this.config.title}
      </h1>
      <div class="flex w-full items-center gap-4">
        <input
          required
          value="${this.config.placeholder}"
          autocomplete="off"
          id="body"
          name="body"
          type="text"
          ?disabled=${this._requesting}
          class="min-w-0 flex-1 rounded-full border border-indigo-300 bg-white px-6 py-4 text-base text-slate-900 placeholder:text-slate-400 disabled:opacity-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          ?disabled=${this._requesting}
          class="flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ${icon(SendHorizontal)}
        </button>
      </div>
    </form>`;
  }

  #startLoadingAnimation() {
    const loadingText = this.config.loadingText;
    if (loadingText && loadingText.length > 1) {
      this._loadingTextIndex = 0;
      this._loadingInterval = window.setInterval(() => {
        this._loadingTextIndex = (this._loadingTextIndex + 1) % loadingText.length;
      }, 2000);
    }
  }

  #stopLoadingAnimation() {
    if (this._loadingInterval) {
      clearInterval(this._loadingInterval);
      this._loadingInterval = undefined;
    }
  }

  async #sendMessage(message: any): Promise<any[]> {
    try {
      this._requesting = true;
      this.#startLoadingAnimation();
      const response = await this._a2uiClient.send(message);
      this._requesting = false;
      this.#stopLoadingAnimation();
      return response;
    } catch (err) {
      console.error(err);
      this._error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      this._requesting = false;
      this.#stopLoadingAnimation();
    }
    return [];
  }

  #maybeRenderData() {
    if (this._requesting) {
      const text = this.config.loadingText
        ? this.config.loadingText[this._loadingTextIndex]
        : "Awaiting an answer...";
      return html`<div
        class="flex min-h-52 w-full flex-1 flex-col items-center justify-center gap-4"
      >
        <div
          class="size-12 animate-spin rounded-full border-4 border-indigo-200 border-l-indigo-600 dark:border-slate-700 dark:border-l-indigo-400"
        ></div>
        <div class="text-slate-600 dark:text-slate-300">${text}</div>
      </div>`;
    }

    const surfaces = Array.from(this._processor.model.surfacesMap.entries());
    if (surfaces.length === 0) return nothing;

    return html`<section class="w-full py-3">
      ${repeat(
        surfaces,
        ([surfaceId]) => surfaceId,
        ([, surface]) => html`<a2ui-surface .surface=${surface}></a2ui-surface>`,
      )}
    </section>`;
  }

  async #sendAndProcessMessage(request: any) {
    const messages = await this.#sendMessage(request);
    this._lastMessages = messages;

    for (const surfaceId of Array.from(this._processor.model.surfacesMap.keys())) {
      this._processor.model.deleteSurface(surfaceId);
    }

    this._processor.processMessages(messages);
  }

  #triggerFileUpload() {
    const fileInput = this.renderRoot.querySelector("#local-file-input") as HTMLInputElement;
    if (fileInput) fileInput.click();
  }

  #onLocalFileChange(evt: Event) {
    const fileInput = evt.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    this._localFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        const messages = Array.isArray(parsed) ? parsed : [parsed];
        this._isLocalMode = true;
        for (const surfaceId of Array.from(this._processor.model.surfacesMap.keys())) {
          this._processor.model.deleteSurface(surfaceId);
        }
        this._processor.processMessages(messages);
        this.showToast(`Successfully loaded mockup from ${file.name}`, "info");
      } catch (err) {
        this.showToast(
          `Failed to parse A2UI JSON: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    };
    reader.readAsText(file);
    fileInput.value = "";
  }

  #clearLocalFile() {
    this._isLocalMode = false;
    this._localFileName = "";
    for (const surfaceId of Array.from(this._processor.model.surfacesMap.keys())) {
      this._processor.model.deleteSurface(surfaceId);
    }
    this.showToast("Local mockup cleared.", "info");
  }

  async #loadBuiltinSample(filename: string) {
    try {
      this._localFileName = filename;
      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) throw new Error(`Failed to fetch sample: ${response.statusText}`);
      const parsed = await response.json();
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      this._isLocalMode = true;
      for (const surfaceId of Array.from(this._processor.model.surfacesMap.keys())) {
        this._processor.model.deleteSurface(surfaceId);
      }
      this._processor.processMessages(messages);
      this.showToast(`Successfully loaded sample: ${filename}`, "info");
    } catch (err) {
      this.showToast(
        `Failed to load sample: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    }
  }

  #renderToast() {
    if (!this._toastMessage) return nothing;
    const colors =
      this._toastType === "error"
        ? "border-white/20 bg-red-800/90"
        : "border-white/10 bg-slate-900/90";
    return html`
      <div
        class="fixed bottom-6 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-4 rounded-2xl border px-7 py-3.5 text-white shadow-2xl backdrop-blur-xl ${colors}"
      >
        <span class="text-sm font-medium">${this._toastMessage}</span>
        <button
          type="button"
          class="flex cursor-pointer items-center rounded-full p-0.5 opacity-70 transition-opacity hover:bg-white/15 hover:opacity-100"
          @click=${() => (this._toastMessage = "")}
        >
          ${icon(X, "size-5")}
        </button>
      </div>
    `;
  }

  showToast(msg: string, type = "info") {
    if (this._toastTimeout) window.clearTimeout(this._toastTimeout);
    this._toastMessage = msg;
    this._toastType = type;
    this._toastTimeout = window.setTimeout(() => {
      this._toastMessage = "";
      this._toastTimeout = undefined;
    }, 4000);
  }
}
