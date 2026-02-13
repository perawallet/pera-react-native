import devtools from "@perawallet/wallet-core-devtools/eslint";
import tseslint from "typescript-eslint";
import globals from "globals";

/** @type {import("eslint").Linter.Config} */
export default tseslint.config(
  ...devtools,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  }
);
