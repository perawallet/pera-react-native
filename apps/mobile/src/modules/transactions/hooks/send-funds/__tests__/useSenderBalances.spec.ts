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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useAccountStateQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSenderBalances } from '../useSenderBalances'

const ACCOUNT: WalletAccount = {
    id: 'sender',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'SENDER' } },
}

const algorandState = (totalAssetsOptedIn: number) => ({
    address: 'SENDER',
    scope: { chainId: 'algorand' as const, networkId: 'mainnet' as const },
    nativeBalance: new Decimal('12.345678'),
    reserveBalance: new Decimal(200_000),
    heldTokenCount: totalAssetsOptedIn,
    chainState: {
        family: 'algorand' as const,
        minBalance: new Decimal(200_000),
        status: 'Offline' as const,
        totalAssetsOptedIn,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
    },
})

describe('useSenderBalances', () => {
    it('is undefined until the state loads', () => {
        vi.mocked(useAccountStateQuery).mockReturnValue({
            data: undefined,
            isPending: true,
            isLoading: true,
            isSuccess: false,
        })

        const { result } = renderHook(() => useSenderBalances(ACCOUNT))

        expect(result.current).toBeUndefined()
    })

    it('reports the balance and minimum balance in native base units', () => {
        vi.mocked(useAccountStateQuery).mockReturnValue({
            data: algorandState(2),
            isPending: false,
            isLoading: false,
            isSuccess: true,
        } as never)

        const { result } = renderHook(() => useSenderBalances(ACCOUNT))

        expect(result.current).toEqual({
            amount: 12_345_678n,
            minBalance: 200_000n,
            hasOptedInAssets: true,
        })
    })

    it('reports no opted-in assets when the account holds none', () => {
        vi.mocked(useAccountStateQuery).mockReturnValue({
            data: algorandState(0),
            isPending: false,
            isLoading: false,
            isSuccess: true,
        } as never)

        const { result } = renderHook(() => useSenderBalances(ACCOUNT))

        expect(result.current?.hasOptedInAssets).toBe(false)
    })

    it('reads a chain with no reserve as a zero minimum balance', () => {
        vi.mocked(useAccountStateQuery).mockReturnValue({
            data: {
                address: 'SENDER',
                scope: { chainId: 'ethereum', networkId: 'mainnet' },
                nativeBalance: new Decimal('1'),
                reserveBalance: new Decimal(0),
                heldTokenCount: 0,
                chainState: {
                    family: 'evm',
                    nonce: { latest: 0, pending: 0 },
                },
            },
            isPending: false,
            isLoading: false,
            isSuccess: true,
        } as never)

        const { result } = renderHook(() => useSenderBalances(ACCOUNT))

        expect(result.current?.minBalance).toBe(0n)
        expect(result.current?.hasOptedInAssets).toBe(false)
    })

    it('queries no account when nothing is selected', () => {
        renderHook(() => useSenderBalances(null))

        expect(vi.mocked(useAccountStateQuery).mock.lastCall?.[0]).toBeNull()
    })
})
