/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { Gates } from 'lanekeep'

// lanekeep.config.ts excludes fixtures from real runs; admitting them here is
// what lets the fixture harness exercise a rule scoped to shipped source.
const FIXTURES = 'lanekeep/__tests__/fixtures/**'

/**
 * Test code, in gate (globset) dialect. None of these matches a fixture path:
 * the fixture root's own `__tests__` segment never comes after a `src/`.
 */
export const TEST_FILES: readonly string[] = [
    '**/src/**/__tests__/**',
    'apps/*/__tests__/**',
    '**/*.spec.{ts,tsx}',
    '**/*.test.{ts,tsx}',
]

/** Shipped source: every workspace member's `src` tree. */
export const PRODUCTION_SOURCE_PATHS: readonly string[] = [
    '**/apps/*/src/**',
    '**/packages/*/src/**',
    '**/extensions/*/src/**',
    FIXTURES,
]

/** A rule's own gates, narrowed to shipped source. Exclusions concatenate. */
export const productionSource = (own: Gates = {}): Gates => ({
    ...own,
    pathMatches: [...PRODUCTION_SOURCE_PATHS],
    pathNotMatches: [...TEST_FILES, ...(own.pathNotMatches ?? [])],
})

/** For a rule that scopes itself with `pathMatches`: keep them, drop tests. */
export const withoutTests = (own: Gates): Gates => ({
    ...own,
    pathNotMatches: [...TEST_FILES, ...(own.pathNotMatches ?? [])],
})
