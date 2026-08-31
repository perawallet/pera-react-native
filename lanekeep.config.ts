/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineConfig } from 'lanekeep'

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
    rules: [],
})
