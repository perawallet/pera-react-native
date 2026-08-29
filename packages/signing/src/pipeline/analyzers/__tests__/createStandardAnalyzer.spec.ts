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

import { describe, test, expect, vi } from 'vitest'
import { Address, Transaction } from 'algosdk'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import { GenesisHashMismatchError } from '../../errors'
import {
    makeTestAddress,
    makeTestPaymentTx,
    makeTestAssetTransferTx,
} from '../../../test-utils/transactions'

const assertTransactionsMatchNetworkMock = vi.fn()
vi.mock('../../../utils/assertTransactionsMatchNetwork', () => ({
    assertTransactionsMatchNetwork: (...args: unknown[]) =>
        assertTransactionsMatchNetworkMock(...args),
}))

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
        encodeTransactionRaw: (tx: { _encoded?: Uint8Array }) =>
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
    fee?: bigint
    note?: Uint8Array
    type?: string
    group?: Uint8Array
}): unknown => ({
    sender: { toString: () => overrides.sender },
    fee: overrides.fee,
    note: overrides.note,
    ...(overrides.group ? { group: overrides.group } : {}),
    type: overrides.type,
})

// Type-specific fields (receiver, amount, closeRemainderTo, ...) live under
// the payload on a real SDK Transaction, never at the top level — so warnings
// and summaries must be exercised against genuine algosdk objects. Hand-built
// literals with top-level fields are exactly what let ship as dead
// code.
const REAL_SENDER = makeTestAddress(1)
const REAL_EXTERNAL_SENDER = makeTestAddress(7)
const CLOSE_TARGET = makeTestAddress(9)
const REKEY_TARGET = makeTestAddress(5)

const makeRealPaymentCloseTx = (sender: Address = REAL_SENDER): Transaction =>
    makeTestPaymentTx(sender, {
        receiver: CLOSE_TARGET,
        closeRemainderTo: CLOSE_TARGET,
    })

const makeRealAssetCloseTx = (sender: Address = REAL_SENDER): Transaction =>
    makeTestAssetTransferTx(sender, {
        assetIndex: 42n,
        receiver: CLOSE_TARGET,
        closeRemainderTo: CLOSE_TARGET,
    })

const makeRealRekeyTx = (sender: Address = REAL_SENDER): Transaction =>
    makeTestPaymentTx(sender, {
        receiver: CLOSE_TARGET,
        rekeyTo: REKEY_TARGET,
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

    const makeArc60Group = (
        domain: string,
        verifiedOrigin?: string,
    ): SignableGroup =>
        ({
            data: {
                type: 'arc60',
                stdSigData: { domain, signer: ACCOUNT_A },
                metadata: { scope: 1, encoding: 'base64' },
            },
            source: { type: 'webview', verifiedOrigin },
            signerAddress: ACCOUNT_A,
        }) as SignableGroup

    test('arc60 with no verified origin produces no warnings (WC-style)', async () => {
        const analyzer = createStandardAnalyzer()
        const result = await analyzer.analyze(
            makeArc60Group('arc60.io', undefined),
            makeContext([ACCOUNT_A]),
        )

        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
        expect(result.signableAddresses).toEqual([ACCOUNT_A])
    })

    test('arc60 with verified origin matching the SIWA domain produces no warnings', async () => {
        const analyzer = createStandardAnalyzer()
        const result = await analyzer.analyze(
            makeArc60Group('arc60.io', 'https://arc60.io/sign-in'),
            makeContext([ACCOUNT_A]),
        )

        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
    })

    test('arc60 flags a danger warning when the verified origin host differs from the SIWA domain', async () => {
        const analyzer = createStandardAnalyzer()
        const result = await analyzer.analyze(
            makeArc60Group(
                'trusted-exchange.com',
                'https://evil.example/phish',
            ),
            makeContext([ACCOUNT_A]),
        )

        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].type).toBe('suspicious')
        expect(result.warnings[0].severity).toBe('danger')
        expect(result.warnings[0].message).toContain('trusted-exchange.com')
        expect(result.warnings[0].message).toContain('evil.example')
        expect(result.riskLevel).toBe('high')
    })

    test('passes the transactions, the network, and the resolved genesis hash to assertTransactionsMatchNetwork', async () => {
        // A refactor that reintroduces getNetworkConfig(context.network)
        // .genesisHash at the call site (the exact localnet-blocked bug this
        // task fixed) would ship green everywhere else in this file — every
        // other test only cares whether assertTransactionsMatchNetworkMock
        // throws, not what it was called with. This is the one test that
        // locks the third argument down.
        const analyzer = createStandardAnalyzer()
        const tx = makeTx({ sender: ACCOUNT_A, fee: 1000n })
        const group = makeGroup([tx])

        await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(assertTransactionsMatchNetworkMock).toHaveBeenCalledWith(
            [tx],
            'mainnet',
            getNetworkConfig(Networks.mainnet).genesisHash,
        )
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

    test('summarizes a real payment with receiver, amount and note from the payload', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTestPaymentTx(REAL_SENDER, {
                receiver: CLOSE_TARGET,
                amount: 1000n,
                // Copy into this realm: jsdom's TextEncoder yields a foreign
                // Uint8Array that algosdk's instanceof validation rejects.
                note: new Uint8Array(new TextEncoder().encode('hello')),
            }),
        ])
        const result = await analyzer.analyze(
            group,
            makeContext([REAL_SENDER.toString()]),
        )

        expect(result.transactionSummaries).toHaveLength(1)
        expect(result.transactionSummaries[0].sender).toBe(
            REAL_SENDER.toString(),
        )
        expect(result.transactionSummaries[0].receiver).toBe(
            CLOSE_TARGET.toString(),
        )
        expect(result.transactionSummaries[0].amount).toBe(1000n)
        expect(result.transactionSummaries[0].note).toBe('hello')
    })

    test('summarizes a real asset transfer with assetId from the payload', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeTestAssetTransferTx(REAL_SENDER, {
                assetIndex: 42n,
                receiver: CLOSE_TARGET,
                amount: 7n,
            }),
        ])
        const result = await analyzer.analyze(
            group,
            makeContext([REAL_SENDER.toString()]),
        )

        expect(result.transactionSummaries).toHaveLength(1)
        expect(result.transactionSummaries[0].receiver).toBe(
            CLOSE_TARGET.toString(),
        )
        expect(result.transactionSummaries[0].amount).toBe(7n)
        expect(result.transactionSummaries[0].assetId).toBe(42n)
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

    test('detects a danger close-account warning from a real payment closeRemainderTo', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([makeRealPaymentCloseTx()])
        const result = await analyzer.analyze(
            group,
            makeContext([REAL_SENDER.toString()]),
        )

        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].type).toBe('close-account')
        expect(result.warnings[0].severity).toBe('danger')
        expect(result.warnings[0].message).toContain('close the account')
        expect(result.warnings[0].message).toContain(CLOSE_TARGET.toString())
        expect(result.riskLevel).toBe('high')
    })

    test('detects a danger opt-out warning from a real asset-transfer closeRemainderTo', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([makeRealAssetCloseTx()])
        const result = await analyzer.analyze(
            group,
            makeContext([REAL_SENDER.toString()]),
        )

        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].type).toBe('close-account')
        expect(result.warnings[0].severity).toBe('danger')
        expect(result.warnings[0].message).toContain('remaining asset balance')
        expect(result.warnings[0].message).toContain(CLOSE_TARGET.toString())
        expect(result.riskLevel).toBe('high')
    })

    test('detects a danger rekey warning from a real transaction rekeyTo', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([makeRealRekeyTx()])
        const result = await analyzer.analyze(
            group,
            makeContext([REAL_SENDER.toString()]),
        )

        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].type).toBe('rekey')
        expect(result.warnings[0].severity).toBe('danger')
        expect(result.warnings[0].message).toContain(
            `ENCODED_${Array.from(REKEY_TARGET.publicKey).join('-')}`,
        )
        expect(result.riskLevel).toBe('high')
    })

    test('skips warnings for real close and rekey txs not signed by us', async () => {
        const analyzer = createStandardAnalyzer()
        const group = makeGroup([
            makeRealPaymentCloseTx(REAL_EXTERNAL_SENDER),
            makeRealRekeyTx(REAL_EXTERNAL_SENDER),
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

        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.totalFees).toBe(1000n)
        expect(result.signableAddresses).toEqual([ACCOUNT_A])
        expect(result.transactionSummaries).toHaveLength(1)
        expect(result.transactionSummaries[0].sender).toBe(ACCOUNT_A)
        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
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

        const result = await analyzer.analyze(group, makeContext([ACCOUNT_A]))

        expect(result.totalFees).toBe(1000n)
        expect(result.signableAddresses).toEqual([ACCOUNT_A])
        expect(result.transactionSummaries).toHaveLength(1)
        expect(result.transactionSummaries[0].sender).toBe(ACCOUNT_A)
        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
    })

    test('rethrows GenesisHashMismatchError without wrapping it as AnalysisError', async () => {
        assertTransactionsMatchNetworkMock.mockImplementationOnce(() => {
            throw new GenesisHashMismatchError(
                'testnet',
                0,
                'EXPECTED',
                'ACTUAL',
            )
        })

        const analyzer = createStandardAnalyzer()
        const group = {
            data: {
                type: 'transactions',
                transactions: [makeTx({ sender: ACCOUNT_A })],
            },
            source: {},
            signerAddress: ACCOUNT_A,
        } as unknown as SignableGroup

        await expect(
            analyzer.analyze(group, makeContext()),
        ).rejects.toBeInstanceOf(GenesisHashMismatchError)
    })
})
