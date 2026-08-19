import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import importPlugin from "eslint-plugin-import";

export default defineConfig([
  globalIgnores(["dist", "src/catalog/components", "src/components/ui"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      import: importPlugin,
    },
    // rules: {
    //   "import/first": "error",
    //   "import/order": [
    //     "error",
    //     {
    //       groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
    //       "newlines-between": "always",
    //       alphabetize: { order: "asc", caseInsensitive: true },
    //     },
    //   ],
    // }
  },
]);
