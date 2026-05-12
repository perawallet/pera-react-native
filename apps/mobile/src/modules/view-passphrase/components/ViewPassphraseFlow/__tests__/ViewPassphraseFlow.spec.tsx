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
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@test-utils/render'

const { mockCheckPinEnabled } = vi.hoisted(() => ({
    mockCheckPinEnabled: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mockCheckPinEnabled }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

vi.mock('@modules/security/components/PinEditView', () => ({
    PinEditView: ({
        mode,
        onSuccess,
        onClose,
    }: {
        mode?: string | null
        onSuccess?: () => void
        onClose?: () => void
    }) =>
        mode
            ? React.createElement(
                  'div',
                  { 'data-testid': 'pin_modal' },
                  React.createElement('button', {
                      'data-testid': 'pin_success',
                      onClick: onSuccess,
                  }),
                  React.createElement('button', {
                      'data-testid': 'pin_close',
                      onClick: onClose,
                  }),
              )
            : null,
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('../../PassphraseAcknowledgeContent', () => ({
    PassphraseAcknowledgeContent: () => null,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../ViewPassphraseContent', () => ({
    ViewPassphraseContent: () => null,
}))

import { ViewPassphraseFlow } from '../ViewPassphraseFlow'

describe('ViewPassphraseFlow', () => {
    const onClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it('renders nothing when isVisible is false', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(
            <ViewPassphraseFlow
                isVisible={false}
                address='ADDR'
                onClose={onClose}
            />,
        )
        expect(screen.queryByTestId('pin_modal')).toBeNull()
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('requests the acknowledge sheet directly when no PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        // Hold the acknowledge sheet open during the test
        mockRequestBottomSheet.mockReturnValue(new Promise(() => {}))
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )
        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })
        expect(screen.queryByTestId('pin_modal')).toBeNull()
    })

    it('chains PIN → acknowledge → display when a PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        // First call (acknowledge) resolves with 'confirm', second call
        // (display) stays pending so we can assert it was requested.
        let resolveAcknowledge: (
            value: 'confirm' | undefined,
        ) => void = () => {}
        mockRequestBottomSheet.mockImplementationOnce(
            () =>
                new Promise<'confirm' | undefined>(resolve => {
                    resolveAcknowledge = resolve
                }),
        )
        mockRequestBottomSheet.mockReturnValueOnce(new Promise(() => {}))

        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )

        await waitFor(() => screen.getByTestId('pin_modal'))
        fireEvent.click(screen.getByTestId('pin_success'))

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })
        resolveAcknowledge('confirm')

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
        })
        expect(onClose).not.toHaveBeenCalled()
    })

    it('calls parent onClose when the PIN sheet is dismissed', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )
        await waitFor(() => screen.getByTestId('pin_close'))
        fireEvent.click(screen.getByTestId('pin_close'))
        expect(onClose).toHaveBeenCalled()
    })

    it('calls parent onClose when the acknowledge sheet resolves without confirm', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )
        await waitFor(() => {
            expect(onClose).toHaveBeenCalled()
        })
    })

    it('calls parent onClose when the display sheet resolves', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        // Acknowledge resolves with 'confirm' so the flow moves to display.
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )
        await waitFor(() => {
            expect(onClose).toHaveBeenCalled()
        })
    })
})
