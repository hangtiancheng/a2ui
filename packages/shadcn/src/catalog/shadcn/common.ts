import { z } from "zod/v3";

import { ActionSchema, DynamicStringSchema } from "@a2ui/web_core/v0_9";

import { ICON_MAP } from "../components/icon";

// Shared `weight` prop, mirroring the basic catalog's CommonProps.
export const WEIGHT = {
  weight: z
    .number()
    .describe("Relative flex weight when placed inside a Row or Column.")
    .optional(),
};

export const ICON_NAME = z
  .enum(Object.keys(ICON_MAP) as [string, ...string[]])
  .describe("An icon name from the basic catalog icon set.");

export const MENU_ENTRY = z.object({
  label: DynamicStringSchema.describe("The label of the entry."),
  action: ActionSchema.optional(),
  variant: z.enum(["default", "destructive"]).optional(),
  disabled: z.boolean().optional(),
});
