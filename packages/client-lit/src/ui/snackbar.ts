import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type SnackbarMessage, type SnackbarUUID, SnackType } from "../types/types.js";
import { repeat } from "lit/directives/repeat.js";
import { SnackbarActionEvent } from "../events/events.js";
import { classMap } from "lit/directives/class-map.js";

const DEFAULT_TIMEOUT = 8000;

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

  static styles = [
    css`
      :host {
        --text-color: var(--n-0);
        --bb-body-medium: 16px;
        --bb-body-line-height-medium: 24px;

        display: flex;
        align-items: center;
        position: fixed;
        bottom: 28px;
        left: 50%;
        translate: -50% 0;
        opacity: 0;
        pointer-events: none;
        border-radius: 8px;
        background: var(--n-90);
        padding: 12px 24px;
        width: 60svw;
        max-width: 720px;
        z-index: 1800;
        scrollbar-width: none;
        overflow-x: scroll;
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--font-family, sans-serif);
      }

      :host([active]) {
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1) 0.2s;
        opacity: 1;
        pointer-events: auto;
      }

      :host([error]) {
        background: var(--e-95, #ffedea);
        --text-color: var(--e-40, #ba1a1a);
      }

      .g-icon {
        flex: 0 0 auto;
        color: var(--text-color);
        margin-right: 16px;

        &.rotate {
          animation: 1s linear 0s infinite normal forwards running rotate;
        }
      }

      #messages {
        color: var(--text-color);
        flex: 1 1 auto;
        margin-right: 44px;
      }

      #actions {
        flex: 0 1 auto;
        width: fit-content;
        margin-right: 12px;

        & button {
          font: 500 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--font-family, sans-serif);
          padding: 0;
          background: transparent;
          border: none;
          margin: 0 16px;
          color: var(--text-color);
          opacity: 0.7;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:not([disabled]) {
            cursor: pointer;
            &:hover,
            &:focus {
              opacity: 1;
            }
          }
        }
      }

      #close {
        display: flex;
        align-items: center;
        padding: 0;
        color: var(--text-color);
        background: transparent;
        border: none;
        margin: 0 0 0 8px;
        opacity: 0.7;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:not([disabled]) {
          cursor: pointer;
          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }
        to {
          rotate: 360deg;
        }
      }
    `,
  ];

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
  }

  render() {
    let rotate = false;
    let icon = "";
    for (let i = this.#messages.length - 1; i >= 0; i--) {
      if (!this.#messages[i].type || this.#messages[i].type === SnackType.NONE) continue;
      icon = this.#messages[i].type;
      if (this.#messages[i].type === SnackType.PENDING) {
        icon = "progress_activity";
        rotate = true;
      }
      break;
    }

    return html`
      ${icon ? html`<span class=${classMap({ "g-icon": true, rotate })}>${icon}</span>` : nothing}
      <div id="messages">
        ${repeat(
          this.#messages,
          (message) => message.id,
          (message) => html`<div>${message.message}</div>`,
        )}
      </div>
      <div id="actions">
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
        id="close"
        @click=${() => {
          this.hide();
          this.dispatchEvent(new SnackbarActionEvent("dismiss"));
        }}
      >
        <span class="g-icon">close</span>
      </button>
    `;
  }
}
