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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@test-utils/render'
// Import the exact web filename — vitest has no Metro platform resolution,
// so a bare '../QRScannerView' specifier would load the native,
// vision-camera-backed module instead (as the native QRScannerView.spec.tsx
// does).
import { QRScannerView, type QRScannerViewProps } from '../QRScannerView.web'

// vitest.setup.ts globally stubs the whole '@components/core' barrel
// (PWBottomSheet included) with a trivial testID='PWBottomSheet' div and no
// backdrop — fine for other specs, but this one exists to prove real sheet
// chrome (backdrop press, testID passthrough). Swap in the real web
// PWBottomSheet; the rest stay as simple DOM stand-ins mirroring the setup
// file's stubs.
vi.mock('@components/core', async () => {
    const { default: React } = await import('react')
    const { PWBottomSheet } =
        await import('../../core/PWBottomSheet/PWBottomSheet.web')

    return {
        PWBottomSheet,
        PWButton: ({
            title,
            onPress,
            testID,
        }: {
            title?: string
            onPress?: () => void
            testID?: string
        }) =>
            React.createElement(
                'button',
                { onClick: onPress, 'data-testid': testID ?? 'PWButton' },
                title,
            ),
        PWInput: ({
            onChangeText,
            placeholder,
            testID,
        }: {
            onChangeText?: (value: string) => void
            placeholder?: string
            testID?: string
        }) =>
            React.createElement('input', {
                placeholder,
                'data-testid': testID ?? 'PWInput',
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    onChangeText?.(e.target.value),
            }),
        PWText: ({ children }: { children?: React.ReactNode }) =>
            React.createElement('span', { 'data-testid': 'PWText' }, children),
        PWTouchableIcon: ({
            name,
            onPress,
        }: {
            name?: string
            onPress?: () => void
        }) =>
            React.createElement('div', {
                onClick: onPress,
                role: 'button',
                'data-testid': `touchable-icon-${name}`,
            }),
        PWView: ({ children }: { children?: React.ReactNode }) =>
            React.createElement('div', { 'data-testid': 'PWView' }, children),
    }
})

const mockHandleDeepLink = vi.fn()
const mockIsValidDeepLink = vi.fn(() => true)

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(() => ({
        handleDeepLink: mockHandleDeepLink,
        isValidDeepLink: mockIsValidDeepLink,
    })),
}))

const mockGetSurface = vi.fn(() => 'expanded')
const mockOpenExpandedTab = vi.fn().mockResolvedValue(undefined)

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: () => mockGetSurface(),
    openExpandedTab: (...args: unknown[]) => mockOpenExpandedTab(...args),
}))

const PASTED_VALUE = 'ALGO-ADDRESS'

// Feature-detected BarcodeDetector, so the camera-start path is reachable —
// see the "expanded surface" suite, which needs to observe getUserMedia
// actually being called.
class FakeBarcodeDetector {
    static getSupportedFormats = vi.fn().mockResolvedValue(['qr_code'])
    detect = vi.fn().mockResolvedValue([])
}

const flushAsync = async () => {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })
}

const renderScanner = (props: Partial<QRScannerViewProps> = {}) =>
    render(
        <QRScannerView
            isVisible={true}
            animationType='none'
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            {...props}
        />,
    )

// Types the value into the paste field and submits it — the one path that
// must keep working regardless of camera availability/surface, and the
// simplest way to drive `handleResult` without reaching into camera internals.
const submitPasted = (value: string) => {
    fireEvent.change(screen.getByTestId('qr-paste-input'), {
        target: { value },
    })
    fireEvent.click(screen.getByTestId('qr-paste-submit'))
}

describe('QRScannerView (web)', () => {
    let getUserMedia: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockIsValidDeepLink.mockReturnValue(true)
        mockGetSurface.mockReturnValue('expanded')
        getUserMedia = vi.fn().mockResolvedValue({
            getTracks: () => [{ stop: vi.fn() }],
        } as unknown as MediaStream)
        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia },
            configurable: true,
        })
        vi.stubGlobal('BarcodeDetector', FakeBarcodeDetector)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        Reflect.deleteProperty(navigator, 'mediaDevices')
    })

    describe('popup surface (blur-fragile — must not auto-start the camera)', () => {
        beforeEach(() => {
            mockGetSurface.mockReturnValue('popup')
        })

        it('does not call getUserMedia on mount', async () => {
            renderScanner()
            await flushAsync()
            expect(getUserMedia).not.toHaveBeenCalled()
        })

        it('shows a "Scan with camera" button that opens the expanded tab on the scan flow', () => {
            renderScanner()
            expect(screen.getByTestId('qr-scan-with-camera')).toBeTruthy()

            fireEvent.click(screen.getByTestId('qr-scan-with-camera'))

            expect(mockOpenExpandedTab).toHaveBeenCalledWith('scan')
        })

        it('keeps paste fully functional', () => {
            const onSuccess = vi.fn()
            renderScanner({ onSuccess, skipDeepLinkHandler: true })

            submitPasted(PASTED_VALUE)

            expect(onSuccess).toHaveBeenCalledWith(
                PASTED_VALUE,
                expect.any(Function),
            )
        })

        // Field scans (skipDeepLinkHandler: true) can't round-trip a value
        // scanned in the tab back into the closed popup's input, so the
        // hand-off button is dropped in favor of paste-only.
        it('hides the "Scan with camera" button for a field scan (skipDeepLinkHandler)', () => {
            renderScanner({ skipDeepLinkHandler: true })

            expect(screen.queryByTestId('qr-scan-with-camera')).toBeNull()
            expect(
                screen.getByText('qr_scanner.camera_unavailable'),
            ).toBeTruthy()
        })
    })

    describe('expanded surface (camera auto-starts)', () => {
        beforeEach(() => {
            mockGetSurface.mockReturnValue('expanded')
        })

        it('calls getUserMedia on mount', async () => {
            renderScanner()
            await flushAsync()
            expect(getUserMedia).toHaveBeenCalledTimes(1)
        })

        it('does not show the "Scan with camera" button', async () => {
            renderScanner()
            await flushAsync()
            expect(screen.queryByTestId('qr-scan-with-camera')).toBeNull()
        })
    })

    describe('sheet chrome', () => {
        it('renders nothing when isVisible is false', () => {
            renderScanner({ isVisible: false })

            expect(screen.queryByTestId('qr-paste-input')).toBeNull()
        })

        it('renders content inside the bottom sheet', () => {
            renderScanner()

            expect(screen.getByTestId('qr-scanner-sheet')).toBeTruthy()
            expect(screen.getByTestId('qr-paste-input')).toBeTruthy()
        })

        it('calls onClose when the backdrop is pressed', () => {
            const onClose = vi.fn()
            renderScanner({ onClose })

            fireEvent.click(screen.getByTestId('pw-bottom-sheet-backdrop'))

            expect(onClose).toHaveBeenCalledTimes(1)
        })

        // Regression: PWBottomSheet's onDismiss fires ~250ms after isVisible
        // flips false (once its exit animation completes) — every real call
        // site reacts to onClose by flipping isVisible false, so wiring
        // onClose as both onBackdropPress AND onDismiss double-fired it.
        // QRScannerView must only pass onBackdropPress.
        it('does not double-fire onClose when the parent flips isVisible false after a backdrop press', () => {
            const onClose = vi.fn()
            const { rerender } = renderScanner({ onClose })

            fireEvent.click(screen.getByTestId('pw-bottom-sheet-backdrop'))
            expect(onClose).toHaveBeenCalledTimes(1)

            rerender(
                <QRScannerView
                    isVisible={false}
                    animationType='none'
                    onClose={onClose}
                    onSuccess={vi.fn()}
                />,
            )

            // The global RN mock (vitest.setup.ts) resolves Animated.start()
            // synchronously, so the exit animation "completes" within
            // rerender — exactly where the old double-fire happened.
            expect(onClose).toHaveBeenCalledTimes(1)
        })
    })

    // Mirrors useQRScannerView.spec.ts's 3 dedicated cases for the native
    // hook's onBarcodeScanned — this component reimplements the same
    // isValidDeepLink -> skipDeepLinkHandler -> handleDeepLink ->
    // onSuccess/onError/onConnectionError -> handlingRef guard chain.
    describe('handleResult dispatch', () => {
        it('dispatches exactly once via handleDeepLink, then calls onSuccess', () => {
            const onSuccess = vi.fn()
            renderScanner({ onSuccess, skipDeepLinkHandler: false })

            submitPasted(PASTED_VALUE)

            expect(mockHandleDeepLink).toHaveBeenCalledTimes(1)
            expect(mockHandleDeepLink).toHaveBeenCalledWith(
                PASTED_VALUE,
                false,
                'qr',
                expect.any(Function),
                expect.any(Function),
                expect.any(Function),
            )
            expect(onSuccess).not.toHaveBeenCalled()

            // Invoke the dispatcher's "handled successfully" callback (5th arg).
            const onHandled = mockHandleDeepLink.mock.calls[0][4] as () => void
            act(() => onHandled())

            expect(onSuccess).toHaveBeenCalledWith(
                PASTED_VALUE,
                expect.any(Function),
            )
        })

        it('skips handleDeepLink and calls onSuccess directly when skipDeepLinkHandler is true', () => {
            const onSuccess = vi.fn()
            renderScanner({ onSuccess, skipDeepLinkHandler: true })

            submitPasted(PASTED_VALUE)

            expect(mockHandleDeepLink).not.toHaveBeenCalled()
            expect(onSuccess).toHaveBeenCalledWith(
                PASTED_VALUE,
                expect.any(Function),
            )
        })

        it('ignores a re-entrant submit while one is already being handled', () => {
            const onSuccess = vi.fn()
            renderScanner({ onSuccess, skipDeepLinkHandler: true })

            submitPasted(PASTED_VALUE)
            submitPasted(PASTED_VALUE)

            expect(onSuccess).toHaveBeenCalledTimes(1)
        })
    })
})
