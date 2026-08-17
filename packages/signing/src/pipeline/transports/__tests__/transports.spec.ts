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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { Optional } from '@perawallet/wallet-core-shared'
import { createAlgodTransport } from '../createAlgodTransport'
import { createCallbackTransport } from '../createCallbackTransport'
import { createWalletConnectTransport } from '../createWalletConnectTransport'
import { createMultisigCosignTransport } from '../createMultisigCosignTransport'
import { createMultisigProposeTransport } from '../createMultisigProposeTransport'
import { walletConnectHandoffs } from '../../walletConnectHandoffs'
import {
    NetworkChangedError,
    SubmissionError,
    TransportError,
} from '../../errors'
import type {
    SigningResult,
    SourceMetadata,
    SignedTransactionData,
    SignedArbitraryData,
} from '../../types'

const getNetworkMock = vi.fn(() => ({ network: 'testnet' }))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useNetworkStore: {
            getState: () => getNetworkMock(),
            subscribe: () => () => {},
        },
        encodeTransactionRaw: vi.fn(() => new Uint8Array([0xa1, 0xa2])),
    }
})

const transactionResult: SigningResult = {
    signedData: {
        type: 'transactions',
        signed: [{ txn: {} as never, blob: new Uint8Array() } as never],
    } as SignedTransactionData,
    signers: [{ address: 'ADDR' }],
}

const arbitraryResult: SigningResult = {
    signedData: {
        type: 'arbitrary-data',
        signatures: [new Uint8Array([1])],
    } as SignedArbitraryData,
    signers: [{ address: 'ADDR' }],
}

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
            } as SignedTransactionData,
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

describe('createCallbackTransport', () => {
    test('calls approve and returns callback-sent', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            requestId: 'req-1',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        expect(approve).toHaveBeenCalledWith(transactionResult)
        expect(result).toEqual({ type: 'callback-sent', requestId: 'req-1' })
    })

    test('defaults requestId to empty string when not provided', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        if (result.type === 'callback-sent') {
            expect(result.requestId).toBe('')
        }
    })

    test('throws when approve callback is missing', async () => {
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
        }

        await expect(transport.send(transactionResult, source)).rejects.toThrow(
            'No approve callback',
        )
    })

    test('forwards approve failures via error callback and throws TransportError', async () => {
        const approve = vi.fn().mockRejectedValue(new Error('approve fail'))
        const errorCb = vi.fn().mockResolvedValue(undefined)
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            callbacks: { approve, error: errorCb },
        }

        await expect(transport.send(transactionResult, source)).rejects.toThrow(
            TransportError,
        )
        expect(errorCb).toHaveBeenCalled()
    })

    test('wraps non-Error rejections in TransportError', async () => {
        const approve = vi.fn().mockRejectedValue('string err')
        const transport = createCallbackTransport()
        const source: SourceMetadata = {
            type: 'local',
            transport: 'callback',
            callbacks: { approve },
        }

        await expect(transport.send(transactionResult, source)).rejects.toThrow(
            TransportError,
        )
    })
})

describe('createWalletConnectTransport', () => {
    test('calls approve and returns callback-sent with requestId', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createWalletConnectTransport('testnet')
        const source: SourceMetadata = {
            type: 'walletconnect',
            requestId: 'wc-1',
            callbacks: { approve },
        }

        const result = await transport.send(transactionResult, source)

        expect(approve).toHaveBeenCalledWith(transactionResult)
        expect(result).toEqual({ type: 'callback-sent', requestId: 'wc-1' })
    })

    test('throws when approve callback is missing', async () => {
        const transport = createWalletConnectTransport('testnet')

        await expect(
            transport.send(transactionResult, { type: 'walletconnect' }),
        ).rejects.toThrow('No approve callback')
    })

    test('throws when requestId is missing', async () => {
        const approve = vi.fn()
        const transport = createWalletConnectTransport('testnet')

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                callbacks: { approve },
            }),
        ).rejects.toThrow('No request ID')
    })

    test('calls error callback when approve rejects', async () => {
        const approve = vi.fn().mockRejectedValue(new Error('reject'))
        const errorCb = vi.fn().mockResolvedValue(undefined)
        const transport = createWalletConnectTransport('testnet')

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                requestId: 'wc-1',
                callbacks: { approve, error: errorCb },
            }),
        ).rejects.toThrow(TransportError)

        expect(errorCb).toHaveBeenCalled()
    })

    test('wraps non-Error rejections in TransportError', async () => {
        const approve = vi.fn().mockRejectedValue(42)
        const transport = createWalletConnectTransport('testnet')

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                requestId: 'wc-1',
                callbacks: { approve },
            }),
        ).rejects.toThrow(TransportError)
    })

    test('aborts with NetworkChangedError when live network differs from captured', async () => {
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = createWalletConnectTransport('testnet')

        getNetworkMock.mockReturnValueOnce({ network: 'mainnet' })

        await expect(
            transport.send(transactionResult, {
                type: 'walletconnect',
                requestId: 'wc-1',
                callbacks: { approve },
            }),
        ).rejects.toBeInstanceOf(NetworkChangedError)
        expect(approve).not.toHaveBeenCalled()
    })
})

describe('createMultisigCosignTransport', () => {
    test('adds signatures and returns signatures-added result', async () => {
        const addSignatures = vi.fn().mockResolvedValue({ status: 'ready' })
        const transport = createMultisigCosignTransport(
            addSignatures,
            'testnet',
        )
        const source: SourceMetadata = {
            type: 'multisig-cosign',
            signRequestId: 'mcs-1',
        }

        const result = await transport.send(transactionResult, source)

        expect(addSignatures).toHaveBeenCalledWith({
            signRequestId: 'mcs-1',
            signers: transactionResult.signers,
        })
        expect(result).toEqual({
            type: 'signatures-added',
            signRequestId: 'mcs-1',
            status: 'ready',
        })
    })

    test('throws when signRequestId is missing', async () => {
        const transport = createMultisigCosignTransport(vi.fn(), 'testnet')

        await expect(
            transport.send(transactionResult, { type: 'multisig-cosign' }),
        ).rejects.toThrow('Sign request ID is required')
    })

    test('throws NetworkChangedError when live network differs', async () => {
        getNetworkMock.mockReturnValueOnce({ network: 'mainnet' })
        const addSignatures = vi.fn()
        const transport = createMultisigCosignTransport(
            addSignatures,
            'testnet',
        )

        await expect(
            transport.send(transactionResult, {
                type: 'multisig-cosign',
                signRequestId: 'mcs-1',
            }),
        ).rejects.toThrow(NetworkChangedError)
        expect(addSignatures).not.toHaveBeenCalled()
    })

    test('wraps API errors in TransportError', async () => {
        const addSignatures = vi.fn().mockRejectedValue(new Error('api fail'))
        const transport = createMultisigCosignTransport(
            addSignatures,
            'testnet',
        )

        await expect(
            transport.send(transactionResult, {
                type: 'multisig-cosign',
                signRequestId: 'mcs-1',
            }),
        ).rejects.toThrow(TransportError)
    })

    test('wraps non-Error rejections in TransportError', async () => {
        const addSignatures = vi.fn().mockRejectedValue('bad')
        const transport = createMultisigCosignTransport(
            addSignatures,
            'testnet',
        )

        await expect(
            transport.send(transactionResult, {
                type: 'multisig-cosign',
                signRequestId: 'mcs-1',
            }),
        ).rejects.toThrow(TransportError)
    })
})

describe('createMultisigProposeTransport', () => {
    const MSIG_METADATA = {
        version: 1,
        threshold: 2,
        addresses: ['A', 'B', 'C'],
    }

    const buildPropose = (
        proposeSignRequest: ReturnType<typeof vi.fn> = vi.fn(),
        opts: {
            msigMetadata?: typeof MSIG_METADATA | null
            // `'omit'` indicates the caller wants getDeviceId to return
            // undefined; bare `undefined` falls through to the default.
            deviceId?: string | 'omit'
        } = {},
    ) => {
        const msigMetadata =
            'msigMetadata' in opts ? opts.msigMetadata : MSIG_METADATA
        const deviceId =
            opts.deviceId === 'omit' ? undefined : (opts.deviceId ?? 'device-1')
        return createMultisigProposeTransport(
            proposeSignRequest,
            'testnet',
            () => msigMetadata ?? undefined,
            () => deviceId,
        )
    }

    beforeEach(() => {
        walletConnectHandoffs.__resetForTests()
    })

    test('proposes (type=async) and returns proposed result for local source', async () => {
        const proposeSignRequest = vi.fn().mockResolvedValue({
            signRequestId: 'new-req',
            status: 'pending',
        })
        const transport = buildPropose(proposeSignRequest)

        const result = await transport.send(
            transactionResult,
            { type: 'local' },
            'JOINT_ADDR',
        )

        expect(proposeSignRequest).toHaveBeenCalledWith({
            multisigAddress: 'JOINT_ADDR',
            signedData: transactionResult.signedData,
            signers: transactionResult.signers,
            type: 'async',
        })
        expect(result).toEqual({
            type: 'proposed',
            signRequestId: 'new-req',
            status: 'pending',
            sourceType: 'local',
        })
        // Local source: no handoff registered (in-app inbox owns delivery).
        expect(walletConnectHandoffs.list()).toEqual([])
    })

    test('honors transportOptions.multisig.proposeMode (sync) for a local source', async () => {
        // Shared-account swaps propose locally but must use the sync protocol
        // so the backend doesn't broadcast — the proposer submits to algod.
        const proposeSignRequest = vi.fn().mockResolvedValue({
            signRequestId: 'swap-req',
            status: 'pending',
            rawTransactionsBase64: [],
        })
        const transport = buildPropose(proposeSignRequest)

        await transport.send(
            transactionResult,
            {
                type: 'local',
                transportOptions: { multisig: { proposeMode: 'sync' } },
            },
            'JOINT_ADDR',
        )

        expect(proposeSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'sync' }),
        )
    })

    test('throws when multisigAddress is missing', async () => {
        const transport = buildPropose()

        await expect(
            transport.send(transactionResult, { type: 'local' }),
        ).rejects.toThrow('Multisig address is required')
    })

    test('throws NetworkChangedError when live network differs', async () => {
        getNetworkMock.mockReturnValueOnce({ network: 'mainnet' })
        const proposeSignRequest = vi.fn()
        const transport = buildPropose(proposeSignRequest)

        await expect(
            transport.send(transactionResult, { type: 'local' }, 'JOINT_ADDR'),
        ).rejects.toThrow(NetworkChangedError)
        expect(proposeSignRequest).not.toHaveBeenCalled()
    })

    test('wraps API errors in TransportError', async () => {
        const proposeSignRequest = vi
            .fn()
            .mockRejectedValue(new Error('propose fail'))
        const transport = buildPropose(proposeSignRequest)

        await expect(
            transport.send(transactionResult, { type: 'local' }, 'JOINT_ADDR'),
        ).rejects.toThrow(TransportError)
    })

    test('wraps non-Error rejections in TransportError', async () => {
        const proposeSignRequest = vi.fn().mockRejectedValue(123)
        const transport = buildPropose(proposeSignRequest)

        await expect(
            transport.send(transactionResult, { type: 'local' }, 'JOINT_ADDR'),
        ).rejects.toThrow(TransportError)
    })

    test.each(['walletconnect', 'webview', 'deeplink'] as const)(
        'registers a handoff for %s source after successful propose (type=sync)',
        async sourceType => {
            const proposeSignRequest = vi.fn().mockResolvedValue({
                signRequestId: 'wc-handoff',
                status: 'pending',
                rawTransactionsBase64: ['cHJvcG9zZWQ='],
            })
            const approveSignedBytes = vi.fn()
            const error = vi.fn()
            const reject = vi.fn()
            const transport = buildPropose(proposeSignRequest)

            const result = await transport.send(
                transactionResult,
                {
                    type: sourceType,
                    callbacks: { approveSignedBytes, error, reject },
                },
                'JOINT_ADDR',
            )

            expect(proposeSignRequest).toHaveBeenCalledWith({
                multisigAddress: 'JOINT_ADDR',
                signedData: transactionResult.signedData,
                signers: transactionResult.signers,
                type: 'sync',
            })
            expect(result).toEqual({
                type: 'proposed',
                signRequestId: 'wc-handoff',
                status: 'pending',
                sourceType,
            })
            // No reject called by the transport — the resolver invokes it
            // (with `kind: 'softReject'`) when status terminates.
            expect(reject).not.toHaveBeenCalled()

            const handoff = walletConnectHandoffs.get('wc-handoff')
            expect(handoff).toBeDefined()
            expect(handoff?.multisigAddress).toBe('JOINT_ADDR')
            expect(handoff?.deviceId).toBe('device-1')
            expect(handoff?.network).toBe('testnet')
            expect(handoff?.msigMetadata).toEqual(MSIG_METADATA)
            // The bytes the adapter actually sent are pinned on the handoff
            // so the resolver can refuse mismatching poll responses.
            expect(handoff?.expectedRawTransactionsBase64).toEqual([
                'cHJvcG9zZWQ=',
            ])
            expect(handoff?.callbacks.approveSignedBytes).toBe(
                approveSignedBytes,
            )
            expect(handoff?.callbacks.error).toBe(error)
            expect(handoff?.callbacks.reject).toBe(reject)
        },
    )

    test('missing msig metadata fails before the create, notifies the peer, and is non-retryable', async () => {
        const proposeSignRequest = vi.fn().mockResolvedValue({
            signRequestId: 'wc-handoff',
            status: 'pending',
        })
        const error = vi.fn().mockResolvedValue(undefined)
        const transport = buildPropose(proposeSignRequest, {
            msigMetadata: null,
        })

        const thrown = await transport
            .send(
                transactionResult,
                { type: 'walletconnect', callbacks: { error } },
                'JOINT_ADDR',
            )
            .then(
                () => null,
                e => e as TransportError,
            )

        expect(thrown).toBeInstanceOf(TransportError)
        // A retry would create a duplicate-prone flow for a programmer error
        // that retrying cannot fix.
        expect(thrown?.metadata.retryable).toBe(false)
        // The whole point of the precondition: no backend record is created
        // that could be orphaned (nothing registered => the resolver would
        // never cancel it).
        expect(proposeSignRequest).not.toHaveBeenCalled()

        await Promise.resolve()
        await Promise.resolve()
        expect(error).toHaveBeenCalled()
        expect(walletConnectHandoffs.list()).toEqual([])
    })

    test('missing device id fails before the create, keeps the peer request alive, and is retryable', async () => {
        const proposeSignRequest = vi.fn().mockResolvedValue({
            signRequestId: 'wc-handoff',
            status: 'pending',
        })
        const error = vi.fn().mockResolvedValue(undefined)
        const transport = buildPropose(proposeSignRequest, {
            deviceId: 'omit',
        })

        const thrown = await transport
            .send(
                transactionResult,
                { type: 'walletconnect', callbacks: { error } },
                'JOINT_ADDR',
            )
            .then(
                () => null,
                e => e as TransportError,
            )

        expect(thrown).toBeInstanceOf(TransportError)
        // Transient (device re-registration / network switch): Retry can
        // succeed once registration completes, and nothing was created.
        expect(thrown?.metadata.retryable).toBe(true)
        expect(proposeSignRequest).not.toHaveBeenCalled()

        await Promise.resolve()
        await Promise.resolve()
        // Not notified: erroring the WC request would kill the very request a
        // successful Retry still needs to deliver to.
        expect(error).not.toHaveBeenCalled()
        expect(walletConnectHandoffs.list()).toEqual([])
    })
})
