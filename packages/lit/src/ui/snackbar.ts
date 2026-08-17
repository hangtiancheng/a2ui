import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
  CircleX,
  createElement,
  type IconNode,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide";
import { type SnackbarMessage, type SnackbarUUID, SnackType } from "../types/types.js";
import { SnackbarActionEvent } from "../events/events.js";

const DEFAULT_TIMEOUT = 8000;

const TYPE_ICONS: Partial<Record<SnackType, IconNode>> = {
  [SnackType.INFORMATION]: Info,
  [SnackType.WARNING]: TriangleAlert,
  [SnackType.ERROR]: CircleX,
  [SnackType.PENDING]: LoaderCircle,
};

function icon(node: IconNode, classes: string) {
  const el = createElement(node);
  el.setAttribute("class", classes);
  return el;
}

@customElement("ui-snackbar")
export class Snackbar extends LitElement {
  @property({ reflect: true, type: Boolean })
  active = false;

  @property({ reflect: true, type: Boolean })
  error = false;

  @property()
  timeout = DEFAULT_TIMEOUT;

  #messages: SnackbarMessage[] = [];
  #timeout = 0;

  /* Render into light DOM so global Tailwind utilities apply. */
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.classList.add("contents");
  }

  show(message: SnackbarMessage, replaceAll = false) {
    const existingMessage = this.#messages.findIndex((msg) => msg.id === message.id);
    if (existingMessage === -1) {
      if (replaceAll) this.#messages.length = 0;
      this.#messages.push(message);
    } else {
      this.#messages[existingMessage] = message;
    }

    window.clearTimeout(this.#timeout);
    if (!this.#messages.every((msg) => msg.persistent)) {
      this.#timeout = window.setTimeout(() => this.hide(), this.timeout);
    }

    this.error = this.#messages.some((msg) => msg.type === SnackType.ERROR);
    this.active = true;
    this.requestUpdate();
    return message.id;
  }

  hide(id?: SnackbarUUID) {
    if (id) {
      const idx = this.#messages.findIndex((msg) => msg.id === id);
      if (idx !== -1) this.#messages.splice(idx, 1);
    } else {
      this.#messages.length = 0;
    }
    this.active = this.#messages.length !== 0;
    this.requestUpdate();
  }

  render() {
    let pending = false;
    let iconNode: IconNode | undefined;
    for (let i = this.#messages.length - 1; i >= 0; i--) {
      const type = this.#messages[i].type;
      if (!type || type === SnackType.NONE) continue;
      iconNode = TYPE_ICONS[type];
      pending = type === SnackType.PENDING;
      break;
    }

    const base =
      "fixed bottom-7 left-1/2 z-50 flex w-[60svw] max-w-2xl -translate-x-1/2 items-center rounded-lg px-6 py-3 text-base shadow-lg transition-opacity duration-300";
    const visibility = this.active ? "opacity-100" : "pointer-events-none opacity-0";
    const colors = this.error ? "bg-red-50 text-red-700" : "bg-slate-800 text-white";

    return html`
      <div class="${base} ${visibility} ${colors}">
        ${
          iconNode
            ? icon(iconNode, `mr-4 size-6 shrink-0 ${pending ? "animate-spin" : ""}`)
            : nothing
        }
        <div class="mr-11 flex-1">
          ${repeat(
            this.#messages,
            (message) => message.id,
            (message) => html`<div>${message.message}</div>`,
          )}
        </div>
        <div class="mr-3 w-fit">
          ${repeat(
            this.#messages,
            (message) => message.id,
            (message) => {
              if (!message.actions) return nothing;
              return html`${repeat(
                message.actions,
                (action) => action.title,
                (action) =>
                  html`<button
                    type="button"
                    class="mx-4 cursor-pointer border-none bg-transparent p-0 font-medium opacity-70 transition-opacity hover:opacity-100"
                    @click=${() => {
                      this.hide();
                      this.dispatchEvent(
                        new SnackbarActionEvent(action.action, action.value, action.callback),
                      );
                    }}
                  >
                    ${action.title}
                  </button>`,
              )}`;
            },
          )}
        </div>
        <button
          type="button"
          class="ml-2 flex shrink-0 cursor-pointer items-center border-none bg-transparent p-0 opacity-70 transition-opacity hover:opacity-100"
          @click=${() => {
            this.hide();
            this.dispatchEvent(new SnackbarActionEvent("dismiss"));
          }}
        >
          ${icon(X, "size-5")}
        </button>
      </div>
    `;
  }
}
