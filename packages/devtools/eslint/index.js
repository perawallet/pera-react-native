/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const unusedImports = require("eslint-plugin-unused-imports");
const prettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = tseslint.config(
    {
        ignores: ["lib/*", "dist/*", "coverage/*", "src/**/__tests__/**", 'src/test-utils/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            "unused-imports": unusedImports,
        },
        rules: {
            "@typescript-eslint/no-non-null-assertion": "off",
            "unused-imports/no-unused-imports": "error",
        },
    }
);
