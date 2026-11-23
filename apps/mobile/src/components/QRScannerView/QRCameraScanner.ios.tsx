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

import { useCallback } from 'react'
import {
    Camera,
    isScannedCode,
    useObjectOutput,
    type ScannedObject,
    type ScannedObjectType,
} from 'react-native-vision-camera'
import { useQRCameraScanner } from './useQRCameraScanner'
import type { QRCameraScannerProps, ScannedBarcode } from './types'

// Hoisted to a stable reference: useObjectOutput recreates the native output
// whenever this array's identity changes.
const OBJECT_TYPES: ScannedObjectType[] = ['qr', 'ean-13']

// iOS scans with AVFoundation's metadata output rather than ML Kit, whose
// package is not linked on iOS (see react-native.config.js). Never import
// `react-native-vision-camera-barcode-scanner` here: its HybridObject is
// created at import time and would throw without the native module.
export const QRCameraScanner = ({
    device,
    isActive,
    style,
    onBarcodeScanned,
    onError,
}: QRCameraScannerProps) => {
    const { cameraRef, handleLayout, focusCenter } = useQRCameraScanner()

    const handleObjectsScanned = useCallback(
        (objects: ScannedObject[]) => {
            const barcodes: ScannedBarcode[] = objects
                .filter(isScannedCode)
                .filter(code => !!code.value)
                .map(code => ({ rawValue: code.value }))
            if (barcodes.length > 0) {
                onBarcodeScanned(barcodes)
            }
        },
        [onBarcodeScanned],
    )

    const objectOutput = useObjectOutput({
        types: OBJECT_TYPES,
        onObjectsScanned: handleObjectsScanned,
    })

    return (
        <Camera
            ref={cameraRef}
            style={style}
            outputs={[objectOutput]}
            device={device}
            isActive={isActive}
            onLayout={handleLayout}
            onPreviewStarted={focusCenter}
            onError={onError}
            enableNativeTapToFocusGesture
        />
    )
}
