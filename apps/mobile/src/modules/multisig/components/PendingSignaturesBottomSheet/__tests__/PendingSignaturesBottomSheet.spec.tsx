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

import { fireEvent, render, screen } from '@test-utils/render'
import { describe, expect, it, vi } from 'vitest'
import type { UsePendingSignaturesBottomSheetResult } from '../usePendingSignaturesBottomSheet'

vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: () => null,
}))

const translations: Record<string, string> = {
    'multisig.pending_signatures.title': 'Pending signatures',
    'multisig.pending_signatures.accounts_heading': 'Accounts',
    'multisig.pending_signatures.accounts_subtitle':
        'You need at least 2 accounts to sign',
    'multisig.pending_signatures.canceled': 'Transaction canceled.',
    'multisig.pending_signatures.confirmed':
        'Transaction successfully completed',
    'multisig.pending_signatures.x_of_y': '1 of 2 signed',
    'multisig.pending_signatures.time_left': '≈ 52m left',
    'multisig.pending_signatures.close': 'Close',
    'multisig.pending_signatures.close_for_now': 'Close for now',
    'multisig.pending_signatures.sign': 'Sign',
    'multisig.cancel_transaction.button': 'Cancel',
    'multisig.cancel_transaction.confirm_title': 'Cancel Transaction Request',
    'multisig.cancel_transaction.confirm_body':
        'The transaction request will be cancelled. Are you sure?',
    'multisig.cancel_transaction.confirm_action': 'Yes, Cancel',
    'multisig.cancel_transaction.keep_waiting': 'Keep Waiting',
}

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => translations[key] ?? key,
    }),
}))

const usePendingSignaturesBottomSheetMock = vi.fn()
vi.mock('../usePendingSignaturesBottomSheet', () => ({
    usePendingSignaturesBottomSheet: () =>
        usePendingSignaturesBottomSheetMock(),
}))

import { PendingSignaturesBottomSheet } from '../PendingSignaturesBottomSheet'

const ADDRESS_A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ADDRESS_B = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const buildHookResult = (
    overrides: Partial<UsePendingSignaturesBottomSheetResult> = {},
): UsePendingSignaturesBottomSheetResult => ({
    isVisible: true,
    hasSignRequest: true,
    status: 'expired',
    bannerVariant: 'failure',
    failureBannerKey: 'multisig.pending_signatures.canceled',
    signedCount: 1,
    threshold: 2,
    timeRemaining: null,
    failReason: null,
    signers: [
        {
            address: ADDRESS_A,
            status: 'signed',
            canSignAsHardware: false,
            isSigning: false,
        },
        {
            address: ADDRESS_B,
            status: 'unsigned',
            canSignAsHardware: false,
            isSigning: false,
        },
    ],
    handleClose: vi.fn(),
    canSign: false,
    handleSign: vi.fn(),
    handleSignParticipant: vi.fn(),
    canCancel: false,
    isCancelling: false,
    isCancelConfirmOpen: false,
    openCancelConfirm: vi.fn(),
    closeCancelConfirm: vi.fn(),
    handleConfirmCancel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
})

describe('PendingSignaturesBottomSheet', () => {
    it('renders the failure banner, accounts header, and signers list for an expired request', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(buildHookResult())

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_failure_banner'),
        ).toBeTruthy()
        expect(screen.getByText('Accounts')).toBeTruthy()
        expect(
            screen.getByText('You need at least 2 accounts to sign'),
        ).toBeTruthy()
        expect(
            screen.getByTestId(`signer_status_item_${ADDRESS_A}`),
        ).toBeTruthy()
        expect(
            screen.getByTestId(`signer_status_item_${ADDRESS_B}`),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('pending_signatures_signed_count_badge'),
        ).toBeNull()
    })

    it('renders the badges row, accounts header, and signers list for a waiting request', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                timeRemaining: '52m',
                signers: [
                    {
                        address: ADDRESS_A,
                        status: 'signed',
                        canSignAsHardware: false,
                        isSigning: false,
                    },
                    {
                        address: ADDRESS_B,
                        status: 'pending',
                        canSignAsHardware: false,
                        isSigning: false,
                    },
                ],
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_signed_count_badge'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pending_signatures_time_remaining_badge'),
        ).toBeTruthy()
        expect(screen.getByText('Accounts')).toBeTruthy()
        expect(
            screen.getByTestId(`signer_status_item_${ADDRESS_A}`),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('pending_signatures_failure_banner'),
        ).toBeNull()
    })

    it('renders the success banner, accounts header, and signers list for a confirmed request', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'confirmed',
                bannerVariant: 'success',
                signers: [
                    {
                        address: ADDRESS_A,
                        status: 'signed',
                        canSignAsHardware: false,
                        isSigning: false,
                    },
                    {
                        address: ADDRESS_B,
                        status: 'signed',
                        canSignAsHardware: false,
                        isSigning: false,
                    },
                ],
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_success_banner'),
        ).toBeTruthy()
        expect(screen.getByText('Accounts')).toBeTruthy()
        expect(
            screen.getByTestId(`signer_status_item_${ADDRESS_A}`),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('pending_signatures_signed_count_badge'),
        ).toBeNull()
    })

    it('renders a loading indicator and hides the body whenever the sign request data is not available', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                hasSignRequest: false,
                status: null,
                bannerVariant: 'waiting',
                signedCount: 0,
                threshold: 0,
                signers: [],
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_loading_indicator'),
        ).toBeTruthy()
        expect(screen.queryByText('Accounts')).toBeNull()
        expect(
            screen.queryByTestId(`signer_status_item_${ADDRESS_A}`),
        ).toBeNull()
        expect(
            screen.queryByTestId('pending_signatures_signed_count_badge'),
        ).toBeNull()
        expect(
            screen.getByTestId('pending_signatures_close_button'),
        ).toBeTruthy()
    })

    it('keeps the loading indicator visible whenever signRequest is null (component gates on data, not the query loading flag)', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                hasSignRequest: false,
                status: null,
                bannerVariant: 'waiting',
                signers: [],
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_loading_indicator'),
        ).toBeTruthy()
        expect(screen.queryByText('Accounts')).toBeNull()
        expect(
            screen.queryByTestId('pending_signatures_signed_count_badge'),
        ).toBeNull()
    })

    it('prefers the backend failReason over the default failure key when provided', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                failReason: 'Insufficient balance',
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(screen.getByText('Insufficient balance')).toBeTruthy()
    })

    it('renders Cancel and Close-for-now buttons when canCancel is true and canSign is false', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: false,
                canCancel: true,
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_cancel_button'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pending_signatures_close_for_now_button'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('pending_signatures_sign_button'),
        ).toBeNull()
        expect(
            screen.queryByTestId('pending_signatures_close_button'),
        ).toBeNull()
    })

    it('renders only the single Close button when canSign and canCancel are both false', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: false,
                canCancel: false,
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_close_button'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('pending_signatures_sign_button'),
        ).toBeNull()
        expect(
            screen.queryByTestId('pending_signatures_cancel_button'),
        ).toBeNull()
        expect(
            screen.queryByTestId('pending_signatures_close_for_now_button'),
        ).toBeNull()
    })

    it('renders the Sign button alongside Close-for-now when canSign is true', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: true,
                canCancel: false,
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_sign_button'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pending_signatures_close_for_now_button'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('pending_signatures_cancel_button'),
        ).toBeNull()
        expect(
            screen.queryByTestId('pending_signatures_close_button'),
        ).toBeNull()
    })

    it('renders Sign + Cancel + Close-for-now together when both canSign and canCancel are true', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: true,
                canCancel: true,
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId('pending_signatures_sign_button'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pending_signatures_cancel_button'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pending_signatures_close_for_now_button'),
        ).toBeTruthy()
    })

    it('invokes handleSign when the Sign button is pressed', () => {
        const handleSign = vi.fn()
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: true,
                handleSign,
            }),
        )

        render(<PendingSignaturesBottomSheet />)
        fireEvent.click(screen.getByTestId('pending_signatures_sign_button'))

        expect(handleSign).toHaveBeenCalledTimes(1)
    })

    it('renders a per-row Sign action when a participant row reports canSignAsHardware', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                signers: [
                    {
                        address: ADDRESS_A,
                        status: 'signed',
                        canSignAsHardware: false,
                        isSigning: false,
                    },
                    {
                        address: ADDRESS_B,
                        status: 'pending',
                        canSignAsHardware: true,
                        isSigning: false,
                    },
                ],
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId(`signer_status_action_${ADDRESS_B}`),
        ).toBeTruthy()
        // The signed row should not have a per-row action.
        expect(
            screen.queryByTestId(`signer_status_action_${ADDRESS_A}`),
        ).toBeNull()
    })

    it('renders the per-row action in a loading state while the row reports isSigning', () => {
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                signers: [
                    {
                        address: ADDRESS_B,
                        status: 'pending',
                        canSignAsHardware: false,
                        isSigning: true,
                    },
                ],
            }),
        )

        render(<PendingSignaturesBottomSheet />)

        expect(
            screen.getByTestId(`signer_status_action_${ADDRESS_B}`),
        ).toBeTruthy()
    })

    it('invokes handleSignParticipant with the row address when the per-row Sign is pressed', () => {
        const handleSignParticipant = vi.fn()
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                handleSignParticipant,
                signers: [
                    {
                        address: ADDRESS_B,
                        status: 'pending',
                        canSignAsHardware: true,
                        isSigning: false,
                    },
                ],
            }),
        )

        render(<PendingSignaturesBottomSheet />)
        fireEvent.click(screen.getByTestId(`signer_status_action_${ADDRESS_B}`))

        expect(handleSignParticipant).toHaveBeenCalledTimes(1)
        expect(handleSignParticipant).toHaveBeenCalledWith(ADDRESS_B)
    })

    it('opens the cancel confirmation when the Cancel button is pressed', () => {
        const openCancelConfirm = vi.fn()
        usePendingSignaturesBottomSheetMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canCancel: true,
                openCancelConfirm,
            }),
        )

        render(<PendingSignaturesBottomSheet />)
        fireEvent.click(screen.getByTestId('pending_signatures_cancel_button'))

        expect(openCancelConfirm).toHaveBeenCalledTimes(1)
    })
})
