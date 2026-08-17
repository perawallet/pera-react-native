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

import React from 'react'
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCameraDevice } from 'react-native-vision-camera'
import { QRScannerView } from '../QRScannerView'
import { LockOverlayProvider } from '@hooks/useIsLockOverlayVisible'

// The camera module is lazily imported by QRScannerView; rejecting that import
// exercises the error boundary + retry path (PERA-4465). The throw lives in an
// export *getter* (not the factory) because the mock module is evaluated once
// per file — the getter re-runs on every `import().then` access, so each lazy
// instance independently sees the current `failImport` state.
const scannerModule = vi.hoisted(() => ({ failImport: false }))
vi.mock('../QRCameraScanner', () => ({
    get QRCameraScanner() {
        if (scannerModule.failImport) {
            throw new Error('chunk load failed')
        }
        return () => 'mock-camera-scanner'
    },
}))

vi.mock('react-native-vision-camera', () => ({
    useCameraDevice: vi.fn(() => ({ id: 'mock-device' })),
    useCameraPermission: () => ({
        hasPermission: true,
        requestPermission: vi.fn(),
    }),
    Camera: () => <div data-testid='camera'>Camera</div>,
}))

vi.mock('react-native-vision-camera-barcode-scanner', () => ({
    useBarcodeScannerOutput: vi.fn(() => ({})),
}))

vi.mock('@assets/images/camera-overlay.svg', () => {
    return {
        default: (props: unknown) =>
            React.createElement('div', {
                ...(props as object),
                'data-testid': 'camera-overlay',
            }),
    }
})

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(() => ({
        handleDeepLink: vi.fn(),
        isValidDeepLink: vi.fn(() => true),
        parseDeeplink: vi.fn(() => ({ type: 'HOME' })),
    })),
}))

const CUSTOM_TITLE = 'Scan WalletConnect QR'

describe('QRScannerView', () => {
    it('shows the camera overlay with the title when a device is available', () => {
        vi.mocked(useCameraDevice).mockReturnValue({
            id: 'mock-device',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal device stub
        } as any)
        render(
            <QRScannerView
                isVisible={true}
                animationType='none'
                title={CUSTOM_TITLE}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(screen.getByText(CUSTOM_TITLE)).toBeTruthy()
    })

    it('shows the empty state (not the camera overlay) when no device is available', () => {
        vi.mocked(useCameraDevice).mockReturnValue(undefined)
        render(
            <QRScannerView
                isVisible={true}
                animationType='none'
                title={CUSTOM_TITLE}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(screen.queryByText(CUSTOM_TITLE)).toBeNull()
    })

    describe('app lock', () => {
        const renderWithLockOverlay = (
            isLockOverlayVisible: boolean,
            onClose: () => void,
        ) => (
            <LockOverlayProvider value={isLockOverlayVisible}>
                <QRScannerView
                    isVisible={true}
                    animationType='none'
                    title={CUSTOM_TITLE}
                    onClose={onClose}
                    onSuccess={vi.fn()}
                />
            </LockOverlayProvider>
        )

        beforeEach(() => {
            vi.mocked(useCameraDevice).mockReturnValue({
                id: 'mock-device',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal device stub
            } as any)
        })

        it('tears down the scanner while the lock overlay is up', () => {
            const onClose = vi.fn()
            const { rerender } = render(renderWithLockOverlay(false, onClose))
            expect(screen.getByText(CUSTOM_TITLE)).toBeTruthy()

            rerender(renderWithLockOverlay(true, onClose))

            expect(screen.queryByText(CUSTOM_TITLE)).toBeNull()
            // The parent owns onClose and some parents navigate on it — routing
            // must not move underneath a locked app.
            expect(onClose).not.toHaveBeenCalled()
        })

        it('restores the scanner once the lock overlay clears', () => {
            const onClose = vi.fn()
            const { rerender } = render(renderWithLockOverlay(false, onClose))
            rerender(renderWithLockOverlay(true, onClose))

            rerender(renderWithLockOverlay(false, onClose))

            expect(screen.getByText(CUSTOM_TITLE)).toBeTruthy()
        })
    })

    describe('camera module load failure (PERA-4465)', () => {
        beforeEach(() => {
            vi.mocked(useCameraDevice).mockReturnValue({
                id: 'mock-device',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal device stub
            } as any)
            scannerModule.failImport = false
        })

        it('shows the failure fallback with a close action instead of crashing', async () => {
            scannerModule.failImport = true
            const onClose = vi.fn()

            render(
                <QRScannerView
                    isVisible={true}
                    animationType='none'
                    onClose={onClose}
                    onSuccess={vi.fn()}
                />,
            )

            expect(
                await screen.findByText('camera.scanner_load_failed.title'),
            ).toBeTruthy()

            fireEvent.click(screen.getByText('common.close.label'))
            expect(onClose).toHaveBeenCalledTimes(1)
        })

        it('retry re-imports the scanner after a failed load', async () => {
            scannerModule.failImport = true

            render(
                <QRScannerView
                    isVisible={true}
                    animationType='none'
                    onClose={vi.fn()}
                    onSuccess={vi.fn()}
                />,
            )
            await screen.findByText('camera.scanner_load_failed.title')

            // Let the import succeed now, as a dev-server/MLKit recovery would.
            scannerModule.failImport = false
            fireEvent.click(screen.getByText('common.retry.label'))

            expect(await screen.findByText('mock-camera-scanner')).toBeTruthy()
            expect(
                screen.queryByText('camera.scanner_load_failed.title'),
            ).toBeNull()
        })
    })
})
