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
import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    useObjectOutput,
    type CameraDevice,
    type ScannedObject,
} from 'react-native-vision-camera'
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner'
import { QRCameraScanner } from '../QRCameraScanner.ios'

const cameraProps = vi.hoisted(() => ({
    current: undefined as Record<string, unknown> | undefined,
}))

const objectOutput = vi.hoisted(() => ({ kind: 'object-output' }))

vi.mock('react-native-vision-camera', async () => {
    const ReactActual = await vi.importActual<typeof import('react')>('react')
    return {
        Camera: ReactActual.forwardRef((props: Record<string, unknown>) => {
            cameraProps.current = props
            return <div data-testid='camera'>Camera</div>
        }),
        useObjectOutput: vi.fn(() => objectOutput),
        isScannedCode: (object: object) => 'value' in object,
    }
})

vi.mock('react-native-vision-camera-barcode-scanner', () => ({
    useBarcodeScannerOutput: vi.fn(() => ({})),
}))

const mockDevice = { id: 'mock-device' } as unknown as CameraDevice

const renderScanner = (onBarcodeScanned = vi.fn()) => {
    render(
        <QRCameraScanner
            device={mockDevice}
            isActive={true}
            style={undefined}
            onBarcodeScanned={onBarcodeScanned}
            onError={vi.fn()}
        />,
    )
    const { onObjectsScanned } = vi.mocked(useObjectOutput).mock.lastCall![0]
    return onObjectsScanned as (objects: ScannedObject[]) => void
}

beforeEach(() => {
    vi.mocked(useObjectOutput).mockClear()
    vi.mocked(useBarcodeScannerOutput).mockClear()
})

describe('QRCameraScanner (iOS)', () => {
    it('scans QR and EAN-13 with the AVFoundation object output, not ML Kit', () => {
        renderScanner()

        expect(useObjectOutput).toHaveBeenCalledWith(
            expect.objectContaining({ types: ['qr', 'ean-13'] }),
        )
        expect(useBarcodeScannerOutput).not.toHaveBeenCalled()
        expect(cameraProps.current?.outputs).toEqual([objectOutput])
    })

    it('reports decoded code values as barcodes and drops non-code objects', () => {
        const onBarcodeScanned = vi.fn()
        const onObjectsScanned = renderScanner(onBarcodeScanned)

        onObjectsScanned([
            { type: 'face' },
            { type: 'qr', value: 'wc:abc@2' },
        ] as unknown as ScannedObject[])

        expect(onBarcodeScanned).toHaveBeenCalledWith([
            { rawValue: 'wc:abc@2' },
        ])
    })

    it('skips an undecodable code so a decodable one in the same frame is reported', () => {
        const onBarcodeScanned = vi.fn()
        const onObjectsScanned = renderScanner(onBarcodeScanned)

        onObjectsScanned([
            { type: 'qr', value: undefined },
            { type: 'qr', value: 'algorand://ADDR' },
        ] as unknown as ScannedObject[])

        expect(onBarcodeScanned).toHaveBeenCalledWith([
            { rawValue: 'algorand://ADDR' },
        ])
    })

    it('routes camera session errors to onError', () => {
        const onError = vi.fn()
        render(
            <QRCameraScanner
                device={mockDevice}
                isActive={true}
                style={undefined}
                onBarcodeScanned={vi.fn()}
                onError={onError}
            />,
        )

        expect(cameraProps.current?.onError).toBe(onError)
    })

    it('does not report a scan when no machine-readable code was found', () => {
        const onBarcodeScanned = vi.fn()
        const onObjectsScanned = renderScanner(onBarcodeScanned)

        onObjectsScanned([{ type: 'face' }] as unknown as ScannedObject[])

        expect(onBarcodeScanned).not.toHaveBeenCalled()
    })
})
