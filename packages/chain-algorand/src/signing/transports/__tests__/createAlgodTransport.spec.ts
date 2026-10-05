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
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    NetworkChangedError,
    SubmissionError,
    TransportError,
    type SigningResult,
    type SourceMetadata,
} from '@perawallet/wallet-core-signing'
import { createAlgodTransport } from '../createAlgodTransport'

const getNetworkMock = vi.fn(() => ({ network: 'testnet' }))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetworkStore: {
        getState: () => getNetworkMock(),
        subscribe: () => () => {},
    },
}))

const transactionResult = {
    signedData: {
        type: 'transactions',
        signed: [{ txn: {} as never, blob: new Uint8Array() } as never],
    },
    signers: [{ address: 'ADDR' }],
} as SigningResult

const arbitraryResult = {
    signedData: {
        type: 'arbitrary-data',
        signatures: [new Uint8Array([1])],
    },
    signers: [{ address: 'ADDR' }],
} as unknown as SigningResult

describe('createAlgodTransport', () => {
    const makeAlgokit = (txid: Optional<string | string[]> = 'TX_ID') => ({
        client: {
            algod: {
                sendRawTransaction: vi.fn().mockReturnValue({
                    do: vi.fn().mockResolvedValue({ txid }),
                }),
            },
        },
    })
    const encodeSignedTransactions = vi
        .fn()
        .mockReturnValue([new Uint8Array([1])])

    test('submits tx group and returns txIds from response string', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )

        const result = await transport.send(transactionResult, {
            type: 'local',
        })

        expect(result).toEqual({ type: 'submitted', txIds: ['TX1'] })
        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalled()
    })

    test('submits tx group and returns txIds from response array', async () => {
        const algokit = makeAlgokit(['TX1', 'TX2'])
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )

        const result = await transport.send(transactionResult, {
            type: 'local',
        })

        expect(result).toEqual({ type: 'submitted', txIds: ['TX1', 'TX2'] })
    })

    test('falls back to signedTxn.txn.txID() when response omits txid', async () => {
        const txIdFn = vi.fn().mockReturnValue('COMPUTED_ID')
        const signedWithId = {
            signedData: {
                type: 'transactions',
                signed: [
                    {
                        txn: { txID: txIdFn },
                        blob: new Uint8Array(),
                    } as never,
                ],
            } as never,
            signers: [{ address: 'ADDR' }],
        }
        const algokit = {
            client: {
                algod: {
                    sendRawTransaction: vi.fn().mockReturnValue({
                        do: vi.fn().mockResolvedValue({}),
                    }),
                },
            },
        }
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )

        const result = await transport.send(signedWithId, {
            type: 'local',
        })

        expect(txIdFn).toHaveBeenCalled()
        expect(result).toEqual({
            type: 'submitted',
            txIds: ['COMPUTED_ID'],
        })
    })

    test('rejects non-transaction data with TransportError', async () => {
        const algokit = makeAlgokit()
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )

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
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )

        await expect(
            transport.send(transactionResult, { type: 'local' }),
        ).rejects.toThrow(SubmissionError)
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
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )

        await expect(
            transport.send(transactionResult, { type: 'local' }),
        ).rejects.toThrow(SubmissionError)
    })

    test('aborts with NetworkChangedError when live network differs from captured', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )

        getNetworkMock.mockReturnValueOnce({ network: 'mainnet' })

        await expect(
            transport.send(transactionResult, { type: 'local' }),
        ).rejects.toBeInstanceOf(NetworkChangedError)
        expect(algokit.client.algod.sendRawTransaction).not.toHaveBeenCalled()
    })

    test('invokes source.callbacks.approve after successful submission', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )
        const approve = vi.fn().mockResolvedValue(undefined)
        const source: SourceMetadata = {
            type: 'gift-card',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        expect(approve).toHaveBeenCalledWith(transactionResult)
        expect(result).toEqual({ type: 'submitted', txIds: ['TX1'] })
    })

    test('returns submitted even when the approve callback throws', async () => {
        const algokit = makeAlgokit('TX1')
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )
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
        const transport = createAlgodTransport(
            algokit,
            encodeSignedTransactions,
            'testnet',
        )
        const approve = vi.fn()
        const source: SourceMetadata = {
            type: 'gift-card',
            callbacks: { approve },
        }

        await expect(transport.send(transactionResult, source)).rejects.toThrow(
            SubmissionError,
        )
        expect(approve).not.toHaveBeenCalled()
    })
})
