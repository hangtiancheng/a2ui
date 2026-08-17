import { resolve } from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { plugin as a2aPlugin } from "./middleware/a2a.js"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), a2aPlugin()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5005,
    strictPort: true,
  },
})
