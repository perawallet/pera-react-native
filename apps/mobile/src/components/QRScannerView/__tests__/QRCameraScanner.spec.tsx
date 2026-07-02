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
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner'
import { QRCameraScanner } from '../QRCameraScanner'

import type { CameraDevice } from 'react-native-vision-camera'

const cameraProps = vi.hoisted(() => ({
    current: undefined as Record<string, unknown> | undefined,
}))

// Minimal stub for the mocked Camera, which never reads device internals.
const mockDevice = { id: 'mock-device' } as unknown as CameraDevice

vi.mock('react-native-vision-camera', () => ({
    Camera: (props: Record<string, unknown>) => {
        cameraProps.current = props
        return <div data-testid='camera'>Camera</div>
    },
    createNormalizedMeteringPoint: vi.fn(() => ({})),
}))

vi.mock('react-native-vision-camera-barcode-scanner', () => ({
    useBarcodeScannerOutput: vi.fn(() => ({})),
}))

const renderScanner = () =>
    render(
        <QRCameraScanner
            device={mockDevice}
            isActive={true}
            style={undefined}
            onBarcodeScanned={vi.fn()}
            onError={vi.fn()}
        />,
    )

describe('QRCameraScanner', () => {
    it('scans from the full-resolution buffer so dense QR codes decode on Android', () => {
        const onBarcodeScanned = vi.fn()
        const onError = vi.fn()
        render(
            <QRCameraScanner
                device={mockDevice}
                isActive={true}
                style={undefined}
                onBarcodeScanned={onBarcodeScanned}
                onError={onError}
            />,
        )
        expect(useBarcodeScannerOutput).toHaveBeenCalledWith(
            expect.objectContaining({
                outputResolution: 'full',
                onBarcodeScanned,
                onError,
            }),
        )
    })

    it('enables native tap-to-focus so blurry QR codes can be focused on Android', () => {
        renderScanner()
        expect(cameraProps.current?.enableNativeTapToFocusGesture).toBe(true)
    })

    it('auto-focuses the centre once the preview starts, without throwing before the camera is ready', () => {
        renderScanner()
        const onPreviewStarted = cameraProps.current?.onPreviewStarted
        expect(onPreviewStarted).toBeTypeOf('function')
        // Camera ref is unset in the mock (no controller yet) — the handler must
        // no-op rather than crash.
        expect(() => (onPreviewStarted as () => void)()).not.toThrow()
    })
})
