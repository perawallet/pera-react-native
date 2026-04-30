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

// Mimic PWBottomSheet's behavior of firing onBackdropPress (wired to onClose
// in the real components) whenever the sheet dismisses — including the
// programmatic dismiss that happens when isVisible flips false during a
// transition. Without this, the test would not catch the regression where a
// transition leaks into a parent-level close.
const useDismissCallbackOnHide = (
    isVisible: boolean,
    onClose: () => void,
) => {
    const wasVisibleRef = React.useRef(false)
    React.useEffect(() => {
        if (wasVisibleRef.current && !isVisible) {
            onClose()
        }
        wasVisibleRef.current = isVisible
    }, [isVisible, onClose])
}

vi.mock('../../PassphraseAcknowledgeBottomSheet', () => ({
    PassphraseAcknowledgeBottomSheet: ({
        isVisible,
        onConfirm,
        onClose,
    }: {
        isVisible: boolean
        onConfirm: () => void
        onClose: () => void
    }) => {
        useDismissCallbackOnHide(isVisible, onClose)
        return isVisible
            ? React.createElement(
                  'div',
                  { 'data-testid': 'acknowledge_sheet' },
                  React.createElement('button', {
                      'data-testid': 'acknowledge_confirm',
                      onClick: onConfirm,
                  }),
                  React.createElement('button', {
                      'data-testid': 'acknowledge_close',
                      onClick: onClose,
                  }),
              )
            : null
    },
}))

vi.mock('../../ViewPassphraseBottomSheet', () => ({
    ViewPassphraseBottomSheet: ({
        isVisible,
        onClose,
    }: {
        isVisible: boolean
        onClose: () => void
    }) => {
        useDismissCallbackOnHide(isVisible, onClose)
        return isVisible
            ? React.createElement(
                  'div',
                  { 'data-testid': 'display_sheet' },
                  React.createElement('button', {
                      'data-testid': 'display_close',
                      onClick: onClose,
                  }),
              )
            : null
    },
}))

import { ViewPassphraseFlow } from '../ViewPassphraseFlow'

describe('ViewPassphraseFlow', () => {
    const onClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
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
        expect(screen.queryByTestId('acknowledge_sheet')).toBeNull()
        expect(screen.queryByTestId('display_sheet')).toBeNull()
    })

    it('opens the acknowledge sheet directly when no PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )
        await waitFor(() => {
            expect(screen.getByTestId('acknowledge_sheet')).toBeTruthy()
        })
        expect(screen.queryByTestId('pin_modal')).toBeNull()
    })

    it('chains PIN → acknowledge → display when a PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )

        await waitFor(() => screen.getByTestId('pin_modal'))
        fireEvent.click(screen.getByTestId('pin_success'))

        await waitFor(() => screen.getByTestId('acknowledge_sheet'))
        fireEvent.click(screen.getByTestId('acknowledge_confirm'))

        await waitFor(() => {
            expect(screen.getByTestId('display_sheet')).toBeTruthy()
        })
        // The acknowledge sheet's programmatic dismissal must NOT bubble out
        // to the flow's onClose, otherwise the display sheet would be torn
        // down before the user could read the passphrase.
        expect(onClose).not.toHaveBeenCalled()
    })

    it("does not tear the display sheet down when the parent's onClose is bound to isVisible", async () => {
        // Realistic host: parent state is bound to isVisible so an unintended
        // onClose during acknowledge → display would actually close the flow.
        // Regression test for the case where the dismissal of the outgoing
        // acknowledge sheet leaks out as a parent-level close.
        mockCheckPinEnabled.mockResolvedValue(false)
        const Host = () => {
            const [isVisible, setIsVisible] = React.useState(true)
            return (
                <ViewPassphraseFlow
                    isVisible={isVisible}
                    address='ADDR'
                    onClose={() => setIsVisible(false)}
                />
            )
        }
        render(<Host />)

        await waitFor(() => screen.getByTestId('acknowledge_sheet'))
        fireEvent.click(screen.getByTestId('acknowledge_confirm'))

        await waitFor(() => {
            expect(screen.getByTestId('display_sheet')).toBeTruthy()
        })
        // After a tick, ensure the display sheet hasn't been torn down by a
        // delayed dismissal callback.
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(screen.getByTestId('display_sheet')).toBeTruthy()
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

    it('calls parent onClose when the acknowledge sheet is cancelled', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )
        await waitFor(() => screen.getByTestId('acknowledge_close'))
        fireEvent.click(screen.getByTestId('acknowledge_close'))
        expect(onClose).toHaveBeenCalled()
    })

    it('calls parent onClose when the display sheet is dismissed', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        render(
            <ViewPassphraseFlow
                isVisible={true}
                address='ADDR'
                onClose={onClose}
            />,
        )
        await waitFor(() => screen.getByTestId('acknowledge_confirm'))
        fireEvent.click(screen.getByTestId('acknowledge_confirm'))
        await waitFor(() => screen.getByTestId('display_close'))
        fireEvent.click(screen.getByTestId('display_close'))
        expect(onClose).toHaveBeenCalled()
    })
})
