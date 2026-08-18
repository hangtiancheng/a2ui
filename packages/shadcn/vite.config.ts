import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";
import dts from "vite-plugin-dts";

import pkg from "./package.json" with { type: "json" };
import { plugin as a2aPlugin } from "./middleware/a2a.js";

// === Shared constants ===

const PKG_DIR = import.meta.dirname;

const EXTERNAL_IDS = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  "react",
  "react-dom",
  "react/jsx-runtime",
];

function isExternal(id: string): boolean {
  if (id.startsWith("node:")) return true;
  return EXTERNAL_IDS.some((e) => id === e || id.startsWith(e + "/"));
}

// === Mode router ===

export default defineConfig(({ mode }) => {
  if (mode === "lib") {
    return libConfig();
  }
  return appConfig();
});

// === Library build (--mode lib) ===

function libConfig(): UserConfig {
  return {
    publicDir: false,
    resolve: {
      alias: {
        "@": resolve(PKG_DIR, "src"),
      },
    },
    build: {
      lib: {
        entry: {
          index: resolve(PKG_DIR, "src/index.ts"),
          catalog: resolve(PKG_DIR, "src/catalog/index.ts"),
        },
      },
      rollupOptions: {
        external: isExternal,
        output: [
          {
            format: "es",
            entryFileNames: "[name].js",
            chunkFileNames: "chunks/[name]-[hash].js",
            exports: "named",
          },
          {
            format: "cjs",
            entryFileNames: "[name].cjs",
            chunkFileNames: "chunks/[name]-[hash].cjs",
            exports: "named",
          },
        ],
      },
      outDir: "dist",
      emptyOutDir: true,
      minify: false,
      sourcemap: false,
    },
    plugins: [
      react(),
      dts({
        tsconfigPath: resolve(PKG_DIR, "tsconfig.app.json"),
        include: ["src"],
      }),
    ],
  };
}

// === App / demo mode (default) ===

function appConfig(): UserConfig {
  return {
    plugins: [react(), tailwindcss(), a2aPlugin()],
    resolve: {
      alias: {
        "@": resolve(PKG_DIR, "src"),
      },
    },
    build: {
      outDir: resolve(PKG_DIR, "dist-app"),
    },
    server: {
      port: 5005,
      strictPort: true,
    },
  };
}
