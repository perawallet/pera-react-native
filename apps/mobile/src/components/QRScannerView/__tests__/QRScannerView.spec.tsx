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
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { useCameraDevice } from 'react-native-vision-camera'
import { QRScannerView } from '../QRScannerView'

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
})
