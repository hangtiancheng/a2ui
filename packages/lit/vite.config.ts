import { defineConfig } from "vite";

import * as Middleware from "./middleware/index.js";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    Middleware.A2AMiddleware.plugin(),

    tailwindcss(),
  ],
  server: {
    port: 5004,
    strictPort: true,
  },
});
