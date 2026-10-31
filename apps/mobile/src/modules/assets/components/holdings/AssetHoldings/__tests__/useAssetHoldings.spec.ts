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

import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useAccountAssetBalanceQuery,
    type AccountAssetBalanceHistoryItem,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import { usePreferredAmount } from '@components/PreferredAmount'
import { useCapability } from '@hooks/useCapability'
import { UserPreferences } from '@constants/user-preferences'
import { useAssetHoldings } from '../useAssetHoldings'

const { mockCopyToClipboard, preferences } = vi.hoisted(() => ({
    mockCopyToClipboard: vi.fn(),
    preferences: new Map<string, unknown>(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: vi.fn(),
    usePreferences: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountAssetBalanceQuery: vi.fn(),
}))

vi.mock('@components/PreferredAmount', () => ({
    usePreferredAmount: vi.fn(),
}))

vi.mock('@hooks/useCapability', () => ({
    useCapability: vi.fn(),
}))

const ACCOUNT = { id: 'account-1' } as WalletAccount
const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ETH = {
    assetId: 'native',
    unitName: 'ETH',
} as PeraAsset

const render = () =>
    renderHook(() =>
        useAssetHoldings({ account: ACCOUNT, asset: ETH, scope: SCOPE }),
    )

const holding = (amount: string | null) =>
    vi.mocked(useAccountAssetBalanceQuery).mockReturnValue({
        data: amount === null ? null : { amount: new Decimal(amount) },
    } as ReturnType<typeof useAccountAssetBalanceQuery>)

const price = (convertedValue: Decimal | null, isPending = false) =>
    vi.mocked(usePreferredAmount).mockReturnValue({
        displayCurrency: 'USD',
        convertedValue,
        isPending,
    })

describe('useAssetHoldings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        preferences.clear()
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: false,
        } as ReturnType<typeof useSettings>)
        vi.mocked(usePreferences).mockReturnValue({
            getPreference: (key: string) => preferences.get(key),
            setPreference: (key: string, value: unknown) =>
                preferences.set(key, value),
        } as unknown as ReturnType<typeof usePreferences>)
        vi.mocked(useCapability).mockReturnValue(true)
        holding('1.5')
        price(new Decimal('3000'))
    })

    it('leads with the fiat value of a priced holding and keeps the token amount', () => {
        const { result } = render()

        expect(result.current.isPriced).toBe(true)
        expect(result.current.holdingAmount.toFixed()).toBe('1.5')
        expect(result.current.tokenAmount.toFixed()).toBe('1.5')
        expect(vi.mocked(usePreferredAmount)).toHaveBeenCalledWith(
            result.current.holdingAmount,
            'native',
            undefined,
            undefined,
            SCOPE,
        )
    })

    it('treats a price lookup still in flight as priced, so the layout does not jump', () => {
        price(null, true)

        expect(render().result.current.isPriced).toBe(true)
    })

    it('leads with the token amount once the price lookup settles with no rate', () => {
        price(null)

        expect(render().result.current.isPriced).toBe(false)
    })

    it('values an asset the account does not hold at zero', () => {
        holding(null)

        const { result } = render()

        expect(result.current.holdingAmount.isZero()).toBe(true)
        expect(result.current.isPriced).toBe(true)
    })

    it('updates the period the chart and the change line share', () => {
        const { result } = render()

        act(() => result.current.setPeriod('one-month'))

        expect(result.current.period).toBe('one-month')
    })

    it('reports a chain without balance history and shows it no chart', () => {
        vi.mocked(useCapability).mockReturnValue(false)
        preferences.set(UserPreferences.chartVisible, true)

        const { result } = render()

        expect(result.current.hasBalanceHistory).toBe(false)
        expect(result.current.isChartShown).toBe(false)
    })

    it("follows the chart's period while the chart is shown", () => {
        preferences.set(UserPreferences.chartVisible, true)
        const { result } = render()

        act(() => result.current.setPeriod('one-month'))

        expect(result.current.isChartShown).toBe(true)
        expect(result.current.trendPeriod).toBe('one-month')
    })

    it('follows the 24 hour change when the chart preference is off', () => {
        preferences.set(UserPreferences.chartVisible, false)
        const { result } = render()

        act(() => result.current.setPeriod('one-month'))

        expect(result.current.isChartShown).toBe(false)
        expect(result.current.trendPeriod).toBe('one-day')
    })

    it("shows the scrubbed point's token amount while scrubbing", () => {
        const { result } = render()
        const point: AccountAssetBalanceHistoryItem = {
            datetime: new Date('2025-01-01T00:00:00Z'),
            amount: new Decimal('0.75'),
            preferredValue: new Decimal('1000'),
        }

        act(() => result.current.setSelectedPoint(point))

        expect(result.current.tokenAmount.toFixed()).toBe('0.75')
        expect(result.current.holdingAmount.toFixed()).toBe('1.5')
    })

    it('copies the full-precision amount and names it in the toast', () => {
        holding('0.001344293173000001')
        const { result } = render()

        result.current.handleCopyAmount()

        expect(result.current.canCopyAmount).toBe(true)
        expect(mockCopyToClipboard).toHaveBeenCalledWith(
            '0.001344293173000001',
            { body: '0.001344293173000001 ETH' },
        )
    })

    it('copies nothing in privacy mode', () => {
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: true,
        } as ReturnType<typeof useSettings>)
        const { result } = render()

        result.current.handleCopyAmount()

        expect(result.current.canCopyAmount).toBe(false)
        expect(mockCopyToClipboard).not.toHaveBeenCalled()
    })
})
