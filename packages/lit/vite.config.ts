import { defineConfig } from "vite";

import { plugin as a2aPlugin } from "./middleware/a2a.js";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [a2aPlugin(), tailwindcss()],
  server: {
    port: 5004,
    strictPort: true,
  },
});
