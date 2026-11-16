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
import { Decimal } from 'decimal.js'
import { describe, expect, it, vi } from 'vitest'
import type { BalanceImpactItem } from '../../BalanceImpactSummary'
import { useWalletChangesCard } from '../useWalletChangesCard'

const mockRate = vi.hoisted(() => ({ current: 2 as number | null }))
vi.mock('@perawallet/wallet-core-currencies', async importOriginal => ({
    ...(await importOriginal<object>()),
    useCurrency: () => ({
        usdToPreferred: (usd: Decimal) =>
            mockRate.current === null ? null : usd.times(mockRate.current),
    }),
}))

vi.mock('@hooks/useHomeChainScope', () => ({
    useHomeChainScope: () => ({ chainId: 'ethereum', networkId: 'mainnet' }),
}))

const itemOf = (
    amount: string,
    usdPrice?: string,
    overrides: Partial<BalanceImpactItem> = {},
) =>
    ({
        amount: new Decimal(amount),
        usdPrice: usdPrice === undefined ? undefined : new Decimal(usdPrice),
        isCollectible: false,
        isFullBalance: false,
        ...overrides,
    }) as BalanceImpactItem

const netOf = (spend: BalanceImpactItem[], receive: BalanceImpactItem[]) =>
    renderHook(() => useWalletChangesCard(spend, receive)).result.current

describe('useWalletChangesCard', () => {
    it('gives received minus sent in the preferred currency', () => {
        mockRate.current = 2

        const { netChange, isNetNeutral } = netOf(
            [itemOf('0.0319', '140')],
            [itemOf('0.0023', '1966')],
        )

        // (0.0023 * 1966 - 0.0319 * 140) * 2
        expect(netChange?.toFixed()).toBe('0.1116')
        expect(isNetNeutral).toBe(false)
    })

    it('calls a loss under a cent the same value', () => {
        mockRate.current = 1

        const { netChange, isNetNeutral } = netOf(
            [itemOf('0.001', '1930')],
            [itemOf('0.000999', '1930')],
        )

        expect(netChange?.isNegative()).toBe(true)
        expect(isNetNeutral).toBe(true)
    })

    it('has no net change when value only goes one way', () => {
        expect(netOf([itemOf('1', '1')], []).netChange).toBeNull()
        expect(netOf([], [itemOf('1', '1')]).netChange).toBeNull()
    })

    it('has no net change when a row has no price, is an NFT or empties a balance', () => {
        const received = [itemOf('1', '1')]

        expect(netOf([itemOf('1')], received).netChange).toBeNull()
        expect(
            netOf([itemOf('1', '1', { isCollectible: true })], received)
                .netChange,
        ).toBeNull()
        expect(
            netOf([itemOf('1', '1', { isFullBalance: true })], received)
                .netChange,
        ).toBeNull()
    })

    it('has no net change until the currency rate is known', () => {
        mockRate.current = null

        expect(
            netOf([itemOf('1', '1')], [itemOf('1', '2')]).netChange,
        ).toBeNull()
    })
})
