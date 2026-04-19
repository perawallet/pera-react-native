/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi } from 'vitest'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...original,
        classifyPeraTransaction: (tx: { type?: string }) => tx.type ?? 'pay',
        encodeAlgorandAddress: (bytes: Uint8Array) =>
            `ENCODED_${Array.from(bytes).join('-')}`,
        encodeTransaction: (tx: { _encoded?: Uint8Array }) =>
            tx._encoded ?? new Uint8Array(),
    }
})

import { createStandardAnalyzer } from '../createStandardAnalyzer'
import { AnalysisError, TransactionRoundTripError } from '../../errors'
import type { AnalysisContext, SignableGroup } from '../../types'

const ACCOUNT_A = 'ACCOUNT_A'
const ACCOUNT_B = 'ACCOUNT_B'
const EXTERNAL_ADDR = 'EXTERNAL_ADDR'

const makeContext = (accounts: string[] = [ACCOUNT_A]): AnalysisContext =>
    ({
        network: 'mainnet',
        accounts: accounts.map(address => ({ address }) as never),
    }) as AnalysisContext

const makeTx = (overrides: {
    sender: string
    receiver?: string
    amount?: bigint
    assetId?: bigint
    fee?: bigint
    note?: Uint8Array
    closeRemainderTo?: string
    closeTo?: string
    rekeyTo?: { publicKey: Uint8Array }
    type?: string
}): unknown => ({
    sender: { toString: () => overrides.sender },
    ...(overrides.receiver
        ? { receiver: { toString: () => overrides.receiver } }
        : {}),
    ...('amount' in overrides ? { amount: overrides.amount } : {}),
    ...('assetId' in overrides ? { assetId: overrides.assetId } : {}),
    fee: overrides.fee,
    note: overrides.note,
    ...(overrides.closeRemainderTo
        ? { closeRemainderTo: { toString: () => overrides.closeRemainderTo } }
        : {}),
    ...(overrides.closeTo
        ? { closeTo: { toString: () => overrides.closeTo } }
        : {}),
    ...(overrides.rekeyTo ? { rekeyTo: overrides.rekeyTo } : {}),
    type: overrides.type,
})

const makeGroup = (transactions: unknown[]): SignableGroup =>
    ({
        data: {
            type: 'transactions',
            transactions: transactions as never[],
            indicesToSign: transactions.map((_, i) => i),
        },
        source: { type: 'local' },
        signerAddress: ACCOUNT_A,
    }) as SignableGroup

describe('createStandardAnalyzer', () => {
    test('returns empty analysis for non-transaction data (arbitrary-data)', async () => {
        const analyzer = createStandardAnalyzer()
        const result = await analyzer.analyze(
            {
                data: { type: 'arbitrary-data', data: [] },
                source: { type: 'walletconnect' },
                signerAddress: ACCOUNT_A,
            },
            makeContext([ACCOUNT_A, ACCOUNT_B]),
        )

        expect(result.totalFees).toBe(0n)
        expect(result.transactionSummaries).toEqual([])
        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
        // signableAddresses includes all user accounts for non-tx data
        expect(result.signableAddresses).toEqual([ACCOUNT_A, ACCOUNT_B])
    })

    test('sums fees only for transactions from user accounts', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTx({ sender: ACCOUNT_A, fee: 1000n }),
            makeTx({ sender: EXTERNAL_ADDR, fee: 500n }),
            makeTx({ sender: ACCOUNT_A, fee: 2000n }),
        ])
        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.totalFees).toBe(3000n)
        expect(result.signableAddresses).toEqual([ACCOUNT_A])
    })

    test('skips missing fee field without crashing', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTx({ sender: ACCOUNT_A, fee: undefined }),
            makeTx({ sender: ACCOUNT_A, fee: 100n }),
        ])
        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.totalFees).toBe(100n)
    })

    test('produces transaction summaries with receiver, amount, assetId, note', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTx({
                sender: ACCOUNT_A,
                receiver: EXTERNAL_ADDR,
                amount: 1000n,
                assetId: 42n,
                note: new TextEncoder().encode('hello'),
            }),
        ])
        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.transactionSummaries).toHaveLength(1)
        expect(result.transactionSummaries[0].sender).toBe(ACCOUNT_A)
        expect(result.transactionSummaries[0].receiver).toBe(EXTERNAL_ADDR)
        expect(result.transactionSummaries[0].amount).toBe(1000n)
        expect(result.transactionSummaries[0].assetId).toBe(42n)
        expect(result.transactionSummaries[0].note).toBe('hello')
    })

    test('skips note that is not valid UTF-8 without crashing', async () => {
        const analyzer = createStandardAnalyzer()
        const badNote = new Uint8Array([0xff, 0xfe, 0xfd])
        // Force TextDecoder to throw by using a fatal decoder — simulate via stub.
        const origTextDecoder = global.TextDecoder
        class ThrowingDecoder {
            decode() {
                throw new Error('bad utf-8')
            }
        }
        // @ts-expect-error - stub
        global.TextDecoder = ThrowingDecoder as unknown

        try {
            const group = makeGroup([
                makeTx({ sender: ACCOUNT_A, note: badNote }),
            ])
            const result = await analyzer.analyze(
                group,
                makeContext([ACCOUNT_A]),
            )
            expect(result.transactionSummaries[0].note).toBeUndefined()
        } finally {
            global.TextDecoder = origTextDecoder
        }
    })

    test('detects close-account warning from closeRemainderTo', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTx({
                sender: ACCOUNT_A,
                closeRemainderTo: EXTERNAL_ADDR,
            }),
        ])
        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].type).toBe('close-account')
        expect(result.warnings[0].severity).toBe('danger')
        expect(result.riskLevel).toBe('high')
    })

    test('detects close-account warning from closeTo (asset)', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTx({
                sender: ACCOUNT_A,
                closeTo: EXTERNAL_ADDR,
            }),
        ])
        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].type).toBe('close-account')
    })

    test('detects rekey warning and encodes address from publicKey bytes', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTx({
                sender: ACCOUNT_A,
                rekeyTo: { publicKey: new Uint8Array([1, 2, 3]) },
            }),
        ])
        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].type).toBe('rekey')
        expect(result.warnings[0].message).toContain('ENCODED_1-2-3')
    })

    test('skips warnings for tx not signed by us', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTx({
                sender: EXTERNAL_ADDR,
                closeRemainderTo: ACCOUNT_A,
                rekeyTo: { publicKey: new Uint8Array([1]) },
            }),
        ])
        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
    })

    test('wraps unexpected errors in AnalysisError', async () => {
        const analyzer = createStandardAnalyzer()
        const badTx = {
            get sender(): never {
                throw new Error('tx blew up')
            },
        }
        const group = makeGroup([badTx])

        await expect(
            analyzer.analyze(group, makeContext([ACCOUNT_A])),
        ).rejects.toThrow(AnalysisError)
    })

    test('passes round-trip check when re-encoded bytes match raw bytes', async () => {
        const analyzer = createStandardAnalyzer()
        const tx = makeTx({ sender: ACCOUNT_A, fee: 1000n }) as unknown as {
            _encoded?: Uint8Array
        }
        tx._encoded = new Uint8Array([0x01, 0x02])

        const group: SignableGroup = {
            data: {
                type: 'transactions',
                transactions: [tx as never],
                rawTransactionsBase64: ['AQI='], // matches [0x01, 0x02]
                indicesToSign: [0],
            },
            source: { type: 'walletconnect' },
            signerAddress: ACCOUNT_A,
        }

        await expect(
            analyzer.analyze(group, makeContext([ACCOUNT_A])),
        ).resolves.toBeDefined()
    })

    test('throws TransactionRoundTripError when decoder silently dropped a field', async () => {
        const analyzer = createStandardAnalyzer()
        // Decoder produced a shorter txn than the raw bytes — e.g., lost rekeyTo.
        const droppedFieldTx = makeTx({
            sender: ACCOUNT_A,
            fee: 1000n,
        }) as unknown as { _encoded?: Uint8Array }
        droppedFieldTx._encoded = new Uint8Array([0x01]) // shorter than raw

        const group: SignableGroup = {
            data: {
                type: 'transactions',
                transactions: [droppedFieldTx as never],
                rawTransactionsBase64: ['AQI='], // [0x01, 0x02]
                indicesToSign: [0],
            },
            source: { type: 'walletconnect' },
            signerAddress: ACCOUNT_A,
        }

        await expect(
            analyzer.analyze(group, makeContext([ACCOUNT_A])),
        ).rejects.toBeInstanceOf(TransactionRoundTripError)
    })

    test('skips round-trip check when rawTransactionsBase64 is absent (local source)', async () => {
        const analyzer = createStandardAnalyzer()
        const tx = makeTx({ sender: ACCOUNT_A, fee: 1000n })

        // No rawTransactionsBase64 — internal request, no round-trip needed.
        const group = makeGroup([tx])

        await expect(
            analyzer.analyze(group, makeContext([ACCOUNT_A])),
        ).resolves.toBeDefined()
    })
})
