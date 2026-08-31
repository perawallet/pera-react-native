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
