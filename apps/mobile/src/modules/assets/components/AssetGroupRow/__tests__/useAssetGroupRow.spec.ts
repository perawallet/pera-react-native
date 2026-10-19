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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AssetFiatConverter } from '../../../hooks/useAssetListFiatConverter'
import type {
    AssetGroupItem,
    GroupedHoldingMember,
} from '../../../utils/groupedHoldings'
import { useAssetGroupRow } from '../useAssetGroupRow'

type Holding = { scope: ChainScope; assetId: string }

const USDC = { assetId: '31566704', name: 'USD Coin' } as PeraAsset

const member = (
    chainId: 'algorand' | 'ethereum',
    asset: Nullable<PeraAsset> = USDC,
): GroupedHoldingMember<Holding> => ({
    holding: { scope: { chainId, networkId: 'mainnet' }, assetId: chainId },
    asset,
    displayAmount: new Decimal(1),
    usdPrice: new Decimal(1),
})

const groupOf = (
    members: GroupedHoldingMember<Holding>[],
    usdValue: Nullable<Decimal>,
): AssetGroupItem<Holding> => ({
    kind: 'group',
    group: {
        id: 'usdc',
        name: 'USD Coin',
        symbol: 'USDC',
        logoUrl: null,
        members: [],
    },
    members,
    amount: null,
    usdValue,
    isExpanded: false,
})

// Doubles the USD value into "EUR", so the result shows conversion happened.
const toEur: AssetFiatConverter = (_ref, usdPrice, amount) => ({
    displayCurrency: 'EUR',
    value: usdPrice ? amount.mul(usdPrice).mul(2) : null,
})

describe('useAssetGroupRow', () => {
    it("converts the group's USD total to the preferred currency, as a plain amount", () => {
        const convertFiat = vi.fn(toEur)

        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf(
                    [member('algorand'), member('ethereum')],
                    new Decimal('4'),
                ),
                convertFiat,
            }),
        )

        expect(result.current.fiat.displayCurrency).toBe('EUR')
        expect(result.current.fiat.value?.toString()).toBe('8')
        expect(convertFiat.mock.calls[0]?.[0]).toBeNull()
        expect(result.current.chainIds).toEqual(['algorand', 'ethereum'])
        expect(result.current.icon).toBe(USDC)
    })

    it('leaves the value unknown while the USD total is', () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf([member('algorand'), member('ethereum')], null),
                convertFiat: toEur,
            }),
        )

        expect(result.current.fiat).toEqual({
            displayCurrency: 'EUR',
            value: null,
        })
    })

    it("has no icon while the first member's metadata hasn't synced", () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf(
                    [member('algorand', null), member('ethereum')],
                    null,
                ),
                convertFiat: toEur,
            }),
        )

        expect(result.current.icon).toBeNull()
    })
})
