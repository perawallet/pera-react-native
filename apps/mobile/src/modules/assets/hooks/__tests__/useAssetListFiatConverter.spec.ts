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
import { Decimal } from 'decimal.js'
import { useAssetListFiatConverter } from '../useAssetListFiatConverter'

const ETHER = { assetId: 'eth', unitName: 'ETH' }

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => ({ assetId: '0', unitName: 'ALGO' }),
    findNativeAsset: (chainId: string) =>
        chainId === 'ethereum' ? ETHER : undefined,
}))

// ETH is the preferred currency; USD converts at 1:0.5, USD to EUR at 1:2.
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: 'ETH',
        fallbackCurrency: 'EUR',
        usdToPreferred: (usd: Decimal) => usd.mul('0.5'),
    }),
    usePreferredCurrencyPriceQuery: () => ({
        data: { usdPrice: new Decimal(2) },
    }),
}))

describe('useAssetListFiatConverter', () => {
    it('prices a native holding in the fallback currency when the preferred one is its own unit', () => {
        const { result } = renderHook(() => useAssetListFiatConverter())

        expect(
            result.current(
                { chainId: 'ethereum', assetId: ETHER.assetId },
                new Decimal(3),
                new Decimal(2),
            ),
        ).toEqual({ displayCurrency: 'EUR', value: new Decimal(12) })
    })

    it('values a zero holding at zero without a price, and a held one as unknown', () => {
        const { result } = renderHook(() => useAssetListFiatConverter())
        const usdc = { chainId: 'ethereum' as const, assetId: '0xA0b8' }

        expect(result.current(usdc, null, new Decimal(0)).value).toEqual(
            new Decimal(0),
        )
        expect(result.current(usdc, null, new Decimal(1)).value).toBeNull()
    })

    it('leaves a zero no read vouches for unvalued, priced or not', () => {
        const { result } = renderHook(() =>
            useAssetListFiatConverter(new Set(['base'])),
        )
        const onBase = { chainId: 'base' as const, assetId: 'native' }

        expect(
            result.current(onBase, new Decimal(3), new Decimal(0)).value,
        ).toBeNull()
        expect(result.current(onBase, null, new Decimal(0)).value).toBeNull()
        expect(
            result.current(
                { chainId: 'ethereum', assetId: ETHER.assetId },
                null,
                new Decimal(0),
            ).value,
        ).toEqual(new Decimal(0))
    })

    it('converts a plain USD amount with no asset straight to the preferred currency', () => {
        const { result } = renderHook(() => useAssetListFiatConverter())

        expect(result.current(null, new Decimal(6), new Decimal(1))).toEqual({
            displayCurrency: 'ETH',
            value: new Decimal(3),
        })
    })
})
