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
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    MultisigSignRequest,
    SignRequestStatus,
} from '@perawallet/wallet-core-multisig'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import type { Optional } from '@perawallet/wallet-core-shared'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'

const ETHEREUM_CHAIN_ID: ChainId = 'ethereum'

const useAllAccountsMock = vi.fn<() => WalletAccount[]>()
vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        useAllAccounts: () => useAllAccountsMock(),
    }
})

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    useSelectedScope: (chainId: ChainId) => ({ chainId, networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeploymentDeviceID: () => 'device-123',
}))

const declineMutationParamsMock = vi.fn()
const declineMutateAsyncMock = vi.fn()
const declineIsPendingMock = vi.fn(() => false)
vi.mock('@perawallet/wallet-core-multisig', () => ({
    ACTIONABLE_SIGN_REQUEST_STATUSES: new Set(['pending', 'ready']),
    useDeclineSignRequestMutation: (params: unknown) => {
        declineMutationParamsMock(params)
        return {
            mutateAsync: declineMutateAsyncMock,
            get isPending() {
                return declineIsPendingMock()
            },
        }
    },
}))

const rejectRequestMock = vi.fn()
vi.mock('@perawallet/wallet-core-signing', () => ({
    chainIdOfSignRequest: (request: { chainId: string }) => request.chainId,
    scopeOfSignRequest: (request: { txs: { scope: ChainScope }[] }) =>
        request.txs[0]?.scope,
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

vi.mock('@modules/signing', async () => ({
    useSignRequestScope: (
        await import('@modules/signing/hooks/useSignRequestScope')
    ).useSignRequestScope,
}))

import { useMultisigSignRequestDecline } from '../useMultisigSignRequestDecline'

const PROPOSER = 'PROPOSER_ADDRESS'
const OTHER = 'OTHER_ADDRESS'
const SIGNER = 'SIGNER_ADDRESS'

const buildAccount = (
    address: string,
    chainId: ChainId = 'algorand',
): WalletAccount => ({
    id: `algo25-${address}`,
    custody: { kind: 'local', seed: null },
    chains: { [chainId]: { address: address, keyPairId: `kp-${address}` } },
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
    chainId: ChainId = 'algorand',
    networkId = 'mainnet',
): SignRequest =>
    ({
        id: 'local-req-1',
        chainId,
        type: 'transactions',
        transport: 'network',
        signRequestId,
        txs: [{ scope: { chainId, networkId }, payload: {} }],
    }) as unknown as SignRequest

describe('useMultisigSignRequestDecline', () => {
    beforeEach(() => {
        declineMutationParamsMock.mockReset()
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                    chainId: 'algorand',
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
                transport: 'network',
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
    describe('chain resolution', () => {
        it('declines on the sign request chain, Algorand', () => {
            renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest('sr-1'),
                    signerAddress: SIGNER,
                }),
            )

            expect(declineMutationParamsMock).toHaveBeenCalledWith({
                scope: expect.objectContaining({ chainId: 'algorand' }),
                signRequestId: 'sr-1',
            })
        })

        it('declines on the sign request chain, Ethereum', () => {
            renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest('sr-1', ETHEREUM_CHAIN_ID),
                    signerAddress: SIGNER,
                }),
            )

            expect(declineMutationParamsMock).toHaveBeenCalledWith({
                scope: expect.objectContaining({ chainId: ETHEREUM_CHAIN_ID }),
                signRequestId: 'sr-1',
            })
        })

        it("declines on the request's own network when the selected network differs", () => {
            renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'decline',
                    request: buildSignRequest('sr-1', 'algorand', 'testnet'),
                    signerAddress: SIGNER,
                }),
            )

            expect(declineMutationParamsMock).toHaveBeenCalledWith({
                scope: { chainId: 'algorand', networkId: 'testnet' },
                signRequestId: 'sr-1',
            })
        })

        it('cancels on the passed chain and finds the proposer there only', () => {
            useAllAccountsMock.mockReturnValue([buildAccount(PROPOSER)])

            const { result: onEthereum } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    chainId: ETHEREUM_CHAIN_ID,
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            expect(declineMutationParamsMock).toHaveBeenCalledWith({
                scope: expect.objectContaining({ chainId: ETHEREUM_CHAIN_ID }),
                signRequestId: 'sr-1',
            })
            expect(onEthereum.current.canPerform).toBe(false)
        })

        it('lets an Ethereum proposer cancel on Ethereum', () => {
            useAllAccountsMock.mockReturnValue([
                buildAccount(PROPOSER, ETHEREUM_CHAIN_ID),
            ])

            const { result } = renderHook(() =>
                useMultisigSignRequestDecline({
                    mode: 'cancel',
                    chainId: ETHEREUM_CHAIN_ID,
                    signRequest: buildMultisigSignRequest(),
                }),
            )

            expect(result.current.canPerform).toBe(true)
        })
    })
})
