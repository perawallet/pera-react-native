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

import { type StyleProp, type ViewStyle } from 'react-native'
import { Camera, type CameraDevice } from 'react-native-vision-camera'
import {
    useBarcodeScannerOutput,
    type TargetBarcodeFormat,
} from 'react-native-vision-camera-barcode-scanner'

// IMPORTANT: this is the ONLY module that imports
// `react-native-vision-camera-barcode-scanner`. That package creates its MLKit
// HybridObject at import time (factory.ts runs `NitroModules.createHybridObject`
// at module scope), and MLKit ships no arm64-simulator slice — so it is excluded
// from the iOS simulator build (see plugins/withMLKitSimulatorExclusion.js).
// QRScannerView therefore loads this component lazily and only when a camera
// device exists (never on a simulator), so the MLKit import never runs there.

// Minimal shape consumed from a scanned barcode. Kept loose so callers
// (useQRScannerView) need not import the scanner package's types.
export type ScannedBarcode = { rawValue?: string }

// Hoisted to a stable reference: useBarcodeScannerOutput memoizes the native
// output on this array's identity, so an inline literal would recreate the
// output every render.
const BARCODE_FORMATS: TargetBarcodeFormat[] = ['qr-code', 'ean-13']

export type QRCameraScannerProps = {
    device: CameraDevice
    isActive: boolean
    style: StyleProp<ViewStyle>
    onBarcodeScanned: (barcodes: ScannedBarcode[]) => void
    onError: (error: Error) => void
}

export const QRCameraScanner = ({
    device,
    isActive,
    style,
    onBarcodeScanned,
    onError,
}: QRCameraScannerProps) => {
    const scannerOutput = useBarcodeScannerOutput({
        barcodeFormats: BARCODE_FORMATS,
        // Scan from the full-resolution camera buffer rather than the default
        // 'preview' buffer. On Android the 'preview' path caps the ML Kit
        // analysis frame at ~720p (see the package's HybridBarcodeScannerOutput),
        // which lacks the pixels-per-module to decode dense QR codes (high
        // version / long WalletConnect URIs) — they silently fail to scan while
        // sparse codes still work. 'full' selects the highest available buffer,
        // restoring the v4 `useCodeScanner` reliability. iOS was unaffected
        // (preview buffers there are preview-layer sized), but the option is
        // cross-platform.
        outputResolution: 'full',
        onBarcodeScanned,
        onError,
    })

    return (
        <Camera
            style={style}
            outputs={[scannerOutput]}
            device={device}
            isActive={isActive}
        />
    )
}
