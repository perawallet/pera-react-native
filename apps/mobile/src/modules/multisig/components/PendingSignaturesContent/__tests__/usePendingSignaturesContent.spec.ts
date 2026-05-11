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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    MultisigSignRequest,
    SignRequestStatus,
} from '@perawallet/wallet-core-multisig'

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
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: addSignRequestMock }),
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

import { usePendingSignaturesContent } from '../usePendingSignaturesContent'
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

const mockQueryReturn = (data: MultisigSignRequest | undefined) => {
    useSignRequestDetailQueryMock.mockReturnValue({ data, isLoading: false })
}

const buildAccount = (address: string): WalletAccount => ({
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
        addSignRequestMock.mockClear()
        buildCosignArgsMock.mockClear()
        mockDismiss.mockClear()
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
            { address: 'A', status: 'signed' },
            { address: 'B', status: 'declined' },
            { address: 'C', status: 'pending' },
        ])
    })

    it('shows success banner for confirmed status and hides time-remaining', () => {
        usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
        mockQueryReturn(buildSignRequest({ status: 'confirmed' }))

        const { result } = renderHook(() => usePendingSignaturesContent())

        expect(result.current.bannerVariant).toBe('success')
        expect(result.current.timeRemaining).toBeNull()
    })

    it.each<SignRequestStatus>(['failed', 'expired', 'declined'])(
        'shows failure banner for %s status',
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
        it('dispatches a cosign SignRequest for every local unsigned signer (in order) and closes the sheet', () => {
            usePendingSignaturesSheetStore.setState({ signRequestId: 'sr-1' })
            mockQueryReturn(buildSignRequest({ status: 'pending' }))
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
            expect(addSignRequestMock).toHaveBeenNthCalledWith(
                1,
                cosignRequestStub,
            )
            expect(addSignRequestMock).toHaveBeenNthCalledWith(
                2,
                cosignRequestStub,
            )
            expect(
                usePendingSignaturesSheetStore.getState().signRequestId,
            ).toBeNull()
            expect(mockDismiss).toHaveBeenCalled()
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
})
