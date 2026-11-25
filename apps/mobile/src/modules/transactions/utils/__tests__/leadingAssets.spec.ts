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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type BalanceChange,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { leadingAssetsOf, swapChainIdsOf } from '../leadingAssets'

const leg = (
    assetId: string,
    value: number,
    chainId: 'ethereum' | 'base' = 'ethereum',
): BalanceChange => ({
    assetRef: { chainId, assetId },
    value: new Decimal(value),
    display: { symbol: assetId.toUpperCase(), decimals: 0 },
})

const summaryOf = (
    kind: TransactionSummary['kind'],
    extra: Partial<TransactionSummary>,
): TransactionSummary => ({
    kind,
    title: { key: i18nKey('transactions.list_item.send') },
    icon: 'send',
    direction: 'out',
    ...extra,
})

const transfer = summaryOf('token-transfer', {
    amount: {
        assetRef: { chainId: 'ethereum', assetId: 'usdc' },
        value: new Decimal(5),
        display: { symbol: 'USDC', decimals: 6 },
    },
})

describe('leadingAssetsOf', () => {
    it('leads a transfer with its stored asset', () => {
        const usdc = { assetId: 'usdc', unitName: 'USDC', name: 'USD Coin' }
        const stored = new Map([['usdc', usdc as PeraAsset]])

        expect(leadingAssetsOf(transfer, stored)).toEqual([
            { chainId: 'ethereum', asset: usdc },
        ])
    })

    it('falls back to the history’s own symbol for an asset the store lacks', () => {
        expect(leadingAssetsOf(transfer, undefined)).toEqual([
            {
                chainId: 'ethereum',
                asset: { assetId: 'usdc', unitName: 'USDC' },
            },
        ])
    })

    it('leads a swap with what it paid, then what it returned, whatever their order', () => {
        const swap = summaryOf('swap', {
            balanceChanges: [leg('usdc', 4), leg('eth', -1)],
        })

        expect(
            leadingAssetsOf(swap, undefined).map(lead => lead.asset.assetId),
        ).toEqual(['eth', 'usdc'])
    })

    it('leads nothing for a swap missing a side, or a call moving several assets', () => {
        const oneSided = summaryOf('swap', { balanceChanges: [leg('eth', -1)] })
        const call = summaryOf('contract-call', {
            balanceChanges: [leg('eth', -1), leg('usdc', 4)],
        })

        expect(leadingAssetsOf(oneSided, undefined)).toEqual([])
        expect(leadingAssetsOf(call, undefined)).toEqual([])
    })
})

describe('swapChainIdsOf', () => {
    it('lists each network a swap’s legs are on, once', () => {
        const crossChain = summaryOf('swap', {
            balanceChanges: [
                leg('eth', -1),
                leg('gas', -1),
                leg('usdc', 4, 'base'),
            ],
        })

        expect(swapChainIdsOf(crossChain)).toEqual(['ethereum', 'base'])
    })

    it('lists none for anything but a swap', () => {
        expect(swapChainIdsOf(transfer)).toEqual([])
    })
})
