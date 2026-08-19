import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

// The shadcn client implements the basic catalog plus its own extension
// components under its own catalog id. This file is generated from those
// component schemas by `pnpm --filter @swifty.js/a2ui-shadcn build:catalog`.
const SHADCN_CATALOG_FILE = "packages/shadcn/catalog.json";

type JsonObject = Record<string, unknown>;

function loadSpec(fileName: string): JsonObject {
  const raw = fs.readFileSync(path.join(REPO_ROOT, fileName), "utf-8");
  return JSON.parse(raw) as JsonObject;
}

/**
 * Port of `a2ui.schema.common_modifiers.remove_strict_validation`: closed-object
 * constraints make the LLM output fail validation on harmless extra keys, so the
 * schemas handed to the model drop them.
 */
function removeStrictValidation(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(removeStrictValidation);
  if (node !== null && typeof node === "object") {
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(node as JsonObject)) {
      if (
        (key === "additionalProperties" || key === "unevaluatedProperties") &&
        value === false
      ) {
        continue;
      }
      result[key] = removeStrictValidation(value);
    }
    return result;
  }
  return node;
}

function collectRefs(node: unknown, refs: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node as JsonObject)) {
      if (key === "$ref" && typeof value === "string") refs.add(value);
      else collectRefs(value, refs);
    }
  }
}

/** Keeps only the definitions reachable from `roots`, like the Python SDK. */
function pruneDefsByReachability(
  defs: JsonObject,
  roots: string[],
): JsonObject {
  const visited = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (visited.has(name) || !(name in defs)) continue;
    visited.add(name);
    const internalRefs = new Set<string>();
    collectRefs(defs[name], internalRefs);
    for (const ref of internalRefs) {
      if (ref.startsWith("#/$defs/")) queue.push(ref.slice("#/$defs/".length));
    }
  }
  return Object.fromEntries(
    Object.entries(defs).filter(([name]) => visited.has(name)),
  );
}

const catalogSchema = removeStrictValidation(
  loadSpec(
    process.env.A2UI_MODE === "shadcn" ? SHADCN_CATALOG_FILE : "catalog.json",
  ),
) as JsonObject;
const serverToClientSchema = removeStrictValidation(
  loadSpec("server_to_client.json"),
) as JsonObject;
const commonTypesSchema = removeStrictValidation(
  loadSpec("common_types.json"),
) as JsonObject;

export const CATALOG_ID = catalogSchema.catalogId as string;

function pruneUnusedCommonTypes(): void {
  const externalRefs = new Set<string>();
  collectRefs(catalogSchema, externalRefs);
  collectRefs(serverToClientSchema, externalRefs);
  const roots = [...externalRefs]
    .filter((ref) => ref.includes("common_types.json#/$defs/"))
    .map((ref) => ref.split("#/$defs/").pop() as string);
  commonTypesSchema.$defs = pruneDefsByReachability(
    (commonTypesSchema.$defs ?? {}) as JsonObject,
    roots,
  );
}

pruneUnusedCommonTypes();

/**
 * Port of `A2uiCatalog.render_as_llm_instructions`: the message envelope schema,
 * the shared types it references and the component catalog the surfaces must be
 * built from.
 */
export function renderCatalogAsLlmInstructions(): string {
  const sections = [
    "---BEGIN A2UI JSON SCHEMA---",
    `### Server To Client Schema:\n${JSON.stringify(serverToClientSchema)}`,
  ];

  if (Object.keys(commonTypesSchema.$defs as JsonObject).length > 0) {
    sections.push(
      `### Common Types Schema:\n${JSON.stringify(commonTypesSchema)}`,
    );
  }

  sections.push(
    `### Catalog Schema:\n${JSON.stringify(catalogSchema)}`,
    "---END A2UI JSON SCHEMA---",
  );

  return sections.join("\n\n");
}
