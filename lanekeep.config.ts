/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineConfig } from 'lanekeep'

import errorMessageKeyExists from './lanekeep/rules/error-message-key-exists.js'
import errorParamsMatchCopy from './lanekeep/rules/error-params-match-copy.js'
import noChromeImportsOutsideWeb from './lanekeep/rules/no-chrome-imports-outside-web.js'
import noEmptyStyleObjects from './lanekeep/rules/no-empty-style-objects.js'
import noErrorToastInCatch from './lanekeep/rules/no-error-toast-in-catch.js'
import noNumericSizes from './lanekeep/rules/no-numeric-sizes.js'
import noPrimitiveRnComponents from './lanekeep/rules/no-primitive-rn-components.js'
import noTypographyInStyles from './lanekeep/rules/no-typography-in-styles.js'

export default defineConfig({
    // Mirrors packages/devtools/guardrails/utils/discovery.ts. Every workspace
    // member lives one level under apps/, packages/ or extensions/, matching
    // the pnpm-workspace.yaml globs.
    include: [
        'apps/*/src/**/*.{ts,tsx}',
        'packages/*/src/**/*.{ts,tsx}',
        'extensions/*/src/**/*.{ts,tsx}',
    ],
    // lanekeep also skips gitignored files on top of the excludes below, so a generated
    // file like packages/config/src/generated-env.ts can match `include` and still never
    // appear here — expected, not a glob bug.
    exclude: [
        '**/__tests__/**',
        '**/*.spec.{ts,tsx}',
        '**/*.test.{ts,tsx}',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.expo/**',
        'packages/devtools/**',
    ],
    namespaces: ['pera'],
    rules: [
        noPrimitiveRnComponents,
        noChromeImportsOutsideWeb,
        noTypographyInStyles,
        noEmptyStyleObjects,
        noNumericSizes,
        noErrorToastInCatch,
        errorMessageKeyExists,
        errorParamsMatchCopy,
    ],
})
