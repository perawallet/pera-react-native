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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    accountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { useRekeyedAccountInfoContent } from '../useRekeyedAccountInfoContent'

const mocks = vi.hoisted(() => ({
    useAccountBalancesQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountBalancesQuery: mocks.useAccountBalancesQuery,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useIsNativeAssetId: () => (assetId: string) => assetId === '0',
}))

const rekeyed = (rekeyAddress?: string) =>
    ({
        id: 'rekeyed',
        address: 'REKEYED_ADDR',
        custody: { kind: 'watch' },
        rekeyAddress,
    }) as WalletAccount

describe('useRekeyedAccountInfoContent', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        vi.clearAllMocks()
        mocks.useAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map(),
            isPending: false,
        })
    })

    it('looks the auth address up as one watch account at that address', () => {
        renderHook(() =>
            useRekeyedAccountInfoContent({ account: rekeyed('AUTH_ADDR') }),
        )

        const [authAccounts, isEnabled] =
            mocks.useAccountBalancesQuery.mock.calls[1]
        expect(authAccounts).toHaveLength(1)
        expect(authAccounts[0].address).toBe('AUTH_ADDR')
        expect(accountType(authAccounts[0])).toBe('watch')
        expect(isEnabled).toBe(true)
    })

    it('looks up no auth account when the account is not rekeyed', () => {
        renderHook(() =>
            useRekeyedAccountInfoContent({ account: rekeyed(undefined) }),
        )

        expect(mocks.useAccountBalancesQuery.mock.calls[1]).toEqual([[], false])
    })
})
