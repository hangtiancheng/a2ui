import type { HTMLTemplateResult } from "lit";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class SnackbarActionEvent extends Event {
  static eventName = "snackbar-action";

  constructor(
    public readonly action: string,
    public readonly value?: HTMLTemplateResult | string,
    public readonly callback?: () => void,
  ) {
    super(SnackbarActionEvent.eventName, { ...eventInit });
  }
}
