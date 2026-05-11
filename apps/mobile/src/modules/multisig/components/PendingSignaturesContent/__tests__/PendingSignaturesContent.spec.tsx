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
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import type { UsePendingSignaturesContentResult } from '../usePendingSignaturesContent'

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

const usePendingSignaturesContentMock = vi.fn()
vi.mock('../usePendingSignaturesContent', () => ({
    usePendingSignaturesContent: () => usePendingSignaturesContentMock(),
}))

import { PendingSignaturesContent } from '../PendingSignaturesContent'

const ADDRESS_A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ADDRESS_B = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const buildSignRequest = (): MultisigSignRequest =>
    ({
        id: 'sr-1',
        status: 'expired',
        type: 'async',
        createdAt: new Date('2026-05-06T09:00:00Z'),
        expectedExpireDatetime: new Date('2026-05-06T10:00:00Z'),
        failReasonDisplay: null,
        multisigAccount: {
            customId: 'm-1',
            createdAt: new Date('2026-05-06T09:00:00Z'),
            address: 'MULTISIG',
            version: 1,
            threshold: 2,
            participantAddresses: [ADDRESS_A, ADDRESS_B],
        },
        transactionLists: [],
    }) as unknown as MultisigSignRequest

const buildHookResult = (
    overrides: Partial<UsePendingSignaturesContentResult> = {},
): UsePendingSignaturesContentResult => ({
    isLoading: false,
    signRequest: buildSignRequest(),
    status: 'expired',
    bannerVariant: 'failure',
    failureBannerKey: 'multisig.pending_signatures.canceled',
    signedCount: 1,
    threshold: 2,
    timeRemaining: null,
    failReason: null,
    signers: [
        { address: ADDRESS_A, status: 'signed' },
        { address: ADDRESS_B, status: 'unsigned' },
    ],
    handleClose: vi.fn(),
    canSign: false,
    handleSign: vi.fn(),
    canCancel: false,
    isCancelling: false,
    handleCancel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
})

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <PendingSignaturesContent />
        </BottomSheetIdContext.Provider>,
    )

describe('PendingSignaturesContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('renders the failure banner, accounts header, and signers list for an expired request', () => {
        usePendingSignaturesContentMock.mockReturnValue(buildHookResult())

        renderWithId()

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
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                timeRemaining: '52m',
                signers: [
                    { address: ADDRESS_A, status: 'signed' },
                    { address: ADDRESS_B, status: 'pending' },
                ],
            }),
        )

        renderWithId()

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
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'confirmed',
                bannerVariant: 'success',
                signers: [
                    { address: ADDRESS_A, status: 'signed' },
                    { address: ADDRESS_B, status: 'signed' },
                ],
            }),
        )

        renderWithId()

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
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                isLoading: true,
                signRequest: null,
                status: null,
                bannerVariant: 'waiting',
                signedCount: 0,
                threshold: 0,
                signers: [],
            }),
        )

        renderWithId()

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

    it('keeps the loading indicator visible even after isLoading flips to false if the sign request is still null', () => {
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                isLoading: false,
                signRequest: null,
                status: null,
                bannerVariant: 'waiting',
                signers: [],
            }),
        )

        renderWithId()

        expect(
            screen.getByTestId('pending_signatures_loading_indicator'),
        ).toBeTruthy()
        expect(screen.queryByText('Accounts')).toBeNull()
        expect(
            screen.queryByTestId('pending_signatures_signed_count_badge'),
        ).toBeNull()
    })

    it('prefers the backend failReason over the default failure key when provided', () => {
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                failReason: 'Insufficient balance',
            }),
        )

        renderWithId()

        expect(screen.getByText('Insufficient balance')).toBeTruthy()
    })

    it('renders Cancel and Close-for-now buttons when canCancel is true and canSign is false', () => {
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: false,
                canCancel: true,
            }),
        )

        renderWithId()

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
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: false,
                canCancel: false,
            }),
        )

        renderWithId()

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
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: true,
                canCancel: false,
            }),
        )

        renderWithId()

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
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: true,
                canCancel: true,
            }),
        )

        renderWithId()

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
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canSign: true,
                handleSign,
            }),
        )

        renderWithId()
        fireEvent.click(screen.getByTestId('pending_signatures_sign_button'))

        expect(handleSign).toHaveBeenCalledTimes(1)
    })

    it('invokes handleCancel when the Cancel button is pressed', () => {
        const handleCancel = vi.fn().mockResolvedValue(undefined)
        usePendingSignaturesContentMock.mockReturnValue(
            buildHookResult({
                status: 'pending',
                bannerVariant: 'waiting',
                canCancel: true,
                handleCancel,
            }),
        )

        renderWithId()
        fireEvent.click(screen.getByTestId('pending_signatures_cancel_button'))

        expect(handleCancel).toHaveBeenCalledTimes(1)
    })
})
