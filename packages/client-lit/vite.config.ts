import { defineConfig } from "vite";

import * as Middleware from "./middleware/index.js";

// https://vite.dev/config/
export default defineConfig({
  plugins: [Middleware.A2AMiddleware.plugin()],
  server: {
    port: 5004,
    strictPort: true,
  },
});
