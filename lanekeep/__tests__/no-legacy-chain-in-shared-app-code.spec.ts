/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-legacy-chain-in-shared-app-code.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/apps/mobile/src/**/*.{ts,tsx}'
// The shared app code this rule owns: the hooks and the components every
// chain's UI reuses. Two globs rather than one brace, so an unmatched pattern
// cannot silently narrow the rule to nothing.
const SHARED_APP_GLOBS = [
    'apps/mobile/src/hooks/**/*.{ts,tsx}',
    'apps/mobile/src/components/**/*.{ts,tsx}',
]

// Delete an entry when its file is clean; never add one. The rule ships at
// `error`, so this list is the whole debt the rule sees in shared app code.
const SHARED_APP_BASELINE: readonly string[] = [
    'apps/mobile/src/components/AccountDisplay/useAccountDisplay.ts',
    'apps/mobile/src/components/AccountIcon/useAccountIcon.ts',
    'apps/mobile/src/components/AccountWithBalance/useAccountWithBalance.ts',
    'apps/mobile/src/components/AddressDisplay/useAddressDisplay.ts',
    'apps/mobile/src/components/AddressListItem/AddressListItem.tsx',
    'apps/mobile/src/components/AssetSelector/AssetSelectorById/AssetSelectorById.tsx',
    'apps/mobile/src/components/PreferredAmount/ConvertedPreferredAmount/ConvertedPreferredAmount.tsx',
    'apps/mobile/src/components/PreferredAmount/PrecomputedPreferredAmount/PrecomputedPreferredAmount.tsx',
    'apps/mobile/src/components/PreferredAmount/usePreferredAmount.ts',
    'apps/mobile/src/components/RootComponent/RootContentContainer/RootContentContainer.tsx',
    'apps/mobile/src/components/TestnetIndicator/useTestnetIndicator.web.ts',
    'apps/mobile/src/hooks/useAccountTypeLabel.ts',
    'apps/mobile/src/hooks/useIsDataSigningBlocked.ts',
    'apps/mobile/src/hooks/useNfdResolve.ts',
    'apps/mobile/src/hooks/useQuantumDappWarning.tsx',
    'apps/mobile/src/hooks/useResolvedAddress.ts',
]

const sharedAppViolations = async () => {
    const runs = await Promise.all(
        SHARED_APP_GLOBS.map(glob => runRule(RULE, glob)),
    )

    return runs.flat()
}

describe('pera/no-legacy-chain-in-shared-app-code', () => {
    it('reports the import and every use of LEGACY_CHAIN_ID in a shared hook', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v =>
                    v.file.endsWith('shared-hook.legacy-chain.bad.ts'),
                ),
            ),
        ).toEqual([
            'shared-hook.legacy-chain.bad.ts:5',
            'shared-hook.legacy-chain.bad.ts:9',
        ])
    })

    it('reports the import and every use of LEGACY_CHAIN_ID in a shared component', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v =>
                    v.file.endsWith('shared-component.legacy-chain.bad.ts'),
                ),
            ),
        ).toEqual([
            'shared-component.legacy-chain.bad.ts:5',
            'shared-component.legacy-chain.bad.ts:9',
        ])
    })

    it('ignores strings, comments and member access', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(
                v =>
                    v.file.endsWith('shared-hook.legacy-chain.good.ts') ||
                    v.file.endsWith('shared-component.legacy-chain.good.ts'),
            ),
        ).toEqual([])
    })

    it('ignores a module, the bootstrap and modules/algorand', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(
                v =>
                    v.file.endsWith('legacy-chain.bad.ts') &&
                    !v.file.includes('/hooks/') &&
                    !v.file.includes('/components/'),
            ),
        ).toEqual([])
        expect(
            found.filter(v =>
                v.file.endsWith('legacy-chain.exempt.bootstrap.ts'),
            ),
        ).toEqual([])
        expect(
            found.filter(v =>
                v.file.endsWith('legacy-chain.exempt.algorand.ts'),
            ),
        ).toEqual([])
    })

    it('reports exactly the baseline files across the shared app code', async () => {
        const found = await sharedAppViolations()

        expect([...new Set(found.map(v => v.file))].sort()).toEqual(
            SHARED_APP_BASELINE,
        )
    })
})
