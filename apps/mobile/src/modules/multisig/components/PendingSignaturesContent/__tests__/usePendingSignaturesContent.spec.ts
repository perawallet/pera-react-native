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
import { act, renderHook } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    type MultisigSignRequest,
    type SignRequestStatus,
    useDraftSignRequestStore,
} from '@perawallet/wallet-core-multisig'
import type { Optional } from '@perawallet/wallet-core-shared'

const localUnsignedSignersMock = vi.fn<() => WalletAccount[]>(() => [])
const addSignRequestMock = vi.fn()
const cosignRequestStub = { id: 'cosign-1' }
const buildCosignArgsMock = vi.fn()

const { mockDismiss, mockRequestBottomSheet } = vi.hoisted(() => ({
    mockDismiss: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: vi.fn(), dismiss: mockDismiss }),
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    useTransactionEncoder: () => ({ decodeTransaction: vi.fn(() => ({})) }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: () => [],
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-id',
    DeviceAccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
        quantum: 'quantum',
    },
}))

const pendingSignRequestsMock = vi.fn<() => unknown[]>(() => [])
vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({
        addSignRequest: addSignRequestMock,
        pendingSignRequests: pendingSignRequestsMock(),
    }),
    isTransactionRequest: (request: { type?: string }) =>
        request?.type === 'transactions',
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: vi.fn() }),
}))

vi.mock('../../../utils/getLocalUnsignedSigners', () => ({
    getLocalUnsignedSigners: () => localUnsignedSignersMock(),
}))

vi.mock('../../../utils/buildMultisigCosignRequest', () => ({
    buildMultisigCosignRequest: (
        args: Parameters<typeof buildCosignArgsMock>[0],
    ) => {
        buildCosignArgsMock(args)
        return cosignRequestStub
    },
}))

const useSignRequestDetailQueryMock = vi.fn()
vi.mock('@perawallet/wallet-core-multisig', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-multisig')
        >()
    return {
        ...actual,
        useSignRequestDetailQuery: (...args: unknown[]) =>
            useSignRequestDetailQueryMock(...args),
        useDeclineSignRequestMutation: () => ({
            mutateAsync: vi.fn().mockResolvedValue(undefined),
            isPending: false,
        }),
    }
})

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({ invalidate: vi.fn() }),
}))

import {
    FAILED_RECOVERY_WINDOW_MS,
    usePendingSignaturesContent,
} from '../usePendingSignaturesContent'
import { usePendingSignaturesSheetStore } from '../../../stores/usePendingSignaturesSheetStore'

const buildSignRequest = (
    overrides: Partial<MultisigSignRequest> = {},
): MultisigSignRequest => ({
    id: 'sr-1',
    status: 'pending',
    type: 'async',
    createdAt: new Date('2026-05-06T09:00:00Z'),
    expectedExpireDatetime: new Date('2026-05-06T10:52:00Z'),
    failReasonDisplay: null,
    proposerAddress: null,
    multisigAccount: {
        customId: 'm-1',
        createdAt: new Date('2026-05-06T09:00:00Z'),
        address: 'MULTISIG',
        version: 1,
        threshold: 2,
        participantAddresses: ['A', 'B', 'C'],
    },
    transactionLists: [
        {
            id: 'tl-1',
            rawTransactions: ['raw'],
            firstValidBlock: 1,
            lastValidBlock: 1000,
            expectedExpireDatetime: new Date('2026-05-06T10:52:00Z'),
            responses: [
                { address: 'A', response: 'signed' },
                { address: 'B', response: 'declined' },
            ],
        },
    ],
    ...overrides,
})

const refetchMock = vi.fn()

const mockQueryReturn = (
    data: Optional<MultisigSignRequest>,
    { isError = false }: { isError?: boolean } = {},
) => {
    useSignRequestDetailQueryMock.mockReturnValue({
        data,
        isLoading: false,
        isError,
        refetch: refetchMock,
    })
}

const buildAccount = (address: string): WalletAccount => ({
    id: `algo25-${address}`,
    type: AccountTypes.algo25,
    address,
    keyPairId: `kp-${address}`,
})

describe('usePendingSignaturesContent', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-06T10:00:00Z'))
        usePendingSignaturesSheetStore.setState({ signRequestId: null })
        useSignRequestDetailQueryMock.mockReset()
        mockQueryReturn(undefined)
        localUnsignedSignersMock.mockReturnValue([])
        pendingSignRequestsMock.mockReturnValue([])
        addSignRequestMock.mockClear()
        buildCosignArgsMock.mockClear()
        mockDismiss.mockClear()
        refetchMock.mockClear()
    })

    it('derives signedCount, signer rows and waiting banner for a pending request', () => {
        usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
        mockQueryReturn(buildSignRequest())

        const { result } = renderHook(() => usePendingSignaturesContent())

        expect(result.current.bannerVariant).toBe('waiting')
        expect(result.current.signedCount).toBe(1)
        expect(result.current.threshold).toBe(2)
        expect(result.current.timeRemaining).toBe('52m')
        expect(result.current.signers).toEqual([
            {
                address: 'A',
                status: 'signed',
                canSignAsHardware: false,
                isSigning: false,
            },
            {
                address: 'B',
                status: 'declined',
                canSignAsHardware: false,
                isSigning: false,
            },
            {
                address: 'C',
                status: 'pending',
                canSignAsHardware: false,
                isSigning: false,
            },
        ])
    })

    it('shows success banner for confirmed status and hides time-remaining', () => {
        usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
        mockQueryReturn(buildSignRequest({ status: 'confirmed' }))

        const { result } = renderHook(() => usePendingSignaturesContent())

        expect(result.current.bannerVariant).toBe('success')
        expect(result.current.timeRemaining).toBeNull()
    })

    it.each<SignRequestStatus>(['expired', 'declined'])(
        'shows failure banner immediately for genuinely terminal %s status',
        status => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(
                buildSignRequest({
                    status,
                    failReasonDisplay: 'Insufficient balance',
                }),
            )

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.bannerVariant).toBe('failure')
            expect(result.current.failReason).toBe('Insufficient balance')
        },
    )

    describe('failed-status recovery window', () => {
        it('keeps the submitting banner when a request first becomes failed (transient backend false-negative)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'failed' }))

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.bannerVariant).toBe('submitting')
        })

        it('keeps polling on failed (pollWhileFailed) while still recovering', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'failed' }))

            renderHook(() => usePendingSignaturesContent())

            const lastCallArg =
                useSignRequestDetailQueryMock.mock.calls.at(-1)?.[0]
            expect(lastCallArg).toEqual(
                expect.objectContaining({ pollWhileFailed: true }),
            )
        })

        it('commits to the failure banner and stops polling once the recovery window elapses', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(
                buildSignRequest({
                    status: 'failed',
                    failReasonDisplay: 'Unkown exception happened',
                }),
            )

            const { result, rerender } = renderHook(() =>
                usePendingSignaturesContent(),
            )

            expect(result.current.bannerVariant).toBe('submitting')

            act(() => {
                vi.advanceTimersByTime(FAILED_RECOVERY_WINDOW_MS)
            })
            rerender()

            expect(result.current.bannerVariant).toBe('failure')
            expect(result.current.failReason).toBe('Unkown exception happened')
            const lastCallArg =
                useSignRequestDetailQueryMock.mock.calls.at(-1)?.[0]
            expect(lastCallArg).toEqual(
                expect.objectContaining({ pollWhileFailed: false }),
            )
        })

        it('recovers to the success banner if the request confirms within the window', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'failed' }))

            const { result, rerender } = renderHook(() =>
                usePendingSignaturesContent(),
            )

            expect(result.current.bannerVariant).toBe('submitting')

            // Next poll, still inside the window, returns confirmed.
            act(() => {
                vi.advanceTimersByTime(5000)
            })
            mockQueryReturn(buildSignRequest({ status: 'confirmed' }))
            rerender()

            expect(result.current.bannerVariant).toBe('success')
        })
    })

    it.each<[SignRequestStatus, string]>([
        ['expired', 'multisig.pending_signatures.canceled'],
        ['declined', 'multisig.pending_signatures.declined'],
        ['failed', 'multisig.pending_signatures.failed_default'],
    ])('returns the %s-specific failureBannerKey', (status, expectedKey) => {
        usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
        mockQueryReturn(buildSignRequest({ status }))

        const { result } = renderHook(() => usePendingSignaturesContent())

        expect(result.current.failureBannerKey).toBe(expectedKey)
    })

    it.each<SignRequestStatus>(['failed', 'expired', 'declined', 'confirmed'])(
        'emits "unsigned" instead of "pending" for un-responded participants when status is finalized (%s)',
        status => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status }))

            const { result } = renderHook(() => usePendingSignaturesContent())

            // C never responded; default test fixture has A signed, B declined
            const c = result.current.signers.find(s => s.address === 'C')
            expect(c?.status).toBe('unsigned')
        },
    )

    it('still emits "pending" for un-responded participants while waiting', () => {
        usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
        mockQueryReturn(buildSignRequest({ status: 'pending' }))

        const { result } = renderHook(() => usePendingSignaturesContent())

        const c = result.current.signers.find(s => s.address === 'C')
        expect(c?.status).toBe('pending')
    })

    describe('load error (request cannot be fetched)', () => {
        it('flags hasLoadError when the query errors before any data arrives', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(undefined, { isError: true })

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.hasLoadError).toBe(true)
        })

        it('does not flag hasLoadError while still loading without an error', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(undefined)

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.hasLoadError).toBe(false)
        })

        it('keeps showing loaded data when a later poll errors (no error state over stale data)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest(), { isError: true })

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.hasLoadError).toBe(false)
            expect(result.current.signRequest).not.toBeNull()
        })

        it('handleRetryLoad refetches the sign request', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(undefined, { isError: true })

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleRetryLoad()

            expect(refetchMock).toHaveBeenCalledTimes(1)
        })
    })

    it('handleClose clears the signRequestId in the store and dismisses the sheet', () => {
        usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
        mockQueryReturn(buildSignRequest())

        const { result } = renderHook(() => usePendingSignaturesContent())

        result.current.handleClose()

        expect(
            usePendingSignaturesSheetStore.getState().signRequestId,
        ).toBeNull()
        expect(mockDismiss).toHaveBeenCalledTimes(1)
    })

    describe('canSign', () => {
        it('is true when status is pending and there are local unsigned signers', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(true)
        })

        it('is true when status is ready and there are local unsigned signers', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'ready' }))
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(true)
        })

        it('is false when status is submitting (waiting but not actionable)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'submitting' }))
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(false)
        })

        it.each<SignRequestStatus>([
            'confirmed',
            'failed',
            'expired',
            'declined',
        ])('is false when status is %s (finalized)', status => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status }))
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(false)
        })

        it('is false when there are no local unsigned signers', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(false)
        })

        it('is false when signRequest data has not loaded yet', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(undefined)
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(false)
        })
    })

    describe('handleSign', () => {
        it('dispatches a cosign for every local-key unsigned signer (in order) when the whole batch is still needed, keeping the sheet open', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            // threshold 3 with one signed → two more signatures needed, so both
            // local participants are dispatched.
            mockQueryReturn(
                buildSignRequest({
                    status: 'pending',
                    multisigAccount: {
                        customId: 'm-1',
                        createdAt: new Date('2026-05-06T09:00:00Z'),
                        address: 'MULTISIG',
                        version: 1,
                        threshold: 3,
                        participantAddresses: ['A', 'B', 'C', 'D'],
                    },
                }),
            )
            localUnsignedSignersMock.mockReturnValue([
                buildAccount('A'),
                buildAccount('B'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(buildCosignArgsMock).toHaveBeenCalledTimes(2)
            expect(
                (
                    buildCosignArgsMock.mock.calls[0]![0] as {
                        signerAddress: string
                    }
                ).signerAddress,
            ).toBe('A')
            expect(
                (
                    buildCosignArgsMock.mock.calls[1]![0] as {
                        signerAddress: string
                    }
                ).signerAddress,
            ).toBe('B')
            expect(addSignRequestMock).toHaveBeenCalledTimes(2)
            expect(
                usePendingSignaturesSheetStore.getState().signRequestId,
            ).toBe('sr-1')
            expect(mockDismiss).not.toHaveBeenCalled()
        })

        it('caps the batch at the signatures still needed (threshold − signedCount)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            // Default fixture: threshold 2, one already signed → only one more
            // signature is needed, so the second local signer is NOT dispatched.
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildAccount('A'),
                buildAccount('B'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(buildCosignArgsMock).toHaveBeenCalledTimes(1)
            expect(
                (
                    buildCosignArgsMock.mock.calls[0]![0] as {
                        signerAddress: string
                    }
                ).signerAddress,
            ).toBe('A')
            expect(addSignRequestMock).toHaveBeenCalledTimes(1)
        })

        it('skips a signer already in flight and does not re-dispatch it', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(
                buildSignRequest({
                    status: 'pending',
                    multisigAccount: {
                        customId: 'm-1',
                        createdAt: new Date('2026-05-06T09:00:00Z'),
                        address: 'MULTISIG',
                        version: 1,
                        threshold: 3,
                        participantAddresses: ['A', 'B', 'C', 'D'],
                    },
                }),
            )
            localUnsignedSignersMock.mockReturnValue([
                buildAccount('A'),
                buildAccount('B'),
            ])
            // A is already mid-cosign in the queue.
            pendingSignRequestsMock.mockReturnValue([
                {
                    type: 'transactions',
                    sourceType: 'multisig-cosign',
                    signRequestId: 'sr-1',
                    signerOverrides: new Map([[0, 'A']]),
                },
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(buildCosignArgsMock).toHaveBeenCalledTimes(1)
            expect(
                (
                    buildCosignArgsMock.mock.calls[0]![0] as {
                        signerAddress: string
                    }
                ).signerAddress,
            ).toBe('B')
        })

        it('is a no-op once enough signatures are signed or in flight (a repeated Sign does not stack sheets)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            // Default fixture needs one more signature; A is already in flight,
            // so a second press has nothing left to dispatch.
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildAccount('A'),
                buildAccount('B'),
            ])
            pendingSignRequestsMock.mockReturnValue([
                {
                    type: 'transactions',
                    sourceType: 'multisig-cosign',
                    signRequestId: 'sr-1',
                    signerOverrides: new Map([[0, 'A']]),
                },
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })

        it('iterates only local-key signers and skips hardware participants (those use per-row Sign)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildAccount('A'),
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(buildCosignArgsMock).toHaveBeenCalledTimes(1)
            expect(
                (
                    buildCosignArgsMock.mock.calls[0]![0] as {
                        signerAddress: string
                    }
                ).signerAddress,
            ).toBe('A')
            expect(addSignRequestMock).toHaveBeenCalledTimes(1)
        })

        it('does nothing when there is no signRequest', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(undefined)
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })

        it('does nothing when there are no local-key unsigned signers (only hardware)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })

        it('does nothing when there are no unsigned signers', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSign()

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })
    })

    describe('canSign (footer Sign button gating)', () => {
        it('is false when only hardware participants are unsigned (per-row Sign covers Ledger)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(false)
        })

        it('is true when at least one local-key signer is unsigned, even alongside hardware', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildAccount('A'),
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.canSign).toBe(true)
        })
    })

    describe('handleSignParticipant (per-row Sign for hardware)', () => {
        it('dispatches a single cosign SignRequest for the given hardware address and keeps the sheet open', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSignParticipant('L')

            expect(buildCosignArgsMock).toHaveBeenCalledTimes(1)
            expect(
                (
                    buildCosignArgsMock.mock.calls[0]![0] as {
                        signerAddress: string
                    }
                ).signerAddress,
            ).toBe('L')
            expect(addSignRequestMock).toHaveBeenCalledTimes(1)
            expect(addSignRequestMock).toHaveBeenCalledWith(cosignRequestStub)
            expect(
                usePendingSignaturesSheetStore.getState().signRequestId,
            ).toBe('sr-1')
        })

        it('is a no-op when the address is not in hardwareUnsignedSigners', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            // Only a local-key signer; the address is a local-key one, not hardware.
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSignParticipant('A')

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })

        it('is a no-op when the address is already in flight via the signing queue', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L'),
            ])
            pendingSignRequestsMock.mockReturnValue([
                {
                    type: 'transactions',
                    sourceType: 'multisig-cosign',
                    signRequestId: 'sr-1',
                    signerOverrides: new Map([[0, 'L']]),
                },
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSignParticipant('L')

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })

        it('is a no-op when there is no signRequest', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(undefined)
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSignParticipant('L')

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })

        it('is a no-op when status is not actionable', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'submitting' }))
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSignParticipant('L')

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })
    })

    describe('signers per-row hardware flags', () => {
        it('exposes canSignAsHardware on the hardware participant row when actionable and not in flight', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(
                buildSignRequest({
                    status: 'pending',
                    multisigAccount: {
                        customId: 'm-1',
                        createdAt: new Date('2026-05-06T09:00:00Z'),
                        address: 'MULTISIG',
                        version: 1,
                        threshold: 2,
                        participantAddresses: ['A', 'L', 'C'],
                    },
                    transactionLists: [
                        {
                            id: 'tl-1',
                            rawTransactions: ['raw'],
                            firstValidBlock: 1,
                            lastValidBlock: 1000,
                            expectedExpireDatetime: new Date(
                                '2026-05-06T10:52:00Z',
                            ),
                            responses: [{ address: 'A', response: 'signed' }],
                        },
                    ],
                }),
            )
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())

            const ledgerRow = result.current.signers.find(
                s => s.address === 'L',
            )
            expect(ledgerRow).toMatchObject({
                address: 'L',
                status: 'pending',
                canSignAsHardware: true,
                isSigning: false,
            })
        })

        it('flips isSigning true while keeping canSignAsHardware true (capability is independent of liveness; consumer combines them)', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('C'),
            ])
            pendingSignRequestsMock.mockReturnValue([
                {
                    type: 'transactions',
                    sourceType: 'multisig-cosign',
                    signRequestId: 'sr-1',
                    signerOverrides: new Map([[0, 'C']]),
                },
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())

            const row = result.current.signers.find(s => s.address === 'C')
            expect(row?.isSigning).toBe(true)
            expect(row?.canSignAsHardware).toBe(true)
        })

        it('ignores cosign requests targeting a different multisig sign request', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('C'),
            ])
            pendingSignRequestsMock.mockReturnValue([
                {
                    type: 'transactions',
                    sourceType: 'multisig-cosign',
                    signRequestId: 'sr-OTHER',
                    signerOverrides: new Map([[0, 'C']]),
                },
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())

            const row = result.current.signers.find(s => s.address === 'C')
            expect(row?.isSigning).toBe(false)
            expect(row?.canSignAsHardware).toBe(true)
        })
    })

    describe('draft mode (deferred propose)', () => {
        const DRAFT_ID = 'draft-test-1'

        const seedDraft = () => {
            useDraftSignRequestStore.setState({
                drafts: {
                    [DRAFT_ID]: {
                        localId: DRAFT_ID,
                        network: 'mainnet',
                        multisigAddress: 'DRAFT_MULTISIG',
                        multisigDetails: {
                            threshold: 2,
                            version: 1,
                            participantAddresses: ['L1', 'L2', 'C'],
                        },
                        rawTransactionsBase64: ['rawDraftTxn'],
                        proposeType: 'async',
                        createdAt: new Date('2026-05-06T09:00:00Z'),
                    },
                },
            })
        }

        beforeEach(() => {
            useDraftSignRequestStore.getState().resetState()
        })

        it('synthesizes a sign-request from the draft store when the sheet id is a draft prefix', () => {
            usePendingSignaturesSheetStore.setState({
                signRequestId: DRAFT_ID,
            })
            seedDraft()
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L1'),
                buildHardwareAccount('L2'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.isDraft).toBe(true)
            expect(result.current.signRequest?.id).toBe(DRAFT_ID)
            expect(result.current.signRequest?.multisigAccount.address).toBe(
                'DRAFT_MULTISIG',
            )
            expect(
                result.current.signRequest?.multisigAccount
                    .participantAddresses,
            ).toEqual(['L1', 'L2', 'C'])
            // No responses yet — all participants render as pending.
            expect(result.current.signers.map(s => s.status)).toEqual([
                'pending',
                'pending',
                'pending',
            ])
            // Hardware rows expose canSignAsHardware so per-row Sign appears.
            expect(
                result.current.signers.find(s => s.address === 'L1')
                    ?.canSignAsHardware,
            ).toBe(true)
            expect(
                result.current.signers.find(s => s.address === 'L2')
                    ?.canSignAsHardware,
            ).toBe(true)
            // Backend API query stays disabled in draft mode — no network call
            // is made for a sign-request that doesn't exist yet.
            expect(useSignRequestDetailQueryMock).toHaveBeenCalledWith(
                expect.objectContaining({ enabled: false }),
            )
        })

        it('returns null signRequest when the sheet points at a draft id that no longer exists (e.g. already swapped or cleared)', () => {
            usePendingSignaturesSheetStore.setState({
                signRequestId: DRAFT_ID,
            })
            // Don't seed the draft.

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.isDraft).toBe(true)
            expect(result.current.signRequest).toBeNull()
        })

        it('hides the time-remaining badge in draft mode (no on-chain expiry yet)', () => {
            usePendingSignaturesSheetStore.setState({
                signRequestId: DRAFT_ID,
            })
            seedDraft()

            const { result } = renderHook(() => usePendingSignaturesContent())

            expect(result.current.timeRemaining).toBeNull()
        })

        it('handleSignParticipant dispatches a cosign pinned to the chosen Ledger row using the synthetic draft sign-request', () => {
            usePendingSignaturesSheetStore.setState({
                signRequestId: DRAFT_ID,
            })
            seedDraft()
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L1'),
                buildHardwareAccount('L2'),
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSignParticipant('L1')

            expect(buildCosignArgsMock).toHaveBeenCalledTimes(1)
            const call = buildCosignArgsMock.mock.calls[0]![0] as {
                signRequest: { id: string }
                signerAddress: string
            }
            expect(call.signRequest.id).toBe(DRAFT_ID)
            expect(call.signerAddress).toBe('L1')
            expect(addSignRequestMock).toHaveBeenCalledTimes(1)
        })

        it('blocks a second per-row Sign while another draft cosign is in flight (prevents double-propose race)', () => {
            usePendingSignaturesSheetStore.setState({
                signRequestId: DRAFT_ID,
            })
            seedDraft()
            localUnsignedSignersMock.mockReturnValue([
                buildHardwareAccount('L1'),
                buildHardwareAccount('L2'),
            ])
            // L1 is already mid-flight (its actor is in pendingSignRequests).
            pendingSignRequestsMock.mockReturnValue([
                {
                    type: 'transactions',
                    sourceType: 'multisig-cosign',
                    signRequestId: DRAFT_ID,
                    signerOverrides: new Map([[0, 'L1']]),
                },
            ])

            const { result } = renderHook(() => usePendingSignaturesContent())
            result.current.handleSignParticipant('L2')

            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
        })

        describe('disableOtherSignersForDraft', () => {
            it('is true in draft mode while a cosign is in flight', () => {
                usePendingSignaturesSheetStore.setState({
                    signRequestId: DRAFT_ID,
                })
                seedDraft()
                localUnsignedSignersMock.mockReturnValue([
                    buildHardwareAccount('L1'),
                    buildHardwareAccount('L2'),
                ])
                pendingSignRequestsMock.mockReturnValue([
                    {
                        type: 'transactions',
                        sourceType: 'multisig-cosign',
                        signRequestId: DRAFT_ID,
                        signerOverrides: new Map([[0, 'L1']]),
                    },
                ])

                const { result } = renderHook(() =>
                    usePendingSignaturesContent(),
                )

                expect(result.current.disableOtherSignersForDraft).toBe(true)
            })

            it('is false in draft mode while no cosign is in flight', () => {
                usePendingSignaturesSheetStore.setState({
                    signRequestId: DRAFT_ID,
                })
                seedDraft()
                localUnsignedSignersMock.mockReturnValue([
                    buildHardwareAccount('L1'),
                    buildHardwareAccount('L2'),
                ])

                const { result } = renderHook(() =>
                    usePendingSignaturesContent(),
                )

                expect(result.current.disableOtherSignersForDraft).toBe(false)
            })

            it('is false outside draft mode even when a cosign is in flight (real backend record means propose has already landed)', () => {
                usePendingSignaturesSheetStore.setState({
                    signRequestId: 'sr-1',
                })
                mockQueryReturn(buildSignRequest({ status: 'pending' }))
                localUnsignedSignersMock.mockReturnValue([
                    buildHardwareAccount('C'),
                ])
                pendingSignRequestsMock.mockReturnValue([
                    {
                        type: 'transactions',
                        sourceType: 'multisig-cosign',
                        signRequestId: 'sr-1',
                        signerOverrides: new Map([[0, 'C']]),
                    },
                ])

                const { result } = renderHook(() =>
                    usePendingSignaturesContent(),
                )

                expect(result.current.disableOtherSignersForDraft).toBe(false)
            })
        })
    })
})

const buildHardwareAccount = (address: string): WalletAccount => ({
    id: `hardware-${address}`,
    type: AccountTypes.hardware,
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'dev-1',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
})
