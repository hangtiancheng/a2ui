import { DirectJsonPromptGenerator } from "@swifty.js/a2ui-shadcn/prompt";

import {
  buildBookingFormA2ui,
  buildConfirmationA2ui,
  buildRestaurantListA2ui,
} from "./a2ui-messages.js";
import { CATALOG_ID, PROMPT_CATALOG } from "./catalog.js";

export { A2UI_CLOSE_TAG, A2UI_OPEN_TAG } from "@swifty.js/a2ui-shadcn/prompt";

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

export const A2UI_SYSTEM_PROMPT = new DirectJsonPromptGenerator(
  PROMPT_CATALOG,
).generate({
  roleDescription: ROLE_DESCRIPTION,
  workflowDescription: WORKFLOW_DESCRIPTION,
  uiDescription: UI_DESCRIPTION,
  includeSchema: true,
  examples: renderExamples(),
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
