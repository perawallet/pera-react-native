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

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapAccountAddresses } from '../useSwapAccountAddresses'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapAccountsAddresses: (accounts: WalletAccount[]) =>
        accounts.map(account => ({
            scope: SCOPE,
            address: `${account.id}-address`,
            accountId: account.id,
        })),
}))

describe('useSwapAccountAddresses', () => {
    it("lists the account's swap addresses without the account tag", () => {
        const account = { id: 'main' } as WalletAccount

        const { result } = renderHook(() => useSwapAccountAddresses(account))

        expect(result.current).toEqual([
            { scope: SCOPE, address: 'main-address' },
        ])
    })

    it('lists nothing without an account', () => {
        const { result } = renderHook(() => useSwapAccountAddresses(null))

        expect(result.current).toEqual([])
    })
})
