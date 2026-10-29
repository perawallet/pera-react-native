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
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { usePreferredAmount } from '@components/PreferredAmount'
import { useSendTotal } from '../useSendTotal'

const ETHER = vi.hoisted(() => ({
    assetId: 'native',
    unitName: 'ETH',
    decimals: 18,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => ETHER,
    useIsNativeAssetId: () => (id: string) => id === 'native',
    isCollectible: (asset: { peraMetadata?: { type?: string } }) =>
        asset.peraMetadata?.type === 'collectible',
    toWholeUnits: (value: Decimal, asset: { decimals: number }) =>
        value.div(new Decimal(10).pow(asset.decimals)),
}))

// The barrel pulls in the component tree; the precision policy is all this needs.
vi.mock('@components/CurrencyAmount', () =>
    vi.importActual('@components/CurrencyAmount/precision'),
)

vi.mock('@components/PreferredAmount', () => ({
    usePreferredAmount: vi.fn(),
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as ChainScope
const USDC = {
    assetId: '0xusdc',
    unitName: 'USDC',
    decimals: 6,
} as PeraAsset
const ETHER_ASSET = ETHER as PeraAsset
// 0.000008523412 ETH, which the fee row shows as 0.00000852.
const FEE_WEI = new Decimal('8523412000000')

const priceAt = (usdPerUnit: Record<string, number>) =>
    vi
        .mocked(usePreferredAmount)
        .mockImplementation((sourceAmount, sourceAssetId) => ({
            displayCurrency: 'USD',
            convertedValue:
                sourceAmount && sourceAssetId in usdPerUnit
                    ? sourceAmount.mul(usdPerUnit[sourceAssetId])
                    : null,
            isPending: false,
        }))

describe('useSendTotal', () => {
    beforeEach(() => {
        priceAt({ native: 2000, '0xusdc': 1 })
    })

    it('adds the fee, as the fee row rounds it, to a native send', () => {
        const { result } = renderHook(() =>
            useSendTotal({
                scope: SCOPE,
                asset: ETHER_ASSET,
                amount: new Decimal('0.5'),
                feeAmount: FEE_WEI,
            }),
        )

        expect(result.current.isPending).toBe(false)
        expect(result.current.lines).toHaveLength(1)
        expect(result.current.lines[0].asset).toBe(ETHER_ASSET)
        expect(result.current.lines[0].amount.toFixed()).toBe('0.50000852')
    })

    it('lists a token send and its native fee apart', () => {
        const { result } = renderHook(() =>
            useSendTotal({
                scope: SCOPE,
                asset: USDC,
                amount: new Decimal(25),
                feeAmount: FEE_WEI,
            }),
        )

        expect(
            result.current.lines.map(line => [
                line.asset.unitName,
                line.amount.toFixed(),
            ]),
        ).toEqual([
            ['USDC', '25'],
            ['ETH', '0.00000852'],
        ])
    })

    it('sums the amount and the fee in the preferred currency', () => {
        const { result } = renderHook(() =>
            useSendTotal({
                scope: SCOPE,
                asset: USDC,
                amount: new Decimal(25),
                feeAmount: FEE_WEI,
            }),
        )

        expect(result.current.preferredValue?.toFixed()).toBe('25.01704')
        expect(usePreferredAmount).toHaveBeenCalledWith(
            new Decimal(25),
            '0xusdc',
            false,
            undefined,
            SCOPE,
        )
    })

    it('has no preferred total while a price is missing', () => {
        priceAt({ native: 2000 })

        const { result } = renderHook(() =>
            useSendTotal({
                scope: SCOPE,
                asset: USDC,
                amount: new Decimal(25),
                feeAmount: FEE_WEI,
            }),
        )

        expect(result.current.preferredValue).toBeUndefined()
        expect(result.current.lines).toHaveLength(2)
    })

    it('has no preferred total for a collectible', () => {
        const collectible = {
            ...USDC,
            peraMetadata: { type: 'collectible' },
        } as unknown as PeraAsset

        const { result } = renderHook(() =>
            useSendTotal({
                scope: SCOPE,
                asset: collectible,
                amount: new Decimal(1),
                feeAmount: FEE_WEI,
            }),
        )

        expect(result.current.preferredValue).toBeUndefined()
    })

    it('is pending with no lines until the fee is known', () => {
        const { result } = renderHook(() =>
            useSendTotal({
                scope: SCOPE,
                asset: ETHER_ASSET,
                amount: new Decimal('0.5'),
                feeAmount: undefined,
            }),
        )

        expect(result.current).toMatchObject({
            lines: [],
            preferredValue: undefined,
            isPending: true,
        })
    })
})
