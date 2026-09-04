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
import { Platform } from 'react-native'
import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CameraDevice } from 'react-native-vision-camera'
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner'
import { QRCameraScanner } from '../QRCameraScanner'

const cameraProps = vi.hoisted(() => ({
    current: undefined as Record<string, unknown> | undefined,
}))

const focusTo = vi.hoisted(() => vi.fn(() => Promise.resolve()))

// Lets each test decide whether the camera ref is ready (exposes focusTo) or
// still null (camera not mounted/ready yet).
const cameraRefValue = vi.hoisted(() => ({
    current: undefined as { focusTo: unknown } | undefined,
}))

// Minimal stub for the mocked Camera, which never reads device internals.
const mockDevice = { id: 'mock-device' } as unknown as CameraDevice

vi.mock('react-native-vision-camera', async () => {
    const ReactActual = await vi.importActual<typeof import('react')>('react')
    return {
        Camera: ReactActual.forwardRef(
            (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
                cameraProps.current = props
                ReactActual.useImperativeHandle(
                    ref,
                    () => cameraRefValue.current,
                )
                return <div data-testid='camera'>Camera</div>
            },
        ),
    }
})

vi.mock('react-native-vision-camera-barcode-scanner', () => ({
    useBarcodeScannerOutput: vi.fn(() => ({})),
}))

const originalOS = Platform.OS

beforeEach(() => {
    focusTo.mockClear()
    cameraRefValue.current = undefined
})

afterEach(() => {
    Platform.OS = originalOS
})

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

const triggerPreviewStarted = () => {
    const onPreviewStarted = cameraProps.current?.onPreviewStarted as
        | (() => void)
        | undefined
    onPreviewStarted?.()
}

const triggerLayout = (width: number, height: number) => {
    const onLayout = cameraProps.current?.onLayout as
        | ((event: { nativeEvent: { layout: unknown } }) => void)
        | undefined
    onLayout?.({ nativeEvent: { layout: { width, height } } })
}

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

    it('focuses continuously at the measured view centre once the preview starts on Android', () => {
        Platform.OS = 'android'
        cameraRefValue.current = { focusTo }
        renderScanner()

        triggerLayout(200, 400)
        triggerPreviewStarted()

        expect(focusTo).toHaveBeenCalledWith(
            { x: 100, y: 200 },
            {
                adaptiveness: 'continuous',
                autoResetAfter: null,
            },
        )
    })

    it('no-ops when the preview starts before the layout is measured (Android)', () => {
        Platform.OS = 'android'
        cameraRefValue.current = { focusTo }
        renderScanner()

        triggerPreviewStarted()

        expect(focusTo).not.toHaveBeenCalled()
    })

    it('no-ops without throwing when the preview starts before the camera ref is ready (Android)', () => {
        Platform.OS = 'android'
        cameraRefValue.current = undefined
        renderScanner()
        triggerLayout(200, 400)
        const onPreviewStarted = cameraProps.current?.onPreviewStarted
        expect(onPreviewStarted).toBeTypeOf('function')

        expect(() => (onPreviewStarted as () => void)()).not.toThrow()
        expect(focusTo).not.toHaveBeenCalled()
    })

    it('leaves native focus untouched on non-Android platforms', () => {
        Platform.OS = 'ios'
        cameraRefValue.current = { focusTo }
        renderScanner()

        triggerLayout(200, 400)
        triggerPreviewStarted()

        expect(focusTo).not.toHaveBeenCalled()
    })
})
