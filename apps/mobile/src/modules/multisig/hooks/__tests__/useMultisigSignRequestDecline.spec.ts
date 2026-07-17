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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    MultisigSignRequest,
    SignRequestStatus,
} from '@perawallet/wallet-core-multisig'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'

const useAllAccountsMock = vi.fn<() => WalletAccount[]>()
vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        useAllAccounts: () => useAllAccountsMock(),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    useNetwork: () => ({ network: 'testnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-123',
}))

const declineMutateAsyncMock = vi.fn()
const declineIsPendingMock = vi.fn(() => false)
vi.mock('@perawallet/wallet-core-multisig', () => ({
    ACTIONABLE_SIGN_REQUEST_STATUSES: new Set(['pending', 'ready']),
    useDeclineSignRequestMutation: () => ({
        mutateAsync: declineMutateAsyncMock,
        get isPending() {
            return declineIsPendingMock()
        },
    }),
}))

const rejectRequestMock = vi.fn()
vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({
        rejectRequest: rejectRequestMock,
    }),
}))

const errorToastMock = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: errorToastMock }),
}))

const invalidateInboxMock = vi.fn()
vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({ invalidate: invalidateInboxMock }),
}))

import { useMultisigSignRequestDecline } from '../useMultisigSignRequestDecline'

const PROPOSER = 'PROPOSER_ADDRESS'
const OTHER = 'OTHER_ADDRESS'
const SIGNER = 'SIGNER_ADDRESS'

const buildAccount = (address: string): WalletAccount => ({
    id: `algo25-${address}`,
    type: AccountTypes.algo25,
    address,
    keyPairId: `kp-${address}`,
})

const buildMultisigSignRequest = (
    overrides: Partial<MultisigSignRequest> = {},
): MultisigSignRequest => ({
    id: 'sr-1',
    status: 'pending' as SignRequestStatus,
    type: 'async',
    createdAt: new Date('2026-05-06T09:00:00Z'),
    expectedExpireDatetime: new Date('2026-05-06T11:00:00Z'),
    failReasonDisplay: null,
    proposerAddress: PROPOSER,
    multisigAccount: {
        customId: 'm-1',
        createdAt: new Date('2026-05-06T09:00:00Z'),
        address: 'MULTISIG',
        version: 1,
        threshold: 2,
        participantAddresses: [PROPOSER, OTHER],
    },
    transactionLists: [
        {
            id: 'tl-1',
            rawTransactions: ['dHgx'],
            firstValidBlock: 1,
            lastValidBlock: 1000,
            expectedExpireDatetime: new Date('2026-05-06T11:00:00Z'),
            responses: [],
        },
    ],
    ...overrides,
})

const buildSignRequest = (
    signRequestId: Optional<string> = 'sr-1',
): SignRequest =>
    ({
        id: 'local-req-1',
        type: 'transactions',
        transport: 'algod',
        signRequestId,
        txs: [],
    }) as unknown as SignRequest

describe('useMultisigSignRequestDecline', () => {
    beforeEach(() => {
        declineMutateAsyncMock.mockReset().mockResolvedValue(undefined)
        declineIsPendingMock.mockReset().mockReturnValue(false)
        errorToastMock.mockReset()
        useAllAccountsMock.mockReset().mockReturnValue([])
        rejectRequestMock.mockReset()
        invalidateInboxMock.mockReset()
    })

    describe('mode: cancel', () => {
        it('returns canPerform=false when signRequest is null', () => {
            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: null,
                }),
            )

            expect(result.current.canPerform).toBe(false)
        })

        it('returns canPerform=false when status is finalized', () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest({
                        status: 'confirmed',
                    }),
                }),
            )

            expect(result.current.canPerform).toBe(false)
        })

        it('returns canPerform=false when proposerAddress is not local', () => {
            useAllAccountsMock.mockReturnValue([buildAccount(OTHER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            expect(result.current.canPerform).toBe(false)
        })

        it('returns canPerform=true even after the proposer has already signed — the proposer can still cancel until the request is finalized', () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest({
                        transactionLists: [
                            {
                                id: 'tl-1',
                                rawTransactions: ['dHgx'],
                                firstValidBlock: 1,
                                lastValidBlock: 1000,
                                expectedExpireDatetime: new Date(
                                    '2026-05-06T11:00:00Z',
                                ),
                                responses: [
                                    { address: PROPOSER, response: 'signed' },
                                ],
                            },
                        ],
                    }),
                }),
            )

            expect(result.current.canPerform).toBe(true)
        })

        it('returns canPerform=true when proposer is local, status is pending, and proposer has not responded', () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            expect(result.current.canPerform).toBe(true)
        })

        it('opens and closes the confirmation', () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            expect(result.current.isConfirmOpen).toBe(false)
            act(() => result.current.openConfirm())
            expect(result.current.isConfirmOpen).toBe(true)
            act(() => result.current.closeConfirm())
            expect(result.current.isConfirmOpen).toBe(false)
        })

        it('calls the decline mutation with the proposer address on confirm', async () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(declineMutateAsyncMock).toHaveBeenCalledWith({
                address: PROPOSER,
                deviceId: 'device-123',
            })
        })

        it('does not call rejectRequest in cancel mode on success', async () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(rejectRequestMock).not.toHaveBeenCalled()
        })

        it('invalidates inbox queries on successful cancel', async () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
        })

        it('shows an error toast when the proposer is not resolvable', async () => {
            useAllAccountsMock.mockReturnValue([])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(declineMutateAsyncMock).not.toHaveBeenCalled()
            expect(errorToastMock).toHaveBeenCalledWith(
                'multisig.cancel_transaction.error.title',
                'multisig.cancel_transaction.error.body',
            )
        })

        it('shows an error toast when the mutation rejects', async () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])
            declineMutateAsyncMock.mockRejectedValueOnce(new Error('boom'))

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(errorToastMock).toHaveBeenCalledWith(
                'multisig.cancel_transaction.error.title',
                'multisig.cancel_transaction.error.body',
            )
            expect(invalidateInboxMock).not.toHaveBeenCalled()
        })
    })

    describe('mode: decline', () => {
        it('canPerform is always true', () => {
            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest(),
                    signerAddress: SIGNER,
                }),
            )

            expect(result.current.canPerform).toBe(true)
        })

        it('opens and closes the confirmation', () => {
            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest(),
                    signerAddress: SIGNER,
                }),
            )

            expect(result.current.isConfirmOpen).toBe(false)
            act(() => result.current.openConfirm())
            expect(result.current.isConfirmOpen).toBe(true)
            act(() => result.current.closeConfirm())
            expect(result.current.isConfirmOpen).toBe(false)
        })

        it('calls the decline mutation with the signer address on confirm', async () => {
            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest(),
                    signerAddress: SIGNER,
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(declineMutateAsyncMock).toHaveBeenCalledWith({
                address: SIGNER,
                deviceId: 'device-123',
            })
        })

        it('removes the local sign request from the signing store on success', async () => {
            const request = buildSignRequest()

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request,
                    signerAddress: SIGNER,
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(rejectRequestMock).toHaveBeenCalledWith(request)
        })

        it('invalidates inbox queries on successful decline', async () => {
            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest(),
                    signerAddress: SIGNER,
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
        })

        it('shows an error toast and skips the mutation when signRequestId is missing', async () => {
            const requestWithoutId = {
                id: 'local-req-1',
                type: 'transactions',
                transport: 'algod',
                txs: [],
            } as unknown as SignRequest

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: requestWithoutId,
                    signerAddress: SIGNER,
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(declineMutateAsyncMock).not.toHaveBeenCalled()
            expect(errorToastMock).toHaveBeenCalledWith(
                'multisig.decline.error.title',
                'multisig.decline.error.body',
            )
        })

        it('shows an error toast and skips the mutation when signerAddress is empty', async () => {
            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest(),
                    signerAddress: '',
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(declineMutateAsyncMock).not.toHaveBeenCalled()
            expect(errorToastMock).toHaveBeenCalledWith(
                'multisig.decline.error.title',
                'multisig.decline.error.body',
            )
        })

        it('shows an error toast when the mutation rejects', async () => {
            declineMutateAsyncMock.mockRejectedValueOnce(new Error('boom'))

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest(),
                    signerAddress: SIGNER,
                }),
            )

            await act(async () => {
                await result.current.handleConfirm()
            })

            expect(errorToastMock).toHaveBeenCalledWith(
                'multisig.decline.error.title',
                'multisig.decline.error.body',
            )
            expect(rejectRequestMock).not.toHaveBeenCalled()
            expect(invalidateInboxMock).not.toHaveBeenCalled()
        })
    })
})
