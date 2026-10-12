/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AuthorityTargetCategories } from '@perawallet/wallet-core-accounts'
import { capabilityState } from '@test-utils/capability-mock'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { registerTargetFixtureChain } from '@modules/rekey/screens/__tests__/authorityTargetFixture'
import { useRekeyOptionsContent } from '../useRekeyOptionsContent'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

const testIDs = (): string[] =>
    renderHook(() => useRekeyOptionsContent()).result.current.rows.map(
        row => row.testID,
    )

describe('useRekeyOptionsContent', () => {
    beforeEach(() => {
        capabilityState.reset()
        registerAlgorandAccountsAdapter()
    })

    it("offers Algorand's Ledger, standard and quantum targets in that order", () => {
        const { result } = renderHook(() => useRekeyOptionsContent())

        expect(result.current.rows).toEqual([
            {
                target: AuthorityTargetCategories.hardware,
                testID: 'rekey_option_ledger',
                titleKey: 'account_options.rekey_option_ledger_title',
                descriptionKey:
                    'account_options.rekey_option_ledger_description',
                icon: 'ledger',
            },
            {
                target: AuthorityTargetCategories.standard,
                testID: 'rekey_option_standard',
                titleKey: 'account_options.rekey_option_standard_title',
                descriptionKey:
                    'account_options.rekey_option_standard_description',
                icon: 'wallet',
            },
            {
                target: AuthorityTargetCategories.postQuantum,
                testID: 'rekey_option_quantum',
                titleKey: 'account_options.rekey_option_quantum_title',
                descriptionKey:
                    'account_options.rekey_option_quantum_description',
                icon: 'quantum',
            },
        ])
    })

    it('drops the Ledger row when ledger is off and the quantum row when quantum accounts are off', () => {
        capabilityState.turnOff('ledger')
        capabilityState.turnOff('quantumAccounts')

        expect(testIDs()).toEqual(['rekey_option_standard'])
    })

    it('shows no post-quantum row on a chain that lists no post-quantum target kind', () => {
        registerTargetFixtureChain(
            [
                { id: 'ed', category: AuthorityTargetCategories.standard },
                { id: 'hw', category: AuthorityTargetCategories.hardware },
            ],
            {},
        )

        expect(testIDs()).toEqual([
            'rekey_option_ledger',
            'rekey_option_standard',
        ])
    })

    it('shows only the rows of the categories the chain lists', () => {
        registerTargetFixtureChain(
            [
                {
                    id: 'pq',
                    category: AuthorityTargetCategories.postQuantum,
                },
            ],
            {},
        )

        expect(testIDs()).toEqual(['rekey_option_quantum'])
    })
})
