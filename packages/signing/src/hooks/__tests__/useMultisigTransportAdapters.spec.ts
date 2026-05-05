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

import React from 'react'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { proposeSignRequestSchema } from '@perawallet/wallet-core-multisig'
import { useMultisigTransportAdapters } from '../useMultisigTransportAdapters'
import type { SigningResult } from '../../pipeline/types'

const mocks = vi.hoisted(() => ({
    proposeSignRequest: vi.fn(),
    addSignature: vi.fn(),
    useNetwork: vi.fn(),
    encodeTransaction: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => mocks.useNetwork(),
    useTransactionEncoder: () => ({
        encodeTransaction: mocks.encodeTransaction,
    }),
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
            { txn: { tag: 'TXN_1' } as any, sig: new Uint8Array([1]) },
            { txn: { tag: 'TXN_2' } as any, sig: new Uint8Array([2]) },
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
        // Encode each txn to a deterministic, distinguishable byte sequence
        mocks.encodeTransaction.mockImplementation(
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
                    signed: [
                        {
                            txn: { tag: 'TXN_1' } as any,
                            sig: new Uint8Array([1]),
                        },
                    ],
                },
                signers: [
                    { address: 'PARTICIPANT_A', signatures: ['c2lnQTA='] },
                ],
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
            })

            const [, params] = mocks.proposeSignRequest.mock.calls[0]
            expect(() => proposeSignRequestSchema.parse(params)).not.toThrow()
        })

        test('cosign failure for one signer does not fail the whole flow', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            mocks.addSignature.mockRejectedValue(new Error('flaky cosign'))
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})
            const { result } = renderTransportFns()
            const { signedData, signers } = buildTxnSigningResult()

            const response = await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData,
                signers,
            })

            // Propose succeeded; status falls back to propose's status when cosigns fail
            expect(response).toEqual({
                signRequestId: 'sr-1',
                status: 'pending',
            })
            expect(consoleSpy).toHaveBeenCalled()
            consoleSpy.mockRestore()
        })

        test('invalidates the detail query when there are cosigners', async () => {
            mocks.proposeSignRequest.mockResolvedValue(baseSignRequestResponse)
            mocks.addSignature.mockResolvedValue(baseSignRequestResponse)
            const { result, queryClient } = renderTransportFns()
            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
            const { signedData, signers } = buildTxnSigningResult()

            await result.current.proposeSignRequest({
                multisigAddress: 'MSIG',
                signedData,
                signers,
            })

            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: [
                    'multisig',
                    'sign-request-detail',
                    { network: 'testnet', signRequestId: 'sr-1' },
                ],
            })
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
                    signed: [{ txn: { tag: 'TXN_1' } as any }],
                },
                signers: [{ address: 'A' /* no signatures field */ }],
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

        test('invalidates the sign-request detail query after success', async () => {
            mocks.addSignature.mockResolvedValue(baseSignRequestResponse)
            const { result, queryClient } = renderTransportFns()
            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

            await result.current.addSignatures({
                signRequestId: 'sr-99',
                signers: [{ address: 'A', signatures: ['c2lnQTA='] }],
            })

            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: [
                    'multisig',
                    'sign-request-detail',
                    {
                        network: 'testnet',
                        signRequestId: 'sr-99',
                    },
                ],
            })
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
})
