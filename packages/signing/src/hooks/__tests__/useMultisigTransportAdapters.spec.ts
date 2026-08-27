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

import React from 'react'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import {
    proposeSignRequestSchema,
    useDraftSignRequestStore,
} from '@perawallet/wallet-core-multisig'
import { useMultisigTransportAdapters } from '../useMultisigTransportAdapters'
import { draftProposeContexts } from '../../pipeline/draftProposeContexts'
import { walletConnectHandoffs } from '../../pipeline/walletConnectHandoffs'
import type { SigningResult } from '../../pipeline/types'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'

// Fake signed-transaction node. The transport reads only `txn` (passed to the
// mocked encoder via its `tag`) and `sig`; the cast bridges the partial literal
// to algosdk's SignedTransaction class without needing a real instance.
const fakeSigned = (tag: string, sig?: Uint8Array): PeraSignedTransaction =>
    ({
        txn: { tag },
        ...(sig ? { sig } : {}),
    }) as unknown as PeraSignedTransaction

const mocks = vi.hoisted(() => ({
    proposeSignRequest: vi.fn(),
    addSignature: vi.fn(),
    useNetwork: vi.fn(),
    encodeTransactionRaw: vi.fn(),
    useAllAccounts: vi.fn(),
    useDeviceID: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => mocks.useNetwork(),
    useTransactionEncoder: () => ({
        encodeTransactionRaw: mocks.encodeTransactionRaw,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mocks.useAllAccounts(),
    isMultisigAccount: (a: { type?: string } | null | undefined) =>
        a?.type === 'multisig',
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: (network: string) => mocks.useDeviceID(network),
}))

vi.mock('@perawallet/wallet-core-multisig', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-multisig',
    )
    return {
        ...actual,
        proposeSignRequest: mocks.proposeSignRequest,
        addSignature: mocks.addSignature,
    }
})

const baseAccountResponse = {
    custom_id: 'msig-1',
    creation_datetime: '2025-01-01T00:00:00Z',
    address: 'MSIG',
    version: 1,
    threshold: 2,
    participant_addresses: ['A', 'B'],
}

const baseSignRequestResponse = {
    id: 'sr-1',
    status: 'pending' as const,
    type: 'async',
    creation_datetime: '2025-01-15T10:00:00Z',
    expected_expire_datetime: '2025-01-16T10:00:00Z',
    fail_reason_display: null,
    joint_account: baseAccountResponse,
    transaction_lists: [
        {
            id: 'txl-1',
            raw_transactions: ['tx'],
            first_valid_block: 1,
            last_valid_block: 100,
            expected_expire_datetime: '2025-01-16T10:00:00Z',
            responses: [{ address: 'A', response: 'signed' as const }],
        },
    ],
}

const renderTransportFns = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
    const { result } = renderHook(() => useMultisigTransportAdapters(), {
        wrapper,
    })
    return { result, queryClient }
}

const buildTxnSigningResult = (): {
    signedData: SigningResult['signedData']
    signers: SigningResult['signers']
} => ({
    signedData: {
        type: 'transactions',
        signed: [
            fakeSigned('TXN_1', new Uint8Array([1])),
            fakeSigned('TXN_2', new Uint8Array([2])),
        ],
    },
    signers: [
        { address: 'PARTICIPANT_A', signatures: ['c2lnQTA=', 'c2lnQTE='] },
        { address: 'PARTICIPANT_B', signatures: ['c2lnQjA=', 'c2lnQjE='] },
    ],
})

describe('useMultisigTransportAdapters', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'testnet' })
        mocks.useAllAccounts.mockReturnValue([
            {
                type: 'multisig',
                address: 'MSIG',
                multisigDetails: {
                    version: 1,
                    threshold: 2,
                    addresses: ['A', 'B'],
                },
            },
        ])
        mocks.useDeviceID.mockReturnValue('device-1')
        // Encode each txn to a deterministic, distinguishable byte sequence
        mocks.encodeTransactionRaw.mockImplementation(
            (txn: { tag: string }) =>
                new Uint8Array([txn.tag === 'TXN_1' ? 0xa1 : 0xa2]),
        )
    })

    describe('proposeSignRequest', () => {
        test('with a single local signer: only the propose call fires, with proposer in responses', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            const { result } = renderTransportFns()

            const response = await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData: {
                    type: 'transactions',
                    signed: [fakeSigned('TXN_1', new Uint8Array([1]))],
                },
                signers: [
                    { address: 'PARTICIPANT_A', signatures: ['c2lnQTA='] },
                ],
                type: 'async',
            })

            expect(mocks.proposeSignRequest).toHaveBeenCalledTimes(1)
            expect(mocks.addSignature).not.toHaveBeenCalled()

            const [network, params] = mocks.proposeSignRequest.mock.calls[0]
            expect(network).toBe('testnet')
            expect(params).toEqual({
                joint_account_address: 'MSIG',
                proposer_address: 'PARTICIPANT_A',
                type: 'async',
                raw_transaction_lists: [['oQ==']],
                responses: [
                    {
                        address: 'PARTICIPANT_A',
                        response: 'signed',
                        signatures: [['c2lnQTA=']],
                    },
                ],
            })
            expect(response).toEqual({
                signRequestId: 'sr-1',
                status: 'pending',
                rawTransactionsBase64: ['oQ=='],
                proposerAddress: 'PARTICIPANT_A',
            })
        })

        test('with N local signers: 1 propose (proposer-only) + (N-1) cosigns', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            mocks.addSignature.mockResolvedValue({
                ...baseSignRequestResponse,
                status: 'ready',
            })
            const { result } = renderTransportFns()
            const { signedData, signers } = buildTxnSigningResult()

            const response = await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData,
                signers,
                type: 'async',
            })

            // Propose carries proposer (signers[0]) only
            expect(mocks.proposeSignRequest).toHaveBeenCalledTimes(1)
            const [, proposeParams] = mocks.proposeSignRequest.mock.calls[0]
            expect(proposeParams.proposer_address).toBe('PARTICIPANT_A')
            expect(proposeParams.responses).toEqual([
                {
                    address: 'PARTICIPANT_A',
                    response: 'signed',
                    signatures: [['c2lnQTA=', 'c2lnQTE=']],
                },
            ])

            // Cosign carries signers[1..] one at a time
            expect(mocks.addSignature).toHaveBeenCalledTimes(1)
            const [cosignNetwork, cosignSignRequestId, cosignResponses] =
                mocks.addSignature.mock.calls[0]
            expect(cosignNetwork).toBe('testnet')
            expect(cosignSignRequestId).toBe('sr-1')
            expect(cosignResponses).toEqual([
                {
                    address: 'PARTICIPANT_B',
                    response: 'signed',
                    signatures: [['c2lnQjA=', 'c2lnQjE=']],
                },
            ])

            // Status reflects the latest successful response (cosign), not propose
            expect(response).toEqual({
                signRequestId: 'sr-1',
                status: 'ready',
                rawTransactionsBase64: ['oQ==', 'og=='],
                proposerAddress: 'PARTICIPANT_A',
            })
        })

        test('produced propose payload validates against proposeSignRequestSchema', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            mocks.addSignature.mockResolvedValue(baseSignRequestResponse)
            const { result } = renderTransportFns()
            const { signedData, signers } = buildTxnSigningResult()

            await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData,
                signers,
                type: 'async',
            })

            const [, params] = mocks.proposeSignRequest.mock.calls[0]
            expect(() => proposeSignRequestSchema.parse(params)).not.toThrow()
        })

        test('cosign failure for one signer does not fail the whole flow', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            mocks.addSignature.mockRejectedValue(new Error('flaky cosign'))
            const { result } = renderTransportFns()
            const { signedData, signers } = buildTxnSigningResult()

            const response = await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData,
                signers,
                type: 'async',
            })

            // Propose succeeded; status falls back to propose's status when cosigns fail
            expect(response).toEqual({
                signRequestId: 'sr-1',
                status: 'pending',
                rawTransactionsBase64: ['oQ==', 'og=='],
                proposerAddress: 'PARTICIPANT_A',
            })
        })

        test('writes the latest sign-request response into the detail query cache', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            const cosignResponse = {
                ...baseSignRequestResponse,
                status: 'ready' as const,
            }
            mocks.addSignature.mockResolvedValue(cosignResponse)
            const { result, queryClient } = renderTransportFns()
            const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')
            const { signedData, signers } = buildTxnSigningResult()

            await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData,
                signers,
                type: 'async',
            })

            expect(setQueryDataSpy).toHaveBeenCalledWith(
                [
                    'multisig',
                    'sign-request-detail',
                    { network: 'testnet', signRequestId: 'sr-1' },
                ],
                // The adapter backfills `proposer_address` from the
                // proposer we just sent in case the backend response omits
                // it — this keeps the proposer's Cancel button visible.
                { ...cosignResponse, proposer_address: 'PARTICIPANT_A' },
            )
        })

        test('writes the propose response into the cache when there are no cosigners', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            const { result, queryClient } = renderTransportFns()
            const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

            await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData: {
                    type: 'transactions',
                    signed: [fakeSigned('TXN_1', new Uint8Array([1]))],
                },
                signers: [
                    { address: 'PARTICIPANT_A', signatures: ['c2lnQTA='] },
                ],
                type: 'async',
            })

            expect(setQueryDataSpy).toHaveBeenCalledWith(
                [
                    'multisig',
                    'sign-request-detail',
                    { network: 'testnet', signRequestId: 'sr-1' },
                ],
                {
                    ...baseSignRequestResponse,
                    proposer_address: 'PARTICIPANT_A',
                },
            )
        })

        test('throws when signedData is not transactions', async () => {
            const { result } = renderTransportFns()

            await expect(
                result.current.proposeSignRequest({
                    multisigAddress: 'MSIG',
                    signedData: {
                        type: 'arbitrary-data',
                        signatures: [new Uint8Array([1])],
                    },
                    signers: [{ address: 'A', signatures: ['x'] }],
                    type: 'async',
                }),
            ).rejects.toThrow(/transaction data/)

            expect(mocks.proposeSignRequest).not.toHaveBeenCalled()
        })

        test('throws when signers list is empty', async () => {
            const { result } = renderTransportFns()

            await expect(
                result.current.proposeSignRequest({
                    multisigAddress: 'MSIG',
                    signedData: { type: 'transactions', signed: [] },
                    signers: [],
                    type: 'async',
                }),
            ).rejects.toThrow(/at least one signer/)

            expect(mocks.proposeSignRequest).not.toHaveBeenCalled()
        })

        test('handles missing signatures field (treats as empty inner array)', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            const { result } = renderTransportFns()

            await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData: {
                    type: 'transactions',
                    signed: [fakeSigned('TXN_1')],
                },
                signers: [{ address: 'A' /* no signatures field */ }],
                type: 'async',
            })

            const [, params] = mocks.proposeSignRequest.mock.calls[0]
            expect(params.responses[0]).toEqual({
                address: 'A',
                response: 'signed',
                signatures: [[]],
            })
        })
    })

    describe('addSignatures', () => {
        test('translates signers into AddSignatureRequest array and calls endpoint', async () => {
            mocks.addSignature.mockResolvedValue(baseSignRequestResponse)
            const { result } = renderTransportFns()

            const response = await result.current.addSignatures({
                signRequestId: 'sr-42',
                signers: [
                    { address: 'A', signatures: ['c2lnQTA='] },
                    { address: 'B', signatures: ['c2lnQjA='] },
                ],
            })

            expect(mocks.addSignature).toHaveBeenCalledTimes(1)
            const [network, signRequestId, responses] =
                mocks.addSignature.mock.calls[0]
            expect(network).toBe('testnet')
            expect(signRequestId).toBe('sr-42')
            expect(responses).toEqual([
                {
                    address: 'A',
                    response: 'signed',
                    signatures: [['c2lnQTA=']],
                },
                {
                    address: 'B',
                    response: 'signed',
                    signatures: [['c2lnQjA=']],
                },
            ])
            expect(response).toEqual({ status: 'pending' })
        })

        test('writes the cosign response into the sign-request detail query cache', async () => {
            mocks.addSignature.mockResolvedValue(baseSignRequestResponse)
            const { result, queryClient } = renderTransportFns()
            const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

            await result.current.addSignatures({
                signRequestId: 'sr-99',
                signers: [{ address: 'A', signatures: ['c2lnQTA='] }],
            })

            expect(setQueryDataSpy).toHaveBeenCalledWith(
                [
                    'multisig',
                    'sign-request-detail',
                    {
                        network: 'testnet',
                        signRequestId: 'sr-99',
                    },
                ],
                // No prior cache + response omits proposer_address → null.
                // (The proposer-address-preserving path is exercised by the
                // dedicated test below.)
                { ...baseSignRequestResponse, proposer_address: null },
            )
        })

        test('preserves proposer_address from existing cache when the cosign response omits it', async () => {
            mocks.addSignature.mockResolvedValue(baseSignRequestResponse)
            const { result, queryClient } = renderTransportFns()
            // Seed the cache as if a previous propose call (or earlier
            // cosign) had populated proposer_address.
            queryClient.setQueryData(
                [
                    'multisig',
                    'sign-request-detail',
                    { network: 'testnet', signRequestId: 'sr-99' },
                ],
                {
                    ...baseSignRequestResponse,
                    proposer_address: 'PROPOSER_FROM_EARLIER_CALL',
                },
            )
            const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

            await result.current.addSignatures({
                signRequestId: 'sr-99',
                signers: [{ address: 'A', signatures: ['c2lnQTA='] }],
            })

            expect(setQueryDataSpy).toHaveBeenCalledWith(
                [
                    'multisig',
                    'sign-request-detail',
                    { network: 'testnet', signRequestId: 'sr-99' },
                ],
                {
                    ...baseSignRequestResponse,
                    proposer_address: 'PROPOSER_FROM_EARLIER_CALL',
                },
            )
        })

        test('propagates errors from the endpoint', async () => {
            mocks.addSignature.mockRejectedValue(new Error('backend down'))
            const { result } = renderTransportFns()

            await expect(
                result.current.addSignatures({
                    signRequestId: 'sr-x',
                    signers: [{ address: 'A', signatures: ['x'] }],
                }),
            ).rejects.toThrow('backend down')
        })
    })

    describe('addSignatures draft bootstrap', () => {
        const createDraft = (proposeType: 'sync' | 'async' = 'sync') =>
            useDraftSignRequestStore.getState().createDraft({
                network: 'testnet',
                multisigAddress: 'MSIG',
                multisigDetails: {
                    threshold: 2,
                    version: 1,
                    participantAddresses: ['A', 'B'],
                },
                rawTransactionsBase64: ['cmF3MQ=='],
                proposeType,
            })

        beforeEach(() => {
            useDraftSignRequestStore.getState().resetState()
            walletConnectHandoffs.__resetForTests()
            draftProposeContexts.__resetForTests()
        })

        test('registers the sync handoff under the real id and fires onProposed', async () => {
            const draftId = createDraft('sync')
            const approveSignedBytes = vi.fn()
            const error = vi.fn()
            const reject = vi.fn()
            const onProposed = vi.fn().mockResolvedValue(undefined)
            const handoffDelivery = {
                clientId: 'client-1',
                payloadId: 7,
                indicesToSign: [0],
                totalLength: 1,
            }
            draftProposeContexts.set(draftId, {
                source: {
                    type: 'walletconnect',
                    callbacks: {
                        approveSignedBytes,
                        error,
                        reject,
                        onProposed,
                    },
                    handoffDelivery,
                },
                msigMetadata: {
                    version: 1,
                    threshold: 2,
                    addresses: ['A', 'B'],
                },
                deviceId: 'device-from-draft',
            })
            mocks.proposeSignRequest.mockResolvedValue({
                ...baseSignRequestResponse,
                id: 'sr-real',
                type: 'sync',
            })
            const { result } = renderTransportFns()

            const response = await result.current.addSignatures({
                signRequestId: draftId,
                signers: [{ address: 'A', signatures: ['c2lnQTA='] }],
            })

            expect(response).toEqual({
                status: 'pending',
                resolvedSignRequestId: 'sr-real',
            })
            const handoff = walletConnectHandoffs.get('sr-real')
            expect(handoff).toBeDefined()
            expect(handoff?.multisigAddress).toBe('MSIG')
            expect(handoff?.msigMetadata).toEqual({
                version: 1,
                threshold: 2,
                addresses: ['A', 'B'],
            })
            expect(handoff?.expectedRawTransactionsBase64).toEqual(['cmF3MQ=='])
            // The hook's live device id wins; the stashed one is the fallback.
            expect(handoff?.deviceId).toBe('device-1')
            expect(handoff?.network).toBe('testnet')
            expect(handoff?.sourceType).toBe('walletconnect')
            expect(handoff?.proposerAddress).toBe('A')
            expect(handoff?.callbacks?.approveSignedBytes).toBe(
                approveSignedBytes,
            )
            expect(handoff?.callbacks?.error).toBe(error)
            expect(handoff?.callbacks?.reject).toBe(reject)
            expect(handoff?.recovery).toEqual(handoffDelivery)
            expect(onProposed).toHaveBeenCalledWith({
                signRequestId: 'sr-real',
                status: 'pending',
                rawTransactionsBase64: ['cmF3MQ=='],
            })
            // Consumed: a later cosign on the real id must not re-register.
            expect(draftProposeContexts.get(draftId)).toBeUndefined()
        })

        test('local-source draft fires onProposed without registering a handoff', async () => {
            const draftId = createDraft('sync')
            const onProposed = vi.fn().mockResolvedValue(undefined)
            draftProposeContexts.set(draftId, {
                source: { type: 'local', callbacks: { onProposed } },
            })
            mocks.proposeSignRequest.mockResolvedValue({
                ...baseSignRequestResponse,
                id: 'sr-swap',
                type: 'sync',
            })
            const { result } = renderTransportFns()

            await result.current.addSignatures({
                signRequestId: draftId,
                signers: [{ address: 'A', signatures: ['c2lnQTA='] }],
            })

            // Local sync proposes (shared-account swaps) run their own
            // resolver keyed off onProposed; there is no external peer.
            expect(walletConnectHandoffs.list()).toEqual([])
            expect(onProposed).toHaveBeenCalledWith({
                signRequestId: 'sr-swap',
                status: 'pending',
                rawTransactionsBase64: ['cmF3MQ=='],
            })
        })

        test('keeps the context when the bootstrap propose fails so a retry can still deliver', async () => {
            const draftId = createDraft('sync')
            const onProposed = vi.fn()
            draftProposeContexts.set(draftId, {
                source: { type: 'walletconnect', callbacks: { onProposed } },
                msigMetadata: {
                    version: 1,
                    threshold: 2,
                    addresses: ['A', 'B'],
                },
                deviceId: 'device-from-draft',
            })
            mocks.proposeSignRequest.mockRejectedValue(
                new Error('backend down'),
            )
            const { result } = renderTransportFns()

            await expect(
                result.current.addSignatures({
                    signRequestId: draftId,
                    signers: [{ address: 'A', signatures: ['c2lnQTA='] }],
                }),
            ).rejects.toThrow('backend down')

            expect(walletConnectHandoffs.list()).toEqual([])
            expect(onProposed).not.toHaveBeenCalled()
            expect(draftProposeContexts.get(draftId)).toBeDefined()
        })

        test('a failing onProposed does not fail the already-succeeded bootstrap', async () => {
            const draftId = createDraft('sync')
            const onProposed = vi
                .fn()
                .mockRejectedValue(new Error('listener died'))
            draftProposeContexts.set(draftId, {
                source: { type: 'local', callbacks: { onProposed } },
            })
            mocks.proposeSignRequest.mockResolvedValue({
                ...baseSignRequestResponse,
                id: 'sr-real',
                type: 'sync',
            })
            const { result } = renderTransportFns()

            const response = await result.current.addSignatures({
                signRequestId: draftId,
                signers: [{ address: 'A', signatures: ['c2lnQTA='] }],
            })

            expect(response).toEqual({
                status: 'pending',
                resolvedSignRequestId: 'sr-real',
            })
        })
    })
})
