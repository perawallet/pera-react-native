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
import {
    getAccountDisplayName,
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useTransactionDetailAddressRow } from '../useTransactionDetailAddressRow'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useFindAccountByAddress: vi.fn(),
    getAccountDisplayName: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS = '0x00000000000000000000000000000000000000aa'
const ACCOUNT = { id: 'a1', name: 'Savings' } as WalletAccount

describe('useTransactionDetailAddressRow', () => {
    beforeEach(() => {
        vi.mocked(useFindAccountByAddress).mockReset()
        vi.mocked(getAccountDisplayName).mockReset()
    })

    it("Given the user's own address, then it names that account", () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(ACCOUNT)
        vi.mocked(getAccountDisplayName).mockReturnValue('Savings')

        const { result } = renderHook(() =>
            useTransactionDetailAddressRow(ADDRESS, SCOPE),
        )

        expect(useFindAccountByAddress).toHaveBeenCalledWith(ADDRESS, SCOPE)
        expect(getAccountDisplayName).toHaveBeenCalledWith(ACCOUNT, 'ethereum')
        expect(result.current).toEqual({
            ownAccount: ACCOUNT,
            ownAccountName: 'Savings',
        })
    })

    it('Given an address the user does not hold on this chain, then it names no account', () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)

        const { result } = renderHook(() =>
            useTransactionDetailAddressRow(ADDRESS, SCOPE),
        )

        expect(result.current).toEqual({
            ownAccount: null,
            ownAccountName: undefined,
        })
        expect(getAccountDisplayName).not.toHaveBeenCalled()
    })
})
