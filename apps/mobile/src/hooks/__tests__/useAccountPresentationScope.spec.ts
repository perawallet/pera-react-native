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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useAccountPresentationScope } from '@hooks/useAccountPresentationScope'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { accountForType } from '@test-utils/accountCustody'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { registerEthereumAccountsAdapter } from '@test-utils/ethereumAccountsAdapter'

// The shared mock stubs the chain list; this reads the real one.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-accounts')>(),
)

const ethereumOnlyAccount: WalletAccount = {
    id: 'eth',
    name: '',
    custody: { kind: 'watch' },
    chains: {
        ethereum: { address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed' },
    },
}

describe('useAccountPresentationScope', () => {
    beforeEach(registerAlgorandAccountsAdapter)
    afterEach(restoreAlgorandOnlyChains)

    it('reads an Algorand account on Algorand', () => {
        const { result } = renderHook(() =>
            useAccountPresentationScope(accountForType('standalone')),
        )

        expect(result.current.chainId).toBe('algorand')
    })

    it('reads an account with no Algorand entry on its own chain', () => {
        registerEthereumChain()
        registerEthereumAccountsAdapter()

        const { result } = renderHook(() =>
            useAccountPresentationScope(ethereumOnlyAccount),
        )

        expect(result.current.chainId).toBe('ethereum')
    })

    it('falls back to the home chain when no adapter reads the account chain', () => {
        const { result } = renderHook(() =>
            useAccountPresentationScope(ethereumOnlyAccount),
        )

        expect(result.current.chainId).toBe('algorand')
    })

    it('reads the home chain while there is no account', () => {
        const { result } = renderHook(() =>
            useAccountPresentationScope(undefined),
        )

        expect(result.current.chainId).toBe('algorand')
    })
})
