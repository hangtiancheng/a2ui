interface RestaurantItem {
  name: string;
  detail: string;
  imageUrl: string;
  rating: string;
  infoLink: string;
  address: string;
}

const CATALOG_ID =
  process.env.MODE === "shadcn"
    ? "https://raw.githubusercontent.com/hangtiancheng/a2ui/main/packages/shadcn/src/catalog/index.ts"
    : "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
export function buildRestaurantListA2ui(
  title: string,
  items: RestaurantItem[],
): unknown[] {
  return [
    {
      version: "v0.9",
      createSurface: {
        surfaceId: "default",
        catalogId: CATALOG_ID,
        theme: { primaryColor: "#FF0000", font: "Roboto" },
      },
    },
    {
      version: "v0.9",
      updateComponents: {
        surfaceId: "default",
        components: [
          {
            id: "root",
            component: "Column",
            children: ["title-heading", "item-list"],
          },
          {
            id: "title-heading",
            component: "Text",
            variant: "h1",
            text: { path: "/title" },
          },
          {
            id: "item-list",
            component: "List",
            direction: "vertical",
            children: {
              componentId: "item-card-template",
              path: "/items",
            },
          },
          {
            id: "item-card-template",
            component: "Card",
            child: "card-layout",
          },
          {
            id: "card-layout",
            component: "Row",
            children: ["card-image", "card-details"],
          },
          {
            id: "card-image",
            component: "Image",
            variant: "mediumFeature",
            weight: 1,
            url: { path: "imageUrl" },
          },
          {
            id: "card-details",
            component: "Column",
            weight: 2,
            children: [
              "template-name",
              "template-rating",
              "template-detail",
              "template-link",
              "template-book-button",
            ],
          },
          {
            id: "template-name",
            component: "Text",
            variant: "h3",
            text: { path: "name" },
          },
          {
            id: "template-rating",
            component: "Text",
            text: { path: "rating" },
          },
          {
            id: "template-detail",
            component: "Text",
            text: { path: "detail" },
          },
          {
            id: "template-link",
            component: "Text",
            text: { path: "infoLink" },
          },
          {
            id: "template-book-button",
            component: "Button",
            child: "book-now-text",
            variant: "primary",
            action: {
              event: {
                name: "book_restaurant",
                context: {
                  restaurantName: { path: "name" },
                  imageUrl: { path: "imageUrl" },
                  address: { path: "address" },
                },
              },
            },
          },
          {
            id: "book-now-text",
            component: "Text",
            text: "Book Now",
          },
        ],
      },
    },
    {
      version: "v0.9",
      updateDataModel: {
        surfaceId: "default",
        path: "/title",
        value: title,
      },
    },
    {
      version: "v0.9",
      updateDataModel: {
        surfaceId: "default",
        path: "/items",
        value: items,
      },
    },
  ];
}

export function buildBookingFormA2ui(
  restaurantName: string,
  imageUrl: string,
  address: string,
): unknown[] {
  return [
    {
      version: "v0.9",
      createSurface: {
        surfaceId: "booking-form",
        catalogId: CATALOG_ID,
        theme: { primaryColor: "#FF0000", font: "Roboto" },
      },
    },
    {
      version: "v0.9",
      updateComponents: {
        surfaceId: "booking-form",
        components: [
          {
            id: "root",
            component: "Column",
            children: [
              "booking-title",
              "restaurant-image",
              "restaurant-address",
              "party-size-field",
              "datetime-field",
              "dietary-field",
              "submit-button",
            ],
          },
          {
            id: "booking-title",
            component: "Text",
            variant: "h2",
            text: { path: "/title" },
          },
          {
            id: "restaurant-image",
            component: "Image",
            url: { path: "/imageUrl" },
          },
          {
            id: "restaurant-address",
            component: "Text",
            text: { path: "/address" },
          },
          {
            id: "party-size-field",
            component: "TextField",
            label: "Party Size",
            value: { path: "/partySize" },
            variant: "number",
          },
          {
            id: "datetime-field",
            component: "DateTimeInput",
            label: "Date & Time",
            value: { path: "/reservationTime" },
            enableDate: true,
            enableTime: true,
          },
          {
            id: "dietary-field",
            component: "TextField",
            label: "Dietary Requirements",
            value: { path: "/dietary" },
          },
          {
            id: "submit-button",
            component: "Button",
            child: "submit-reservation-text",
            variant: "primary",
            action: {
              event: {
                name: "submit_booking",
                context: {
                  restaurantName: { path: "/restaurantName" },
                  partySize: { path: "/partySize" },
                  reservationTime: { path: "/reservationTime" },
                  dietary: { path: "/dietary" },
                  imageUrl: { path: "/imageUrl" },
                },
              },
            },
          },
          {
            id: "submit-reservation-text",
            component: "Text",
            text: "Submit Reservation",
          },
        ],
      },
    },
    {
      version: "v0.9",
      updateDataModel: {
        surfaceId: "booking-form",
        path: "/",
        value: {
          title: `Book a Table at ${restaurantName}`,
          address,
          restaurantName,
          partySize: "2",
          reservationTime: "",
          dietary: "",
          imageUrl,
        },
      },
    },
  ];
}

export function buildConfirmationA2ui(
  restaurantName: string,
  partySize: string,
  reservationTime: string,
  dietary: string,
  imageUrl: string,
): unknown[] {
  return [
    {
      version: "v0.9",
      createSurface: {
        surfaceId: "confirmation",
        catalogId: CATALOG_ID,
        theme: { primaryColor: "#FF0000", font: "Roboto" },
      },
    },
    {
      version: "v0.9",
      updateComponents: {
        surfaceId: "confirmation",
        components: [
          {
            id: "root",
            component: "Card",
            child: "confirmation-column",
          },
          {
            id: "confirmation-column",
            component: "Column",
            children: [
              "confirm-title",
              "confirm-image",
              "divider1",
              "confirm-details",
              "divider2",
              "confirm-dietary",
              "divider3",
              "confirm-text",
            ],
          },
          {
            id: "confirm-title",
            component: "Text",
            variant: "h2",
            text: { path: "/title" },
          },
          {
            id: "confirm-image",
            component: "Image",
            url: { path: "/imageUrl" },
          },
          {
            id: "confirm-details",
            component: "Text",
            text: { path: "/bookingDetails" },
          },
          {
            id: "confirm-dietary",
            component: "Text",
            text: { path: "/dietaryRequirements" },
          },
          {
            id: "confirm-text",
            component: "Text",
            variant: "h5",
            text: "We look forward to seeing you!",
          },
          { id: "divider1", component: "Divider" },
          { id: "divider2", component: "Divider" },
          { id: "divider3", component: "Divider" },
        ],
      },
    },
    {
      version: "v0.9",
      updateDataModel: {
        surfaceId: "confirmation",
        path: "/",
        value: {
          title: `Booking Confirmed at ${restaurantName}`,
          bookingDetails: `${partySize} people at ${reservationTime || "TBD"}`,
          dietaryRequirements: dietary
            ? `Dietary Requirements: ${dietary}`
            : "No dietary requirements specified",
          imageUrl,
        },
      },
    },
  ];
}
