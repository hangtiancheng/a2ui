import type { AppConfig } from "./types.js";
import { restaurantThemeSheet } from "../theme/restaurant-theme.js";

export const restaurantConfig: AppConfig = {
  key: "restaurant",
  title: "Restaurant Finder",
  heroImage: "/hero.svg",
  heroImageDark: "/hero-dark.svg",
  placeholder: "Top 5 Chinese restaurants in New York.",
  loadingText: [
    "Finding the best spots for you...",
    "Checking reviews...",
    "Looking for open tables...",
    "Almost there...",
  ],
  serverUrl: "http://localhost:10002",
  cssOverrides: restaurantThemeSheet,
};
