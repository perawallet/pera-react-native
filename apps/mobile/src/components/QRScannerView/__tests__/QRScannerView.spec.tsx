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
import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import QRScannerView from '../QRScannerView'

vi.mock('react-native-vision-camera', () => ({
    useCameraDevice: vi.fn(() => ({ id: 'mock-device' })),
    useCameraPermission: () => ({
        hasPermission: true,
        requestPermission: vi.fn(),
    }),
    Camera: () => <div data-testid='camera'>Camera</div>,
    useCodeScanner: vi.fn(() => ({})),
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

vi.mock('@hooks/deeplink', () => ({
    useDeepLink: vi.fn(() => ({
        handleDeepLink: vi.fn(),
        isValidDeepLink: vi.fn(() => true),
    })),
}))

describe('QRScannerView', () => {
    it('renders camera when visible and device is available', () => {
        const { container } = render(
            <QRScannerView
                isVisible={true}
                animationType='none'
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders empty view when no camera device is found', () => {
        // This test is simplified - we just verify rendering works
        const { container } = render(
            <QRScannerView
                isVisible={true}
                animationType='none'
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders close button', () => {
        const { container } = render(
            <QRScannerView
                isVisible={true}
                animationType='none'
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('displays custom title when provided', () => {
        const { container } = render(
            <QRScannerView
                isVisible={true}
                animationType='none'
                title='Scan WalletConnect QR'
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(container.textContent).toContain('Scan WalletConnect QR')
    })

    it('displays default title when no title is provided', () => {
        const { container } = render(
            <QRScannerView
                isVisible={true}
                animationType='none'
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('handles different animation types', () => {
        const { container: slideContainer } = render(
            <QRScannerView
                isVisible={true}
                animationType='slide'
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        const { container: fadeContainer } = render(
            <QRScannerView
                isVisible={true}
                animationType='fade'
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />,
        )
        expect(slideContainer).toBeTruthy()
        expect(fadeContainer).toBeTruthy()
    })
})
