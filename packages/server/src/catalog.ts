import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  applySchemaModifiers,
  COMMON_TYPES_SCHEMA,
  removeStrictValidation,
  SERVER_TO_CLIENT_SCHEMA,
  SHADCN_PROMPT_CATALOG,
  type A2uiCatalogSchemas,
  type JsonObject,
} from "@swifty.js/a2ui-shadcn/prompt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

/**
 * Default ("react") mode serves the official basic catalog fetched to the repo
 * root by `postinstall.sh`; "shadcn" mode serves the catalog embedded in
 * `@swifty.js/a2ui-shadcn/prompt` (the v0.9 protocol schemas always come from
 * the package).
 */
function loadCatalog(): A2uiCatalogSchemas {
  if (process.env.A2UI_MODE === "shadcn") return SHADCN_PROMPT_CATALOG;
  const raw = fs.readFileSync(path.join(REPO_ROOT, "catalog.json"), "utf-8");
  return {
    s2cSchema: SERVER_TO_CLIENT_SCHEMA,
    commonTypesSchema: COMMON_TYPES_SCHEMA,
    catalogSchema: JSON.parse(raw) as JsonObject,
  };
}

/**
 * Closed-object constraints make the LLM output fail validation on harmless
 * extra keys, so the schemas handed to the model drop them (port of
 * `a2ui.schema.common_modifiers.remove_strict_validation`).
 */
export const PROMPT_CATALOG = applySchemaModifiers(loadCatalog(), [
  removeStrictValidation,
]);

export const CATALOG_ID = PROMPT_CATALOG.catalogSchema.catalogId as string;
