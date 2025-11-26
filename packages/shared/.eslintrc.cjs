/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@perawallet/wallet-core-eslint-config"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
    browser: true,
  },
  ignorePatterns: [
    "lib/*",
    "dist/*",
    "coverage/*",
    "src/api/generated/*",
    "src/test-utils/*",
    "src/**/__tests__/**"
  ],
};