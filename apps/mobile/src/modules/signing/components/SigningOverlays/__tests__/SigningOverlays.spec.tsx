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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@test-utils/render'
import { SigningOverlays } from '../SigningOverlays'

// ----- mock bottom-sheet -----
const mockRequestBottomSheet = vi.fn().mockResolvedValue(undefined)
const mockDismiss = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        dismiss: mockDismiss,
    }),
}))

// ----- mock signing hooks -----
const mockUseHardwareSigning = vi.fn()
const mockUseSigningRequest = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useHardwareSigning: () => mockUseHardwareSigning(),
    useSigningRequest: () => mockUseSigningRequest(),
}))

// ----- mock settings -----
vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        getPreference: vi.fn().mockReturnValue(true), // mark FAQ as seen so it never opens
        setPreference: vi.fn(),
    }),
}))

// ----- mock child content components -----
vi.mock('../../LedgerSigningContent/useLedgerSigningContent', () => ({
    useLedgerSigningContent: () => ({
        isVisible: false,
        isTroubleshootingVisible: false,
        onCloseTroubleshooting: vi.fn(),
    }),
}))

vi.mock('../../SignRequestContent', () => ({
    SignRequestContent: () => null,
}))

vi.mock('../../LedgerSigningContent', () => ({
    LedgerSigningContent: () => null,
}))

vi.mock('../../LedgerConnectionIssueContent', () => ({
    LedgerConnectionIssueContent: () => null,
}))

vi.mock('../../SigningCompletedContent', () => ({
    SigningCompletedContent: () => null,
}))

vi.mock('../../TransactionRequestFAQContent', () => ({
    TransactionRequestFAQContent: () => null,
}))

// ----- helpers -----
const PENDING_REQUEST_ID = 'req-1'
const PENDING_REQUEST = {
    id: PENDING_REQUEST_ID,
    headless: false,
    type: 'transactions',
    sourceType: 'dapp',
} as never

const buildHardwareSigningResult = (status: string) => ({
    isActive: status !== 'idle' && status !== 'searching',
    status,
    deviceName: null,
    currentTx: null,
    totalTxs: null,
    requestId: null,
    error: null,
    resolveActiveRequest: vi.fn(),
    dismiss: vi.fn(),
})

describe('SigningOverlays — useSignRequestDriver gate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSigningRequest.mockReturnValue({
            pendingSignRequests: [PENDING_REQUEST],
            lastCompletedRequest: null,
            clearLastCompletedRequest: vi.fn(),
        })
    })

    it('requests the sign-request sheet when hardwareStatus is "idle"', () => {
        mockUseHardwareSigning.mockReturnValue(
            buildHardwareSigningResult('idle'),
        )
        render(<SigningOverlays />)
        expect(mockRequestBottomSheet).toHaveBeenCalledOnce()
        expect(mockRequestBottomSheet.mock.calls[0][0]).toMatchObject({
            id: PENDING_REQUEST_ID,
        })
    })

    it('requests the sign-request sheet when hardwareStatus is "searching" (silent BLE scan)', () => {
        mockUseHardwareSigning.mockReturnValue(
            buildHardwareSigningResult('searching'),
        )
        render(<SigningOverlays />)
        expect(mockRequestBottomSheet).toHaveBeenCalledOnce()
        expect(mockRequestBottomSheet.mock.calls[0][0]).toMatchObject({
            id: PENDING_REQUEST_ID,
        })
    })

    it('does NOT request the sign-request sheet when hardwareStatus is "awaitingApproval"', () => {
        mockUseHardwareSigning.mockReturnValue(
            buildHardwareSigningResult('awaitingApproval'),
        )
        render(<SigningOverlays />)
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('does NOT request the sign-request sheet when hardwareStatus is "signing"', () => {
        mockUseHardwareSigning.mockReturnValue(
            buildHardwareSigningResult('signing'),
        )
        render(<SigningOverlays />)
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('does NOT request the sign-request sheet when hardwareStatus is "error"', () => {
        mockUseHardwareSigning.mockReturnValue(
            buildHardwareSigningResult('error'),
        )
        render(<SigningOverlays />)
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })
})
