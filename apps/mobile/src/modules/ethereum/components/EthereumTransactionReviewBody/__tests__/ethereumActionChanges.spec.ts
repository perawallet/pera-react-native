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

import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { EthereumContractActionPresentation } from '../../../hooks/useEthereumContractAction'
import {
    ethereumActionAssetIdsOf,
    ethereumActionChangesOf,
} from '../ethereumActionChanges'

const ETH = { assetId: 'eth', unitName: 'ETH', decimals: 18 } as PeraAsset
const WETH = { assetId: '0xweth', unitName: 'WETH', decimals: 18 } as PeraAsset
const USDC = { assetId: '0xusdc', unitName: 'USDC', decimals: 6 } as PeraAsset
const PRICES: Record<string, Decimal> = { eth: new Decimal(3000) }

const amount = (asset: PeraAsset | null, value: string) => ({
    asset,
    value: new Decimal(value),
    isBaseUnits: !asset,
})

const changesOf = (
    action: EthereumContractActionPresentation,
    wrappedNative: PeraAsset | null = null,
) =>
    ethereumActionChangesOf(
        action,
        wrappedNative,
        'base',
        assetId => PRICES[assetId],
    )

const summary = (items: { asset: { unitName?: string }; amount: Decimal }[]) =>
    items.map(item => `${item.amount.toString()} ${item.asset.unitName}`)

describe('ethereumActionChangesOf', () => {
    it('shows a gateway supply as the native coin sent, priced', () => {
        const { spend, receive } = changesOf({
            kind: 'supply',
            amount: amount(ETH, '0.005'),
            isEntireBalance: false,
        })

        expect(summary(spend)).toEqual(['0.005 ETH'])
        expect(spend[0]?.usdPrice).toEqual(new Decimal(3000))
        expect(receive).toEqual([])
    })

    it('shows a withdrawal as received, and nothing for the whole balance', () => {
        expect(
            summary(
                changesOf({
                    kind: 'withdraw',
                    amount: amount(ETH, '1'),
                    isEntireBalance: false,
                }).receive,
            ),
        ).toEqual(['1 ETH'])
        expect(
            changesOf({
                kind: 'withdraw',
                amount: amount(ETH, '1'),
                isEntireBalance: true,
            }),
        ).toEqual({ spend: [], receive: [] })
    })

    it('shows both sides of a wrap and an unwrap', () => {
        const wrap = changesOf({ kind: 'wrap', amount: amount(ETH, '2') }, WETH)
        const unwrap = changesOf(
            { kind: 'unwrap', amount: amount(ETH, '2') },
            WETH,
        )

        expect([summary(wrap.spend), summary(wrap.receive)]).toEqual([
            ['2 ETH'],
            ['2 WETH'],
        ])
        expect([summary(unwrap.spend), summary(unwrap.receive)]).toEqual([
            ['2 WETH'],
            ['2 ETH'],
        ])
    })

    it('shows only a swap leg the calldata fixes, never a limit', () => {
        const { spend, receive } = changesOf({
            kind: 'swap',
            input: { ...amount(USDC, '10'), bound: 'exact' },
            output: { ...amount(ETH, '0.003'), bound: 'at-least' },
            fees: [],
        })

        expect(summary(spend)).toEqual(['10 USDC'])
        expect(receive).toEqual([])
    })

    it('skips an amount still in base units for want of its record', () => {
        expect(
            changesOf({
                kind: 'supply',
                assetContract: '0xusdc',
                amount: amount(null, '3000000'),
                isEntireBalance: false,
            }),
        ).toEqual({ spend: [], receive: [] })
    })

    it('lists the asset ids to price', () => {
        expect(
            ethereumActionAssetIdsOf(
                { kind: 'wrap', amount: amount(ETH, '1') },
                WETH,
            ),
        ).toEqual(['eth', '0xweth'])
    })
})
