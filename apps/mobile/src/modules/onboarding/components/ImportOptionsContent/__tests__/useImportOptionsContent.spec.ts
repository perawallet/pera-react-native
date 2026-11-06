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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { capabilityState } from '@test-utils/capability-mock'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { useImportOptionsContent } from '../useImportOptionsContent'

vi.mock('@perawallet/wallet-core-accounts', async () =>
    vi.importActual<object>('@perawallet/wallet-core-accounts'),
)

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

describe('useImportOptionsContent', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        capabilityState.reset()
    })

    it("offers Universal Wallet, Quantum, Algo25 and the 12-word seed in the chain's chooser order", () => {
        const { result } = renderHook(() =>
            useImportOptionsContent({ chainId: 'algorand' }),
        )

        expect(result.current.options.map(o => o.seed)).toEqual([
            'bip39',
            'quantum',
            null,
            'bip39',
        ])
        expect(result.current.options.map(o => o.wordCount)).toEqual([
            24, 25, 25, 12,
        ])
        expect(result.current.options.map(o => o.testID)).toEqual([
            'import_options_hd_wallet_button',
            'import_options_quantum_button',
            'import_options_algo25_button',
            'import_options_twelve_word_button',
        ])
    })

    it('drops Quantum while quantum accounts are off', () => {
        capabilityState.turnOff('quantumAccounts')

        const { result } = renderHook(() =>
            useImportOptionsContent({ chainId: 'algorand' }),
        )

        expect(result.current.options.map(o => o.testID)).toEqual([
            'import_options_hd_wallet_button',
            'import_options_algo25_button',
            'import_options_twelve_word_button',
        ])
    })

    it('chips only the legacy kind', () => {
        const { result } = renderHook(() =>
            useImportOptionsContent({ chainId: 'algorand' }),
        )

        expect(
            result.current.options.filter(o => o.chipKey).map(o => o.seed),
        ).toEqual([null])
    })
})
