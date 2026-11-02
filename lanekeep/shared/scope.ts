/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { Gates } from 'lanekeep'

// lanekeep.config.ts excludes fixtures from real runs; admitting them here is
// what lets the fixture harness exercise a rule scoped to shipped source.
const FIXTURES = 'lanekeep/__tests__/fixtures/**'

/**
 * Test code, in gate (globset) dialect. In lanekeep gates `*` also matches
 * `/`, so a `__tests__` directory anywhere under a workspace root counts as
 * tests. The fixture root's own `__tests__` comes before any
 * `apps`/`packages`/`extensions` segment, so only a fixture deliberately
 * placed under such a directory is treated as a test.
 */
export const TEST_FILES: readonly string[] = [
    '**/src/**/__tests__/**',
    '**/{apps,packages,extensions}/*/__tests__/**',
    '**/*.spec.{ts,tsx}',
    '**/*.test.{ts,tsx}',
]

/**
 * Any `src` directory under a workspace root — `*` crosses `/`, so a nested
 * `src` matches too, not just each member's top-level one.
 */
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

/**
 * The shared app code: the hooks and the components every chain's UI reuses.
 * A chain pinned here is wrong for every chain but this one, so a shared
 * refresh hook stops serving the chain its caller did not ask for. The two
 * rules that own the legacy chain split on exactly these paths, so a file is
 * reported by one rule and never by both.
 */
export const SHARED_APP_CODE_PATHS: readonly string[] = [
    '**/apps/mobile/src/hooks/**',
    '**/apps/mobile/src/components/**',
]

/**
 * Test support that isn't named as a test: integration fixtures, mocks, test
 * utilities and MSW handlers. Rules about shipped runtime behaviour skip it.
 */
export const TEST_SUPPORT: readonly string[] = [
    '**/__integration__/**',
    '**/__mocks__/**',
    '**/test-utils/**',
    '**/msw-handlers.ts',
    '**/test-handlers.ts',
    // Measurement tooling: bundled only into a BENCH=1 build, never a shipped one.
    '**/apps/benchmarks/**',
]
