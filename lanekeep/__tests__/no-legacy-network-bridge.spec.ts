/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-legacy-network-bridge.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/packages/*/src/legacy-bridge.*.ts'
const APP_FIXTURES = 'lanekeep/__tests__/fixtures/apps/**/*.{ts,tsx}'

// The rule ships at `error` and both lists are empty: an entry may only be
// added if a file stops being clean.
const LEGACY_BRIDGE_BASELINE: readonly string[] = []

// The app code that reads the deployment off the network store itself.
const APP_BRIDGE_BASELINE: readonly string[] = []

describe('pera/no-legacy-network-bridge', () => {
    it('reports each converter call', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('legacy-bridge.bad.ts')),
            ),
        ).toEqual([
            'legacy-bridge.bad.ts:11',
            'legacy-bridge.bad.ts:12',
            'legacy-bridge.bad.ts:13',
            'legacy-bridge.bad.ts:14',
        ])
    })

    it('ignores member calls, look-alike names, strings, comments and chain-algorand', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(
                v =>
                    v.file.endsWith('legacy-bridge.good.ts') ||
                    v.file.endsWith('legacy-bridge.exempt.ts'),
            ),
        ).toEqual([])
    })

    it('reports exactly the baseline files across the real packages', async () => {
        const found = await runRule(RULE, 'packages/*/src/**/*.{ts,tsx}')

        expect([...new Set(found.map(v => v.file))].sort()).toEqual(
            LEGACY_BRIDGE_BASELINE,
        )
    })

    it('reports a mode read off the network store in app code', async () => {
        const found = await runRule(RULE, APP_FIXTURES)

        expect(
            locations(found.filter(v => v.file.endsWith('app-bridge.bad.ts'))),
        ).toEqual([
            'app-bridge.bad.ts:11',
            'app-bridge.bad.ts:12',
            'app-bridge.bad.ts:13',
        ])
    })

    it('ignores a store read that is not the mode, a string and a composition root', async () => {
        const found = await runRule(RULE, APP_FIXTURES)

        expect(
            found.filter(
                v =>
                    v.file.endsWith('app-bridge.good.ts') ||
                    v.file.endsWith('runOffscreenApp.ts'),
            ),
        ).toEqual([])
    })

    it('reports exactly the baseline files across the app code', async () => {
        const found = await runRule(RULE, 'apps/*/src/**/*.{ts,tsx}')

        expect([...new Set(found.map(v => v.file))].sort()).toEqual(
            APP_BRIDGE_BASELINE,
        )
    })
})
