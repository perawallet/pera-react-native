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

import { describe, it, expect } from 'vitest'
import {
    computeBalanceImpacts,
    type IndexerTransactionLike,
} from '../balance-impacts'

const ME = 'AAAA'
const THEM = 'BBBB'

const payment = (
    overrides: Partial<IndexerTransactionLike> = {},
): IndexerTransactionLike => ({
    'tx-type': 'pay',
    sender: ME,
    fee: 1000,
    'payment-transaction': { amount: 5000, receiver: THEM },
    ...overrides,
})

describe('computeBalanceImpacts', () => {
    it('sender pays amount plus fee', () => {
        const tx = payment()

        const result = computeBalanceImpacts(tx, ME)

        expect(result).toEqual([{ assetId: '0', amount: -6000n }])
    })

    it('receiver gains the amount and pays no fee', () => {
        const tx = payment()

        const result = computeBalanceImpacts(tx, THEM)

        expect(result).toEqual([{ assetId: '0', amount: 5000n }])
    })

    it('an uninvolved address has no impacts', () => {
        const tx = payment()

        const result = computeBalanceImpacts(tx, 'CCCC')

        expect(result).toEqual([])
    })

    it('self-payment nets to just the fee', () => {
        const tx = payment({
            'payment-transaction': { amount: 5000, receiver: ME },
        })

        const result = computeBalanceImpacts(tx, ME)

        expect(result).toEqual([{ assetId: '0', amount: -1000n }])
    })

    it('close-remainder-to credits the closer and debits the sender', () => {
        const tx = payment({
            'payment-transaction': {
                amount: 5000,
                receiver: THEM,
                'close-remainder-to': THEM,
                'close-amount': 2000,
            },
        })

        const resultForSender = computeBalanceImpacts(tx, ME)
        const resultForCloser = computeBalanceImpacts(tx, THEM)

        expect(resultForSender).toEqual([{ assetId: '0', amount: -8000n }])
        expect(resultForCloser).toEqual([{ assetId: '0', amount: 7000n }])
    })

    it('asset transfer moves the asset and charges the fee in ALGO', () => {
        const tx: IndexerTransactionLike = {
            'tx-type': 'axfer',
            sender: ME,
            fee: 1000,
            'asset-transfer-transaction': {
                'asset-id': 31566704,
                amount: 250000,
                receiver: THEM,
            },
        }

        const result = computeBalanceImpacts(tx, ME)

        expect(result).toEqual([
            { assetId: '0', amount: -1000n },
            { assetId: '31566704', amount: -250000n },
        ])
    })

    it('clawback debits the effective asset-transfer sender, not the transaction sender', () => {
        // The indexer's own OpenAPI schema and algosdk's wire-encoding map both
        // name this nested field `sender` (description: "[asnd] The effective
        // sender during a clawback"), not `asset-sender` — there is no
        // top-level `asset-sender` key anywhere in the real API. It is easy to
        // assume otherwise since the enclosing transaction ALSO has its own
        // (unrelated) top-level `sender`, so this case is exercised explicitly.
        const tx: IndexerTransactionLike = {
            'tx-type': 'axfer',
            sender: 'CLAWBACK',
            fee: 1000,
            'asset-transfer-transaction': {
                'asset-id': 7,
                amount: 100,
                receiver: THEM,
                sender: ME,
            },
        }

        const result = computeBalanceImpacts(tx, ME)

        expect(result).toEqual([{ assetId: '7', amount: -100n }])
    })

    it('asset close-to credits the closer and debits the sender, on top of the transferred amount', () => {
        const tx: IndexerTransactionLike = {
            'tx-type': 'axfer',
            sender: ME,
            fee: 1000,
            'asset-transfer-transaction': {
                'asset-id': 7,
                amount: 100,
                receiver: THEM,
                'close-to': THEM,
                'close-amount': 50,
            },
        }

        const resultForSender = computeBalanceImpacts(tx, ME)
        const resultForCloser = computeBalanceImpacts(tx, THEM)

        expect(resultForSender).toEqual([
            { assetId: '0', amount: -1000n },
            { assetId: '7', amount: -150n },
        ])
        expect(resultForCloser).toEqual([{ assetId: '7', amount: 150n }])
    })

    it('omits an asset whose net change across inner transactions is zero', () => {
        const tx: IndexerTransactionLike = {
            'tx-type': 'appl',
            sender: ME,
            fee: 1000,
            'inner-txns': [
                {
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 0,
                    'asset-transfer-transaction': {
                        'asset-id': 5,
                        amount: 300,
                        receiver: THEM,
                    },
                },
                {
                    'tx-type': 'axfer',
                    sender: THEM,
                    fee: 0,
                    'asset-transfer-transaction': {
                        'asset-id': 5,
                        amount: 300,
                        receiver: ME,
                    },
                },
            ],
        }

        const result = computeBalanceImpacts(tx, ME)

        expect(result).toEqual([{ assetId: '0', amount: -1000n }])
    })

    it('nets across inner transactions', () => {
        const tx: IndexerTransactionLike = {
            'tx-type': 'appl',
            sender: ME,
            fee: 2000,
            'inner-txns': [
                {
                    'tx-type': 'pay',
                    sender: THEM,
                    fee: 0,
                    'payment-transaction': { amount: 9000, receiver: ME },
                },
                {
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 0,
                    'asset-transfer-transaction': {
                        'asset-id': 5,
                        amount: 300,
                        receiver: THEM,
                    },
                },
            ],
        }

        const result = computeBalanceImpacts(tx, ME)

        expect(result).toEqual([
            { assetId: '0', amount: 7000n },
            { assetId: '5', amount: -300n },
        ])
    })

    it('a nonzero inner-transaction fee charges its own sender, not the outer signer', () => {
        // Verified against live mainnet data: inner transactions frequently
        // report nonzero fees (an app paying its own inner-transaction fee
        // from its own account, rather than relying on fee pooling from the
        // outer call). This must not double-charge — or under-charge — either
        // party.
        const tx: IndexerTransactionLike = {
            'tx-type': 'appl',
            sender: ME,
            fee: 1000,
            'inner-txns': [
                {
                    'tx-type': 'pay',
                    sender: 'APP_ACCOUNT',
                    fee: 2000,
                    'payment-transaction': { amount: 500, receiver: THEM },
                },
            ],
        }

        const resultForOuterSigner = computeBalanceImpacts(tx, ME)
        const resultForInnerSender = computeBalanceImpacts(tx, 'APP_ACCOUNT')

        expect(resultForOuterSigner).toEqual([{ assetId: '0', amount: -1000n }])
        expect(resultForInnerSender).toEqual([{ assetId: '0', amount: -2500n }])
    })

    it('recurses into nested inner transactions', () => {
        const tx: IndexerTransactionLike = {
            'tx-type': 'appl',
            sender: THEM,
            fee: 1000,
            'inner-txns': [
                {
                    'tx-type': 'appl',
                    sender: THEM,
                    fee: 0,
                    'inner-txns': [
                        {
                            'tx-type': 'pay',
                            sender: THEM,
                            fee: 0,
                            'payment-transaction': {
                                amount: 42n as unknown as number,
                                receiver: ME,
                            },
                        },
                    ],
                },
            ],
        }

        const result = computeBalanceImpacts(tx, ME)

        expect(result).toEqual([{ assetId: '0', amount: 42n }])
    })

    it('orders ALGO first then ascending asset id', () => {
        const tx: IndexerTransactionLike = {
            'tx-type': 'appl',
            sender: ME,
            fee: 1000,
            'inner-txns': [
                {
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 0,
                    'asset-transfer-transaction': {
                        'asset-id': 900,
                        amount: 1,
                        receiver: THEM,
                    },
                },
                {
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 0,
                    'asset-transfer-transaction': {
                        'asset-id': 100,
                        amount: 1,
                        receiver: THEM,
                    },
                },
            ],
        }

        const result = computeBalanceImpacts(tx, ME)

        expect(result.map(impact => impact.assetId)).toEqual([
            '0',
            '100',
            '900',
        ])
    })

    it('sorts asset ids numerically, not lexicographically', () => {
        // '10' < '9' as strings (compares the leading '1' against '9'), but
        // 9 < 10 numerically. Asset ids 900/100 above happen to agree under
        // both orderings (same digit count) and would not catch a regression
        // to a plain string sort — this pair of different digit-counts does.
        const tx: IndexerTransactionLike = {
            'tx-type': 'appl',
            sender: ME,
            fee: 1000,
            'inner-txns': [
                {
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 0,
                    'asset-transfer-transaction': {
                        'asset-id': 10,
                        amount: 1,
                        receiver: THEM,
                    },
                },
                {
                    'tx-type': 'axfer',
                    sender: ME,
                    fee: 0,
                    'asset-transfer-transaction': {
                        'asset-id': 9,
                        amount: 1,
                        receiver: THEM,
                    },
                },
            ],
        }

        const result = computeBalanceImpacts(tx, ME)

        expect(result.map(impact => impact.assetId)).toEqual(['0', '9', '10'])
    })
})
