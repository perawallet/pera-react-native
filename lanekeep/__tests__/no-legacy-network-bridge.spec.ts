/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-legacy-network-bridge.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/packages/*/src/legacy-bridge.*.ts'
const APP_FIXTURES = 'lanekeep/__tests__/fixtures/apps/**/*.{ts,tsx}'

// Delete an entry when its file is clean; never add one. Flip the rule to
// `error` when the list is empty.
const LEGACY_BRIDGE_BASELINE: readonly string[] = [
    'packages/assets/src/db/seed.ts',
    'packages/assets/src/models/assets.ts',
    'packages/chain-shared/src/store/network-store.ts',
    'packages/chain-shared/src/utils/clearCustomNetworkCache.ts',
]

// The app code that reads the deployment off the network store itself. The
// packages' baseline above is what keeps the rule at `warn`; the app scope
// has no such debt, so this list is empty.
const APP_BRIDGE_BASELINE: readonly string[] = []

describe('pera/no-legacy-network-bridge', () => {
    it('reports each converter call and every reference to LEGACY_CHAIN_ID', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('legacy-bridge.bad.ts')),
            ),
        ).toEqual([
            'legacy-bridge.bad.ts:5',
            'legacy-bridge.bad.ts:12',
            'legacy-bridge.bad.ts:13',
            'legacy-bridge.bad.ts:14',
            'legacy-bridge.bad.ts:15',
            'legacy-bridge.bad.ts:16',
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

    it('leaves LEGACY_CHAIN_ID in app code to the chain rules', async () => {
        const found = await runRule(RULE, APP_FIXTURES)

        expect(
            found.filter(v => v.message.includes('LEGACY_CHAIN_ID')),
        ).toEqual([])
    })

    it('reports exactly the baseline files across the app code', async () => {
        const found = await runRule(RULE, 'apps/*/src/**/*.{ts,tsx}')

        expect([...new Set(found.map(v => v.file))].sort()).toEqual(
            APP_BRIDGE_BASELINE,
        )
    })
})
