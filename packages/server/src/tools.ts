import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Restaurant {
  name: string;
  detail: string;
  imageUrl: string;
  rating: string;
  infoLink: string;
  address: string;
}

let restaurantCache: Restaurant[] | null = null;

function loadRestaurantData(): Restaurant[] {
  if (restaurantCache) return restaurantCache;

  const dataPath = path.join(__dirname, "..", "data", "restaurant_data.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  restaurantCache = JSON.parse(raw) as Restaurant[];
  return restaurantCache;
}

export function getRestaurants(
  cuisine: string,
  location: string,
  count: number = 5,
): string {
  console.log(
    `[tools] get_restaurants called: cuisine=${cuisine}, location=${location}, count=${count}`,
  );

  // Mirrors the upstream sample: the mock dataset only covers Chinese
  // restaurants in New York, so any other location has no data.
  const loc = (location || "").toLowerCase();
  if (!loc.includes("new york") && !loc.includes("ny")) {
    console.log(`[tools] No data for location "${location}", returning []`);
    return JSON.stringify([]);
  }

  const allRestaurants = loadRestaurantData();

  const baseUrl = `http://${process.env.HOST || "localhost"}:${process.env.PORT || "10002"}`;
  const items = allRestaurants.slice(0, count).map((r) => ({
    ...r,
    imageUrl: r.imageUrl.replace("http://localhost:10002", baseUrl),
  }));

  console.log(`[tools] Returning ${items.length} restaurants`);
  return JSON.stringify(items);
}
