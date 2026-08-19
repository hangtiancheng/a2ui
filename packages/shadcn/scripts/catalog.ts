/**
 * Generates `catalog.json`: the official basic catalog re-published under
 * the shadcn catalog id, with a JSON Schema entry added for every extension
 * component. The server embeds this file in the LLM system prompt, so the model
 * sees the full contract of all shadcn catalog components.
 *
 * Run: pnpm --filter @swifty.js/a2ui-shadcn build:catalog
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  AccessibilityAttributesSchema,
  ActionSchema,
  CheckableSchema,
  CheckRuleSchema,
  ChildListSchema,
  ComponentIdSchema,
  DataBindingSchema,
  DynamicBooleanSchema,
  DynamicNumberSchema,
  DynamicStringListSchema,
  DynamicStringSchema,
  DynamicValueSchema,
  FunctionCallSchema,
} from "@a2ui/web_core/v0_9";
import type { ZodTypeAny } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

import { SHADCN_CATALOG_ID, shadcnCatalog } from "../src/catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const OUTPUT_PATH = path.join(__dirname, "..", "catalog.json");

const COMMON_TYPES_REF =
  "https://a2ui.org/specification/v0_9/common_types.json#/$defs/";

// Shared protocol types are referenced instead of inlined, matching the official
// catalog and keeping the generated file (and the prompt) small.
const SHARED_TYPES: Record<string, ZodTypeAny> = {
  AccessibilityAttributes: AccessibilityAttributesSchema,
  Action: ActionSchema,
  Checkable: CheckableSchema,
  CheckRule: CheckRuleSchema,
  ChildList: ChildListSchema,
  ComponentId: ComponentIdSchema,
  DataBinding: DataBindingSchema,
  DynamicBoolean: DynamicBooleanSchema,
  DynamicNumber: DynamicNumberSchema,
  DynamicString: DynamicStringSchema,
  DynamicStringList: DynamicStringListSchema,
  DynamicValue: DynamicValueSchema,
  FunctionCall: FunctionCallSchema,
};

type JsonObject = Record<string, unknown>;

function toJsonSchema(schema: ZodTypeAny): JsonObject {
  const converted = zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema2019-09",
  }) as JsonObject;
  delete converted.$schema;
  return converted;
}

/** Identity is lost through `.describe()`, so shared types are matched by shape. */
function signature(schema: JsonObject): string {
  const { description: _description, ...rest } = schema;
  return JSON.stringify(rest);
}

const STRUCTURAL_KEYS = [
  "properties",
  "anyOf",
  "oneOf",
  "allOf",
  "items",
  "enum",
  "$ref",
];

// A shared type that converts to a bare primitive (ComponentId is just a string)
// would match every plain string prop, so only structural shapes are matched.
const sharedTypeBySignature = new Map(
  Object.entries(SHARED_TYPES)
    .map(([name, schema]) => [name, toJsonSchema(schema)] as const)
    .filter(([, converted]) => STRUCTURAL_KEYS.some((key) => key in converted))
    .map(([name, converted]) => [signature(converted), name]),
);

function useSharedRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(useSharedRefs);
  if (node === null || typeof node !== "object") return node;

  const object = node as JsonObject;
  const sharedType = sharedTypeBySignature.get(signature(object));
  if (sharedType) {
    const ref: JsonObject = { $ref: `${COMMON_TYPES_REF}${sharedType}` };
    if (typeof object.description === "string") {
      ref.description = object.description;
    }
    return ref;
  }

  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, useSharedRefs(value)]),
  );
}

/** Builds a catalog entry in the same `allOf` shape the official catalog uses. */
function buildComponentEntry(name: string, schema: ZodTypeAny): JsonObject {
  const converted = useSharedRefs(toJsonSchema(schema)) as JsonObject;
  const properties = (converted.properties ?? {}) as JsonObject;
  const required = (converted.required ?? []) as string[];

  // `weight` and `accessibility` are contributed by the shared common types.
  const {
    weight: _weight,
    accessibility: _accessibility,
    ...ownProperties
  } = properties;

  return {
    type: "object",
    allOf: [
      { $ref: `${COMMON_TYPES_REF}ComponentCommon` },
      { $ref: "#/$defs/CatalogComponentCommon" },
      {
        type: "object",
        properties: { component: { const: name }, ...ownProperties },
        required: [
          "component",
          ...required.filter(
            (key) => key !== "weight" && key !== "accessibility",
          ),
        ],
      },
    ],
  };
}

const basicCatalog = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "catalog.json"), "utf-8"),
) as JsonObject;

const components = { ...(basicCatalog.components as JsonObject) };
const generated: string[] = [];

for (const [name, implementation] of shadcnCatalog.components) {
  if (name in components) continue;
  components[name] = buildComponentEntry(name, implementation.schema);
  generated.push(name);
}

const defs = { ...(basicCatalog.$defs as JsonObject) };
defs.anyComponent = {
  oneOf: Object.keys(components).map((name) => ({
    $ref: `#/components/${name}`,
  })),
};

const catalog: JsonObject = {
  ...basicCatalog,
  $id: SHADCN_CATALOG_ID,
  title: "A2UI shadcn Catalog",
  description:
    "The basic A2UI catalog as implemented by packages/shadcn, extended with" +
    " catalog entries for every additional shadcn/ui component family.",
  catalogId: SHADCN_CATALOG_ID,
  components,
  $defs: defs,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(
  `[build-catalog] ${path.relative(REPO_ROOT, OUTPUT_PATH)}:` +
    ` ${Object.keys(components).length} components` +
    ` (${generated.length} generated from zod schemas)`,
);
