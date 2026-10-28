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

import { beforeEach, describe, test, expect, vi } from 'vitest'
import {
    ScopeChangedError,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    SubmissionError,
    TransportError,
    type SigningResult,
    type SourceMetadata,
} from '@perawallet/wallet-core-signing'
import { generateAccount } from 'algosdk'
import { createAlgodTransport } from '../createAlgodTransport'
import { signedAlgorandTransactionFromBytes } from '../../signedTransactions'
import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../__tests__/transactions'

const ALGORAND_TESTNET: ChainScope = {
    chainId: 'algorand',
    networkId: 'testnet',
}

const SIGNER = generateAccount()
const SIGNED_BYTES = makeTestPaymentTx(SIGNER.addr, {
    receiver: makeTestAddress(2),
}).signTxn(SIGNER.sk)
const SIGNED = signedAlgorandTransactionFromBytes(
    SIGNED_BYTES,
    ALGORAND_TESTNET,
)

const transactionResult: SigningResult = {
    signedData: { type: 'transactions', signed: [SIGNED] },
    signers: [{ address: 'ADDR' }],
}

const arbitraryResult = {
    signedData: {
        type: 'arbitrary-data',
        signatures: [new Uint8Array([1])],
    },
    signers: [{ address: 'ADDR' }],
} as unknown as SigningResult

// An unknown-outcome failure re-checks the chain after a 2s delay before rethrowing.
const expectSubmissionError = async (send: () => Promise<unknown>) => {
    vi.useFakeTimers()
    try {
        const sent = expect(send()).rejects.toThrow(SubmissionError)
        await vi.runAllTimersAsync()
        await sent
    } finally {
        vi.useRealTimers()
    }
}

describe('createAlgodTransport', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
        useNetworkStore.getState().setMode('developer')
    })

    const makeAlgokit = (txid: Optional<string | string[]> = 'TX_ID') => ({
        client: {
            algod: {
                sendRawTransaction: vi.fn().mockReturnValue({
                    do: vi.fn().mockResolvedValue({ txid }),
                }),
            },
        },
    })
    test('submits tx group and returns txIds from response string', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        const result = await transport.send(transactionResult, {
            type: 'local',
        })

        expect(result).toEqual({ type: 'submitted', txIds: ['TX1'] })
        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
    })

    test.each([
        ['strategy-signed', transactionResult.signedData.type],
        ['planner-signed', 'signed-transactions'],
    ] as const)(
        'posts %s bytes unchanged and reports their ids',
        async (_, type) => {
            const algokit = makeAlgokit([])
            const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

            const result = await transport.send(
                {
                    signedData: {
                        type,
                        signed: [SIGNED],
                        ...(type === 'signed-transactions' && {
                            historyEntries: [],
                        }),
                    } as SigningResult['signedData'],
                    signers: [{ address: 'ADDR' }],
                },
                { type: 'local' },
            )

            expect(result).toEqual({ type: 'submitted', txIds: [SIGNED.id] })
            expect(
                algokit.client.algod.sendRawTransaction,
            ).toHaveBeenCalledWith(SIGNED_BYTES)
        },
    )

    test('submits tx group and returns txIds from response array', async () => {
        const algokit = makeAlgokit(['TX1', 'TX2'])
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        const result = await transport.send(transactionResult, {
            type: 'local',
        })

        expect(result).toEqual({ type: 'submitted', txIds: ['TX1', 'TX2'] })
    })

    test('falls back to the signed transaction id when response omits txid', async () => {
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockResolvedValue({}),
                    }),
                },
            },
        }
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        const result = await transport.send(transactionResult, {
            type: 'local',
        })

        expect(result).toEqual({
            type: 'submitted',
            txIds: [SIGNED.id],
        })
    })

    test('rejects non-transaction data with TransportError', async () => {
        const algokit = makeAlgokit()
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        await expect(
            transport.send(arbitraryResult, { type: 'local' }),
        ).rejects.toThrow('only supports transaction data')
    })

    test('forwards classified SubmissionErrors unwrapped so retryability survives to the machine', async () => {
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(new Error('algod down')),
                    }),
                },
            },
        }
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        await expectSubmissionError(() =>
            transport.send(transactionResult, { type: 'local' }),
        )
    })

    test('forwards non-Error rejections as classified SubmissionErrors', async () => {
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue('boom'),
                    }),
                },
            },
        }
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        await expectSubmissionError(() =>
            transport.send(transactionResult, { type: 'local' }),
        )
    })

    test("aborts with ScopeChangedError when Algorand's network switches", async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        useNetworkStore.getState().setMode('live')

        await expect(
            transport.send(transactionResult, { type: 'local' }),
        ).rejects.toBeInstanceOf(ScopeChangedError)
        expect(algokit.client.algod.sendRawTransaction).not.toHaveBeenCalled()
    })

    test('still submits when only another chain switches network', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)

        useNetworkStore.getState().selectNetwork('ethereum', 'sepolia')

        const result = await transport.send(transactionResult, {
            type: 'local',
        })

        expect(result).toEqual({ type: 'submitted', txIds: ['TX1'] })
    })

    test('passes the submitted ids to source.callbacks.approve and reports the source answered', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)
        const approve = vi.fn().mockResolvedValue(undefined)
        const source: SourceMetadata = {
            type: 'gift-card',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        expect(approve).toHaveBeenCalledWith(transactionResult, {
            txIds: ['TX1'],
        })
        expect(result).toEqual({
            type: 'submitted-and-answered',
            txIds: ['TX1'],
        })
    })

    test('returns submitted even when the approve callback throws', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)
        const approve = vi.fn().mockRejectedValue(new Error('webview gone'))
        const source: SourceMetadata = {
            type: 'gift-card',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        expect(approve).toHaveBeenCalled()
        expect(result).toEqual({ type: 'submitted', txIds: ['TX1'] })
    })

    test('does not invoke approve when submission fails', async () => {
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockRejectedValue(new Error('algod down')),
                    }),
                },
            },
        }
        const transport = createAlgodTransport(algokit, ALGORAND_TESTNET)
        const approve = vi.fn()
        const source: SourceMetadata = {
            type: 'gift-card',
            callbacks: { approve },
        }

        await expectSubmissionError(() =>
            transport.send(transactionResult, source),
        )
        expect(approve).not.toHaveBeenCalled()
    })
})
