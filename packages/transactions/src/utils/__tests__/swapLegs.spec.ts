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
import {
    i18nKey,
    type TransactionRecord,
    type TransactionSummary,
    type TransactionSwapLeg,
} from '@perawallet/wallet-core-chain-contract'
import {
    readSwapLeg,
    summarizeSwapLeg,
    swapLegOf,
    withoutListedSwapPayouts,
    type ResolveSwapAssetRef,
    type SwapLegResponse,
} from '../swapLegs'

const ETH = 'eip155:1/slip44:60'
const USDC = 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const ALGO = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k/asa:0'

// An Ethereum row's resolver: ids on its chain only.
const onEthereum: ResolveSwapAssetRef = routerAssetId =>
    routerAssetId.startsWith('eip155:1/')
        ? { chainId: 'ethereum', assetId: routerAssetId.split('/')[1] }
        : undefined

const assetItem = (asset_id: string, unit_name: string, decimals: number) => ({
    asset_id,
    unit_name,
    fraction_decimals: decimals,
})

const leg = (
    role: string,
    order: Partial<SwapLegResponse['order']> = {},
): SwapLegResponse => ({
    role,
    order: {
        order_id: '42',
        provider: 'xo',
        provider_display_name: null,
        status: 'completed',
        source_asset: assetItem(ETH, 'ETH', 18),
        destination_asset: assetItem(USDC, 'USDC', 6),
        source_amount: '5700000000000000',
        destination_amount_expected: '9830000',
        destination_amount_received: null,
        ...order,
    },
})

const sendSummary: TransactionSummary = {
    kind: 'transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    counterparty: '0x98d0',
    amount: {
        assetRef: { chainId: 'ethereum', assetId: 'slip44:60' },
        value: new Decimal('5700000000000000'),
    },
    icon: 'send',
}

const changes = (summary: TransactionSummary) =>
    summary.balanceChanges?.map(change => [
        change.assetRef.assetId,
        change.value.toString(),
        change.display?.symbol,
    ])

describe('readSwapLeg', () => {
    it("reads the backend's order item, dropping only an unreadable one", () => {
        const sent = {
            ...leg('deposit'),
            order: { ...leg('deposit').order, aggregator: 'xo-v4' },
        }

        expect(readSwapLeg(sent)).toEqual(leg('deposit'))
        expect(
            readSwapLeg({ role: 'deposit', order: { order_id: 42 } }),
        ).toBeUndefined()
        expect(readSwapLeg(undefined)).toBeUndefined()
        expect(readSwapLeg(null)).toBeUndefined()
    })
})

describe('swapLegOf', () => {
    it('reads the roles that move funds and leaves approvals and opt-ins alone', () => {
        expect(swapLegOf(leg('swap'))).toEqual({
            orderId: '42',
            role: 'source',
        })
        expect(swapLegOf(leg('deposit'))?.role).toBe('source')
        expect(swapLegOf(leg('payout'))?.role).toBe('payout')
        expect(swapLegOf(leg('refund'))?.role).toBe('refund')
        expect(swapLegOf(leg('approval'))).toBeUndefined()
        expect(swapLegOf(leg('opt_in'))).toBeUndefined()
    })
})

describe('summarizeSwapLeg', () => {
    it('shows a completed same-chain swap on its deposit, with both amounts and the provider', () => {
        const summary = summarizeSwapLeg(
            leg('deposit'),
            sendSummary,
            'confirmed',
            onEthereum,
        )

        expect(summary).toMatchObject({
            kind: 'swap',
            icon: 'swap',
            direction: 'none',
            title: {
                key: 'transactions.list_item.swap_pair',
                params: { from: 'ETH', to: 'USDC' },
            },
            subtitle: { params: { title: 'xo' } },
        })
        expect(summary.amount).toBeUndefined()
        expect(summary.notice).toBeUndefined()
        expect(changes(summary)).toEqual([
            ['slip44:60', '-5700000000000000', 'ETH'],
            [
                'erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                '9830000',
                'USDC',
            ],
        ])
    })

    it('prefers the received amount to the expected one', () => {
        const summary = summarizeSwapLeg(
            leg('deposit', { destination_amount_received: '9790000' }),
            sendSummary,
            'confirmed',
            onEthereum,
        )

        expect(changes(summary)?.[1]?.[1]).toBe('9790000')
    })

    it('shows only what was paid while the order is open, marked in progress', () => {
        const summary = summarizeSwapLeg(
            leg('deposit', { status: 'in_progress' }),
            sendSummary,
            'confirmed',
            onEthereum,
        )

        expect(changes(summary)).toEqual([
            ['slip44:60', '-5700000000000000', 'ETH'],
        ])
        expect(summary.notice).toMatchObject({
            kind: 'warning',
            title: { key: 'swap.history.list.item.status.in_progress' },
        })
    })

    it("shows only the row's own chain side of a cross-chain order", () => {
        const summary = summarizeSwapLeg(
            leg('deposit', {
                source_asset: assetItem(USDC, 'USDC', 6),
                source_amount: '11120112',
                destination_asset: assetItem(ALGO, 'ALGO', 6),
            }),
            sendSummary,
            'confirmed',
            onEthereum,
        )

        expect(summary.title.params).toEqual({ from: 'USDC', to: 'ALGO' })
        expect(changes(summary)).toEqual([
            [
                'erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                '-11120112',
                'USDC',
            ],
        ])
    })

    it('keeps the amount its chain reported on a payout', () => {
        const received: TransactionSummary = { ...sendSummary, direction: 'in' }
        const summary = summarizeSwapLeg(
            leg('payout'),
            received,
            'confirmed',
            onEthereum,
        )

        expect(summary).toMatchObject({
            kind: 'swap',
            direction: 'in',
            amount: received.amount,
        })
        expect(summary.balanceChanges).toBeUndefined()
    })

    it("marks a refund and prefers the provider's display name", () => {
        const summary = summarizeSwapLeg(
            leg('refund', {
                status: 'refunded',
                provider_display_name: 'XO Swap',
            }),
            sendSummary,
            'confirmed',
            onEthereum,
        )

        expect(summary.notice?.title.key).toBe(
            'swap.history.list.item.status.refunded',
        )
        expect(summary.subtitle?.params).toEqual({ title: 'XO Swap' })
    })

    it('keeps the chain notice of a deposit that failed on chain', () => {
        const failed: TransactionSummary = {
            ...sendSummary,
            notice: {
                kind: 'error',
                title: { key: i18nKey('transactions.notice.pending') },
            },
        }
        const summary = summarizeSwapLeg(
            leg('deposit', { status: 'in_progress' }),
            failed,
            'failed',
            onEthereum,
        )

        expect(summary.notice).toBe(failed.notice)
    })

    it('leaves an approval as its chain summarized it', () => {
        expect(
            summarizeSwapLeg(
                leg('approval'),
                sendSummary,
                'confirmed',
                onEthereum,
            ),
        ).toBe(sendSummary)
    })

    it('falls back to a plain Swap title when an asset is unknown', () => {
        const summary = summarizeSwapLeg(
            leg('deposit', { destination_asset: null }),
            sendSummary,
            'confirmed',
            onEthereum,
        )

        expect(summary.title.key).toBe('transactions.list_item.swap')
    })
})

const recordOf = (
    id: string,
    swapLeg?: TransactionSwapLeg,
): TransactionRecord => ({
    id,
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    summary: {
        kind: 'swap',
        title: { key: i18nKey('transactions.list_item.swap') },
        direction: 'none',
        icon: 'swap',
    },
    chainData: { family: 'evm' },
    ...(swapLeg && { swapLeg }),
})

const ids = (records: TransactionRecord[]) => records.map(record => record.id)

describe('withoutListedSwapPayouts', () => {
    it("drops a payout whose order's deposit is listed beside it", () => {
        const records = [
            recordOf('payout', { orderId: '42', role: 'payout' }),
            recordOf('plain'),
            recordOf('deposit', { orderId: '42', role: 'source' }),
        ]

        expect(ids(withoutListedSwapPayouts(records))).toEqual([
            'plain',
            'deposit',
        ])
    })

    it('keeps a payout whose deposit is not listed, as in the payout asset history', () => {
        const records = [
            recordOf('payout', { orderId: '42', role: 'payout' }),
            recordOf('other deposit', { orderId: '7', role: 'source' }),
        ]

        expect(ids(withoutListedSwapPayouts(records))).toEqual([
            'payout',
            'other deposit',
        ])
    })

    it('keeps a refund beside its deposit: the funds did come back', () => {
        const records = [
            recordOf('refund', { orderId: '42', role: 'refund' }),
            recordOf('deposit', { orderId: '42', role: 'source' }),
        ]

        expect(ids(withoutListedSwapPayouts(records))).toEqual([
            'refund',
            'deposit',
        ])
    })

    it('returns the list itself when it holds no deposit', () => {
        const records = [recordOf('plain')]

        expect(withoutListedSwapPayouts(records)).toBe(records)
    })
})
