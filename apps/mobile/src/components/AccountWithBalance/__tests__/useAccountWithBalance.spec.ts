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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useAccountWithBalance } from '../useAccountWithBalance'

const mockUseIsOnTestTier = vi.fn()
const mockAccountValueTotals = new Map<string, { nativeValue: Decimal }>()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    addressOn: (account: WalletAccount, scope: { chainId: string }) =>
        (account.chains as Record<string, { address: string }>)[scope.chainId]
            ?.address,
    useAccountValueTotalsQuery: () => ({
        accountValueTotals: mockAccountValueTotals,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useIsOnTestTier: (chainIds: readonly string[]) =>
        mockUseIsOnTestTier(chainIds),
}))

const ADDRESS = 'A'.repeat(58)

const ACCOUNT: WalletAccount = {
    id: 'account-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: ADDRESS } },
}

describe('useAccountWithBalance', () => {
    beforeEach(() => {
        mockUseIsOnTestTier.mockReset()
        mockAccountValueTotals.clear()
    })

    it("returns the account's native value from the totals", () => {
        mockUseIsOnTestTier.mockReturnValue(false)
        mockAccountValueTotals.set(ADDRESS, { nativeValue: new Decimal(12) })

        const { result } = renderHook(() => useAccountWithBalance(ACCOUNT))

        expect(result.current.nativeValue).toEqual(new Decimal(12))
    })

    it("marks the account as test tier from its chains' networks", () => {
        mockUseIsOnTestTier.mockReturnValue(true)

        const { result } = renderHook(() => useAccountWithBalance(ACCOUNT))

        expect(mockUseIsOnTestTier).toHaveBeenCalledWith(['algorand'])
        expect(result.current.isTestTier).toBe(true)
    })

    it('does not mark an account on a mainnet-tier network', () => {
        mockUseIsOnTestTier.mockReturnValue(false)

        const { result } = renderHook(() => useAccountWithBalance(ACCOUNT))

        expect(result.current.isTestTier).toBe(false)
    })
})
