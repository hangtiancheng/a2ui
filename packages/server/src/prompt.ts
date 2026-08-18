import {
  buildBookingFormA2ui,
  buildConfirmationA2ui,
  buildRestaurantListA2ui,
} from "./a2ui-messages.js";
import { CATALOG_ID, renderCatalogAsLlmInstructions } from "./catalog.js";

export const A2UI_OPEN_TAG = "<a2ui-json>";
export const A2UI_CLOSE_TAG = "</a2ui-json>";

// Port of `a2ui.schema.constants.DEFAULT_WORKFLOW_RULES`.
const DEFAULT_WORKFLOW_RULES = `
The generated response MUST follow these rules:
- The response can contain one or more A2UI JSON blocks.
- Each A2UI JSON block MUST be wrapped in \`${A2UI_OPEN_TAG}\` and \`${A2UI_CLOSE_TAG}\` tags.
- Between or around these blocks, you can provide conversational text.
- The JSON part MUST be a single, raw JSON object (usually a list of A2UI messages) and MUST validate against the provided A2UI JSON SCHEMA.
- Top-Down Component Ordering: Within the \`components\` list of a message:
    - The 'root' component MUST be the FIRST element.
    - Parent components MUST appear before their child components.
    This specific ordering allows the streaming parser to yield and render the UI incrementally as it arrives.
`;

const ROLE_DESCRIPTION =
  "You are a helpful restaurant finding assistant. Your final output MUST be an A2UI UI definition.";

const WORKFLOW_DESCRIPTION = `- For a restaurant search query, you MUST first call the \`get_restaurants\` tool with the cuisine, location and count extracted from the query.
- You MUST copy the tool results verbatim into the data model — never invent restaurants. If the tool returns an empty array, render a surface with a single Text component apologizing that no restaurants were found for that location.`;

// Port of the restaurant_finder sample's UI_DESCRIPTION, adapted to the single
// list template this server ships (upstream also has a two-column variant).
const UI_DESCRIPTION = `- If the query is for a list of restaurants, use the restaurant data you have already received from the \`get_restaurants\` tool to populate the \`updateDataModel\` message.
- IMPORTANT: When using updateDataModel to update items, you MUST specify \`path: "/items"\` in \`updateDataModel\`, and the \`value\` MUST be an array of restaurants.
- IMPORTANT: Always specify the path when using updateDataModel. The part message is ignored when the path is missing.
- If the query is for a list of restaurants, you MUST use the \`RESTAURANT_LIST_EXAMPLE\` template (surfaceId "default"); each card's button fires the \`book_restaurant\` action.
- If the query is to book a restaurant (e.g., "USER_WANTS_TO_BOOK..."), you MUST use the \`BOOKING_FORM_EXAMPLE\` template (surfaceId "booking-form"); the submit button fires the \`submit_booking\` action.
- If the query is a booking submission (e.g., "User submitted a booking..."), you MUST use the \`CONFIRMATION_EXAMPLE\` template (surfaceId "confirmation").
- Every \`createSurface\` message MUST use catalogId ${CATALOG_ID}.`;

const EXAMPLE_RESTAURANTS = [
  {
    name: "Golden Dragon",
    detail: "Hand-pulled noodles and dumplings.",
    imageUrl: "http://localhost:10002/static/noodles.jpeg",
    rating: "★★★★☆",
    infoLink: "[More Info](https://example.com/golden-dragon)",
    address: "12 Mott St, New York, NY 10013",
  },
  {
    name: "Jade Garden",
    detail: "Classic Cantonese dim sum.",
    imageUrl: "http://localhost:10002/static/dimsum.jpeg",
    rating: "★★★★★",
    infoLink: "[More Info](https://example.com/jade-garden)",
    address: "88 Canal St, New York, NY 10002",
  },
];

/**
 * Few-shot examples in the upstream block format. Upstream loads them from
 * `examples/0.9/*.json`; here the builders generate them so the templates and
 * the prompt cannot drift apart.
 */
function renderExamples(): string {
  const examples: Array<[string, unknown[]]> = [
    [
      "RESTAURANT_LIST_EXAMPLE",
      buildRestaurantListA2ui(
        "Top 2 Chinese Restaurants in New York",
        EXAMPLE_RESTAURANTS,
      ),
    ],
    [
      "BOOKING_FORM_EXAMPLE",
      buildBookingFormA2ui(
        "Golden Dragon",
        "http://localhost:10002/static/noodles.jpeg",
        "12 Mott St, New York, NY 10013",
      ),
    ],
    [
      "CONFIRMATION_EXAMPLE",
      buildConfirmationA2ui(
        "Golden Dragon",
        "4",
        "2026-08-20T19:00",
        "Vegetarian",
        "http://localhost:10002/static/noodles.jpeg",
      ),
    ],
  ];

  return examples
    .map(
      ([name, messages]) =>
        `---BEGIN ${name}---\n${JSON.stringify(messages, null, 2)}\n---END ${name}---`,
    )
    .join("\n\n");
}

interface SystemPromptOptions {
  roleDescription: string;
  workflowDescription?: string;
  uiDescription?: string;
  includeSchema?: boolean;
  includeExamples?: boolean;
}

/**
 * Port of `DirectJsonPromptGenerator.generate`: role, workflow rules, UI rules,
 * the component catalog schemas and the few-shot examples, in that order.
 */
export function generateSystemPrompt({
  roleDescription,
  workflowDescription = "",
  uiDescription = "",
  includeSchema = false,
  includeExamples = false,
}: SystemPromptOptions): string {
  const parts = [roleDescription];

  const rules = workflowDescription
    ? `${DEFAULT_WORKFLOW_RULES}\n${workflowDescription}`
    : DEFAULT_WORKFLOW_RULES;
  parts.push(`## Workflow Description:\n${rules}`);

  if (uiDescription) {
    parts.push(`## UI Description:\n${uiDescription}`);
  }

  if (includeSchema) {
    parts.push(renderCatalogAsLlmInstructions());
  }

  if (includeExamples) {
    parts.push(`### Examples:\n${renderExamples()}`);
  }

  return parts.join("\n\n");
}

export const A2UI_SYSTEM_PROMPT = generateSystemPrompt({
  roleDescription: ROLE_DESCRIPTION,
  workflowDescription: WORKFLOW_DESCRIPTION,
  uiDescription: UI_DESCRIPTION,
  includeSchema: true,
  includeExamples: true,
});

// Port of the restaurant_finder sample's `get_text_prompt`.
export const TEXT_SYSTEM_PROMPT = `You are a helpful restaurant finding assistant. Your final output MUST be a text response.

To generate the response, you MUST follow these rules:

1. **For finding restaurants:**
   a. You MUST call the \`get_restaurants\` tool. Extract the cuisine, location, and a specific number (\`count\`) of restaurants from the user's query.
   b. After receiving the data, format the restaurant list as a clear, human-readable text response. You MUST preserve any markdown formatting (like for links) that you receive from the tool.

2. **For booking a table (when you receive a query like 'USER_WANTS_TO_BOOK...'):**
   a. Respond by asking the user for the necessary details to make a booking (party size, date, time, dietary requirements).

3. **For confirming a booking (when you receive a query like 'User submitted a booking...'):**
   a. Respond with a simple text confirmation of the booking details.`;
