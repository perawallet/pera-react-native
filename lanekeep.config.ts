/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineConfig } from 'lanekeep'

import errorMessageKeyExists from './lanekeep/rules/error-message-key-exists.js'
import errorParamsMatchCopy from './lanekeep/rules/error-params-match-copy.js'
import noChromeImportsOutsideWeb from './lanekeep/rules/no-chrome-imports-outside-web.js'
import noCrossProtocolImports from './lanekeep/rules/no-cross-protocol-imports.js'
import noDeepModuleImports from './lanekeep/rules/no-deep-module-imports.js'
import noEmptyStyleObjects from './lanekeep/rules/no-empty-style-objects.js'
import noErrorToastInCatch from './lanekeep/rules/no-error-toast-in-catch.js'
import noNumericSizes from './lanekeep/rules/no-numeric-sizes.js'
import noPrimitiveRnComponents from './lanekeep/rules/no-primitive-rn-components.js'
import noTypographyInStyles from './lanekeep/rules/no-typography-in-styles.js'
import noUnusedStyleKeys from './lanekeep/rules/no-unused-style-keys.js'
import noWcImportsInConnectionsModule from './lanekeep/rules/no-wc-imports-in-connections-module.js'

export default defineConfig({
    // Every TS/JS file in the repo. A rule about shipped source narrows itself
    // with lanekeep/shared/scope.ts; the repo-wide rules need tests and
    // tooling in view.
    include: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    // lanekeep also skips gitignored files on top of the excludes below, so a generated
    // file like packages/config/src/generated-env.ts can match `include` and still never
    // appear here — expected, not a glob bug.
    exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.expo/**',
        'apps/mobile/ios/**',
        'apps/mobile/android/**',
        // They break the rules on purpose; each spec runs them with its own
        // config.
        'lanekeep/__tests__/fixtures/**',
        // Worktrees are full repo copies, hidden only by a local
        // .git/info/exclude.
        '.claude/**',
    ],
    // The per-rule budget is a MAXIMUM over every file in the corpus, not an
    // average like the global budget — one slow file trips it regardless of
    // how fast the other 3900+ run. It has to clear the worst single file on
    // a loaded CI runner, not just a warm dev machine, while still catching a
    // rule that goes quadratic (which would blow well past this ceiling, not
    // graze it). The global budget already covers a rule that's merely slow
    // across the whole run.
    timeouts: { rule: 1000, global: 60000 },
    namespaces: ['pera'],
    rules: [
        noPrimitiveRnComponents,
        noChromeImportsOutsideWeb,
        noCrossProtocolImports,
        noWcImportsInConnectionsModule,
        noDeepModuleImports,
        noTypographyInStyles,
        noEmptyStyleObjects,
        noNumericSizes,
        noErrorToastInCatch,
        errorMessageKeyExists,
        errorParamsMatchCopy,
        noUnusedStyleKeys,
    ],
})
