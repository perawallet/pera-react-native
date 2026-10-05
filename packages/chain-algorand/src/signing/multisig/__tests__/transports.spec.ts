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
import {
    NetworkChangedError,
    TransportError,
    walletConnectHandoffs,
    type SigningResult,
    type SourceMetadata,
} from '@perawallet/wallet-core-signing'
import { createMultisigCosignTransport } from '../createMultisigCosignTransport'
import { createMultisigProposeTransport } from '../createMultisigProposeTransport'
import { draftProposeContexts } from '../draftProposeContexts'

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
    } as SigningResult['signedData'],
    signers: [{ address: 'ADDR' }],
}

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
            createDraftSignRequest?: ReturnType<typeof vi.fn>
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
            opts.createDraftSignRequest,
        )
    }

    // Deferred-propose signal: a hardware-only proposer signs nothing during
    // Send, so the actor hands the transport an empty signers array.
    const deferredResult: SigningResult = {
        signedData: {
            type: 'transactions',
            signed: [{ txn: {} as never, blob: new Uint8Array() } as never],
        } as SigningResult['signedData'],
        signers: [],
    }

    beforeEach(() => {
        walletConnectHandoffs.__resetForTests()
        draftProposeContexts.__resetForTests()
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
            expect(handoff?.scope).toEqual({
                chainId: 'algorand',
                networkId: 'testnet',
            })
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

    test('deferred draft for an external source stashes the delivery context for the bootstrap', async () => {
        const proposeSignRequest = vi.fn()
        const createDraftSignRequest = vi.fn().mockReturnValue('draft-1')
        const approveSignedBytes = vi.fn()
        const transport = buildPropose(proposeSignRequest, {
            createDraftSignRequest,
        })
        const source: SourceMetadata = {
            type: 'walletconnect',
            callbacks: { approveSignedBytes },
            handoffDelivery: {
                clientId: 'client-1',
                payloadId: 7,
                indicesToSign: [0],
                totalLength: 1,
            },
        }

        const result = await transport.send(
            deferredResult,
            source,
            'JOINT_ADDR',
        )

        expect(result).toEqual({
            type: 'proposed',
            signRequestId: 'draft-1',
            status: 'pending',
            sourceType: 'walletconnect',
        })
        expect(proposeSignRequest).not.toHaveBeenCalled()
        // Nothing to register yet: the backend record doesn't exist. The
        // validated preconditions ride along so the bootstrap can register.
        expect(walletConnectHandoffs.list()).toEqual([])
        expect(draftProposeContexts.get('draft-1')).toEqual({
            source,
            msigMetadata: MSIG_METADATA,
            deviceId: 'device-1',
        })
    })

    test('deferred draft for a local source stashes the source so onProposed can fire at bootstrap', async () => {
        const createDraftSignRequest = vi.fn().mockReturnValue('draft-2')
        const transport = buildPropose(vi.fn(), { createDraftSignRequest })
        const onProposed = vi.fn()
        const source: SourceMetadata = {
            type: 'local',
            callbacks: { onProposed },
        }

        await transport.send(deferredResult, source, 'JOINT_ADDR')

        expect(draftProposeContexts.get('draft-2')).toEqual({
            source,
            msigMetadata: undefined,
            deviceId: undefined,
        })
    })

    test('deferred draft for an external source fails non-retryably when msig metadata is missing', async () => {
        const createDraftSignRequest = vi.fn()
        const error = vi.fn().mockResolvedValue(undefined)
        const transport = buildPropose(vi.fn(), {
            msigMetadata: null,
            createDraftSignRequest,
        })

        const thrown = await transport
            .send(
                deferredResult,
                { type: 'walletconnect', callbacks: { error } },
                'JOINT_ADDR',
            )
            .then(
                () => null,
                e => e as TransportError,
            )

        expect(thrown).toBeInstanceOf(TransportError)
        expect(thrown?.metadata.retryable).toBe(false)
        // No draft either: a draft whose bootstrap could never deliver would
        // recreate the stranded-at-ready record this validation prevents.
        expect(createDraftSignRequest).not.toHaveBeenCalled()

        await Promise.resolve()
        await Promise.resolve()
        expect(error).toHaveBeenCalled()
    })

    test('deferred draft for an external source fails retryably when device id is missing', async () => {
        const createDraftSignRequest = vi.fn()
        const error = vi.fn().mockResolvedValue(undefined)
        const transport = buildPropose(vi.fn(), {
            deviceId: 'omit',
            createDraftSignRequest,
        })

        const thrown = await transport
            .send(
                deferredResult,
                { type: 'walletconnect', callbacks: { error } },
                'JOINT_ADDR',
            )
            .then(
                () => null,
                e => e as TransportError,
            )

        expect(thrown).toBeInstanceOf(TransportError)
        expect(thrown?.metadata.retryable).toBe(true)
        expect(createDraftSignRequest).not.toHaveBeenCalled()

        await Promise.resolve()
        await Promise.resolve()
        expect(error).not.toHaveBeenCalled()
    })
})
