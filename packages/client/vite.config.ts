import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { plugin as a2aPlugin } from "./middleware/a2a.js";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), a2aPlugin()],
  server: {
    port: 5003,
    strictPort: true,
  },
});
