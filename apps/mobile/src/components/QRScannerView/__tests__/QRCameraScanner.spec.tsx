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

vi.mock('react-native-vision-camera', () => ({
    Camera: () => <div data-testid='camera'>Camera</div>,
}))

vi.mock('react-native-vision-camera-barcode-scanner', () => ({
    useBarcodeScannerOutput: vi.fn(() => ({})),
}))

describe('QRCameraScanner', () => {
    it('scans from the full-resolution buffer so dense QR codes decode on Android', () => {
        const onBarcodeScanned = vi.fn()
        const onError = vi.fn()
        render(
            <QRCameraScanner
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal device stub for the mocked Camera
                device={{ id: 'mock-device' } as any}
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
})
