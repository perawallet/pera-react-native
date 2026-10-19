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
import { describe, expect, it } from 'vitest'
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
    displayAmount: Nullable<Decimal>,
    asset: Nullable<PeraAsset> = USDC,
): GroupedHoldingMember<Holding> => ({
    holding: { scope: { chainId, networkId: 'mainnet' }, assetId: chainId },
    asset,
    displayAmount,
    usdPrice: new Decimal(1),
})

const groupOf = (
    members: GroupedHoldingMember<Holding>[],
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
    isExpanded: false,
})

// Doubles the USD value into "EUR", so the sum shows conversion happened.
const toEur: AssetFiatConverter = (_ref, usdPrice, amount) => ({
    displayCurrency: 'EUR',
    value: usdPrice ? amount.mul(usdPrice).mul(2) : null,
})

describe('useAssetGroupRow', () => {
    it("sums each network's value in the preferred currency", () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf([
                    member('algorand', new Decimal('2.5')),
                    member('ethereum', new Decimal('1.5')),
                ]),
                convertFiat: toEur,
            }),
        )

        expect(result.current.fiat?.displayCurrency).toBe('EUR')
        expect(result.current.fiat?.value?.toString()).toBe('8')
        expect(result.current.chainIds).toEqual(['algorand', 'ethereum'])
        expect(result.current.icon).toBe(USDC)
    })

    it('leaves the value unknown while a member has no price', () => {
        const unpriced: AssetFiatConverter = (ref, usdPrice, amount) =>
            ref.chainId === 'ethereum'
                ? { displayCurrency: 'EUR', value: null }
                : toEur(ref, usdPrice, amount)

        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf([
                    member('algorand', new Decimal(1)),
                    member('ethereum', new Decimal(1)),
                ]),
                convertFiat: unpriced,
            }),
        )

        expect(result.current.fiat).toEqual({
            displayCurrency: 'EUR',
            value: null,
        })
    })

    it("has no value or icon while the first member's metadata hasn't synced", () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf([
                    member('algorand', null, null),
                    member('ethereum', new Decimal(1)),
                ]),
                convertFiat: toEur,
            }),
        )

        expect(result.current.fiat).toBeNull()
        expect(result.current.icon).toBeNull()
    })
})
