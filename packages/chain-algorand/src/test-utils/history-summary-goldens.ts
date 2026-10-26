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
import {
    type AssetRef,
    type TransactionSummary,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { flatHistoryItem, type FlatHistoryItem } from './history-item'

export type HistorySummaryGolden = {
    name: string
    /** The account the row is read from. */
    account: string
    item: TransactionHistoryItem
    summary: TransactionSummary
}

const A = 'ACCOUNT_A'
const B = 'ACCOUNT_B'
const C = 'ACCOUNT_C'

const ALGO: AssetRef = { chainId: 'algorand', assetId: '0' }
const USDC: AssetRef = { chainId: 'algorand', assetId: '31566704' }
const OTHER: AssetRef = { chainId: 'algorand', assetId: '777' }

const ALGO_DISPLAY = { symbol: 'ALGO', decimals: 6 }
const USDC_DISPLAY = { symbol: 'USDC', decimals: 6 }
const OTHER_DISPLAY = { symbol: 'XYZ', decimals: 0 }

const USDC_SUMMARY = {
    assetId: '31566704',
    name: 'USD Coin',
    unitName: 'USDC',
    decimals: 6,
}

const item = (
    overrides: Partial<FlatHistoryItem> = {},
): TransactionHistoryItem =>
    flatHistoryItem({
        id: 'TX',
        txType: 'pay',
        sender: A,
        assetSender: null,
        receiver: B,
        roundTime: 1_700_000_000,
        interpretedMeaning: null,
        fee: new Decimal(1000),
        amount: null,
        asset: null,
        balanceImpacts: [],
        ...overrides,
    })

const key = (name: string) => ({
    key: i18nKey(`transactions.list_item.${name}`),
})

const none = (
    name: string,
    icon: TransactionSummary['icon'],
): TransactionSummary => ({
    kind: 'chain-specific',
    title: key(name),
    direction: 'none',
    icon,
})

const sentHalfAlgo: TransactionSummary = {
    kind: 'transfer',
    title: key('send'),
    direction: 'out',
    icon: 'send',
    counterparty: B,
    amount: {
        assetRef: ALGO,
        value: new Decimal(500_000),
        display: ALGO_DISPLAY,
    },
}

// Every expected summary is a literal, so a change to the row logic shows up
// as a diff here rather than being recomputed by the code under test.
export const ALGORAND_HISTORY_SUMMARY_GOLDENS: readonly HistorySummaryGolden[] =
    [
        {
            name: 'payment sent',
            account: A,
            item: item({ amount: new Decimal(500_000) }),
            summary: {
                kind: 'transfer',
                title: key('send'),
                direction: 'out',
                icon: 'send',
                counterparty: B,
                amount: {
                    assetRef: ALGO,
                    value: new Decimal(500_000),
                    display: ALGO_DISPLAY,
                },
            },
        },
        {
            name: 'payment received',
            account: A,
            item: item({
                sender: B,
                receiver: A,
                amount: new Decimal(500_000),
            }),
            summary: {
                kind: 'transfer',
                title: key('receive'),
                direction: 'in',
                icon: 'receive',
                counterparty: B,
                amount: {
                    assetRef: ALGO,
                    value: new Decimal(500_000),
                    display: ALGO_DISPLAY,
                },
            },
        },
        {
            name: 'payment to self',
            account: A,
            item: item({ receiver: A, amount: new Decimal(500_000) }),
            summary: {
                kind: 'transfer',
                title: key('send'),
                direction: 'out',
                icon: 'send',
                counterparty: A,
                amount: {
                    assetRef: ALGO,
                    value: new Decimal(500_000),
                    display: ALGO_DISPLAY,
                },
            },
        },
        {
            name: 'payment close-out seen by a close target that is not the receiver',
            account: A,
            item: item({
                sender: B,
                receiver: C,
                closeTo: A,
                amount: new Decimal(100_000),
                closeAmount: new Decimal(900_000),
            }),
            summary: {
                kind: 'transfer',
                title: key('receive'),
                direction: 'in',
                icon: 'receive',
                counterparty: B,
                amount: {
                    assetRef: ALGO,
                    value: new Decimal(900_000),
                    display: ALGO_DISPLAY,
                },
            },
        },
        {
            name: 'asset transfer sent',
            account: A,
            item: item({
                txType: 'axfer',
                amount: new Decimal(1_000_000),
                asset: USDC_SUMMARY,
            }),
            summary: {
                kind: 'token-transfer',
                title: key('send'),
                direction: 'out',
                icon: 'send',
                counterparty: B,
                amount: {
                    assetRef: USDC,
                    value: new Decimal(1_000_000),
                    display: USDC_DISPLAY,
                },
            },
        },
        {
            name: 'asset transfer received',
            account: A,
            item: item({
                txType: 'axfer',
                sender: B,
                receiver: A,
                amount: new Decimal(1_000_000),
                asset: USDC_SUMMARY,
            }),
            summary: {
                kind: 'token-transfer',
                title: key('receive'),
                direction: 'in',
                icon: 'receive',
                counterparty: B,
                amount: {
                    assetRef: USDC,
                    value: new Decimal(1_000_000),
                    display: USDC_DISPLAY,
                },
            },
        },
        {
            name: 'asset opt-in with a zero amount',
            account: A,
            item: item({
                txType: 'axfer',
                receiver: A,
                amount: new Decimal(0),
                asset: USDC_SUMMARY,
            }),
            summary: {
                ...none('opt_in', 'opt-in'),
                counterparty: A,
                amount: {
                    assetRef: USDC,
                    value: new Decimal(0),
                    display: USDC_DISPLAY,
                },
            },
        },
        {
            name: 'asset opt-out with a close amount',
            account: A,
            item: item({
                txType: 'axfer',
                receiver: B,
                closeTo: B,
                amount: new Decimal(0),
                closeAmount: new Decimal(250),
                asset: USDC_SUMMARY,
            }),
            summary: {
                ...none('opt_out', 'opt-out'),
                direction: 'out',
                counterparty: B,
                amount: {
                    assetRef: USDC,
                    value: new Decimal(250),
                    display: USDC_DISPLAY,
                },
            },
        },
        {
            name: 'asset clawback seen by the debited account',
            account: A,
            item: item({
                txType: 'axfer',
                sender: C,
                assetSender: A,
                receiver: B,
                amount: new Decimal(400),
                asset: USDC_SUMMARY,
            }),
            summary: {
                kind: 'token-transfer',
                title: key('send'),
                direction: 'out',
                icon: 'send',
                counterparty: B,
                amount: {
                    assetRef: USDC,
                    value: new Decimal(400),
                    display: USDC_DISPLAY,
                },
            },
        },
        {
            name: 'asset config',
            account: A,
            item: item({ txType: 'acfg', receiver: null }),
            summary: none('asset_config', 'asset-config'),
        },
        {
            name: 'asset freeze',
            account: A,
            item: item({ txType: 'afrz', receiver: null }),
            summary: none('asset_freeze', 'asset-freeze'),
        },
        {
            name: 'key registration',
            account: A,
            item: item({ txType: 'keyreg', receiver: null }),
            summary: none('key_registration', 'consensus'),
        },
        {
            name: 'heartbeat sent on the account behalf',
            account: A,
            item: item({ txType: 'hb', sender: B, receiver: null }),
            summary: none('heartbeat', 'consensus'),
        },
        {
            name: 'state proof',
            account: A,
            item: item({ txType: 'stpf', sender: B, receiver: null }),
            summary: none('state_proof', 'unknown'),
        },
        {
            name: 'app call with three balance impacts and three inner transactions',
            account: A,
            item: item({
                txType: 'appl',
                receiver: null,
                applicationId: '123',
                innerTransactionCount: 3,
                balanceImpacts: [
                    {
                        assetId: '0',
                        unitName: 'ALGO',
                        fractionDecimals: 6,
                        amount: new Decimal(-1000),
                    },
                    {
                        assetId: '31566704',
                        unitName: 'USDC',
                        fractionDecimals: 6,
                        amount: new Decimal(250),
                    },
                    {
                        assetId: '777',
                        unitName: 'XYZ',
                        fractionDecimals: 0,
                        amount: new Decimal(-5),
                    },
                ],
            }),
            summary: {
                kind: 'contract-call',
                title: key('app_call'),
                direction: 'none',
                icon: 'contract-call',
                subtitle: {
                    key: i18nKey(
                        'transactions.list_item.inner_transaction_count',
                    ),
                    params: { innerCount: '3' },
                },
                balanceChanges: [
                    {
                        assetRef: ALGO,
                        value: new Decimal(-1000),
                        display: ALGO_DISPLAY,
                    },
                    {
                        assetRef: USDC,
                        value: new Decimal(250),
                        display: USDC_DISPLAY,
                    },
                    {
                        assetRef: OTHER,
                        value: new Decimal(-5),
                        display: OTHER_DISPLAY,
                    },
                ],
            },
        },
        {
            name: 'unknown transaction type',
            account: A,
            item: item({ txType: 'xyz', receiver: null }),
            summary: none('default', 'unknown'),
        },
        {
            name: 'swap',
            account: A,
            item: item({
                txType: 'appl',
                receiver: null,
                swapGroupDetail: {
                    assetInId: '0',
                    assetInUnitName: 'ALGO',
                    assetInDecimals: 6,
                    assetOutId: '31566704',
                    assetOutUnitName: 'USDC',
                    assetOutDecimals: 6,
                    amountIn: new Decimal(2_000_000),
                    amountOut: new Decimal(1_500_000),
                },
            }),
            summary: {
                kind: 'swap',
                title: key('swap'),
                direction: 'in',
                icon: 'swap',
                subtitle: {
                    key: i18nKey('transactions.list_item.swap_subtitle'),
                    params: {
                        amountIn: '2.00',
                        assetIn: 'ALGO',
                        amountOut: '1.50',
                        assetOut: 'USDC',
                    },
                },
                amount: {
                    assetRef: USDC,
                    value: new Decimal(1_500_000),
                    display: USDC_DISPLAY,
                },
            },
        },
        {
            name: 'payment carrying an interpreted meaning',
            account: A,
            item: item({
                sender: B,
                receiver: A,
                amount: new Decimal(500_000),
                interpretedMeaning: {
                    title: 'Received 0.5 ALGO',
                    description: 'Received 0.5 ALGO from B',
                },
            }),
            summary: {
                kind: 'transfer',
                title: {
                    key: i18nKey('transactions.list_item.interpreted_title'),
                    params: { title: 'Received 0.5 ALGO' },
                },
                direction: 'in',
                icon: 'receive',
                counterparty: B,
                amount: {
                    assetRef: ALGO,
                    value: new Decimal(500_000),
                    display: ALGO_DISPLAY,
                },
            },
        },
        {
            name: 'pending payment',
            account: A,
            item: item({ amount: new Decimal(500_000), status: 'pending' }),
            summary: {
                ...sentHalfAlgo,
                notice: {
                    kind: 'warning',
                    title: { key: i18nKey('transactions.notice.pending') },
                    since: 1_700_000_000_000,
                },
            },
        },
        {
            name: 'pending placeholder before the chain lists the transaction',
            account: A,
            item: {
                ...item({ status: 'pending', receiver: null }),
                txType: '',
                chainData: null,
            },
            summary: {
                ...none('default', 'unknown'),
                notice: {
                    kind: 'warning',
                    title: { key: i18nKey('transactions.notice.pending') },
                    since: 1_700_000_000_000,
                },
            },
        },
        {
            name: 'failed payment',
            account: A,
            item: item({ amount: new Decimal(500_000), status: 'failed' }),
            summary: {
                ...sentHalfAlgo,
                notice: {
                    kind: 'error',
                    title: { key: i18nKey('transactions.notice.failed') },
                },
            },
        },
        {
            name: 'replaced payment',
            account: A,
            item: item({ amount: new Decimal(500_000), status: 'replaced' }),
            summary: {
                ...sentHalfAlgo,
                notice: {
                    kind: 'warning',
                    title: { key: i18nKey('transactions.notice.replaced') },
                },
            },
        },
        {
            name: 'payment confirmed with an explicit status',
            account: A,
            item: item({ amount: new Decimal(500_000), status: 'confirmed' }),
            summary: sentHalfAlgo,
        },
    ]
