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

import { useCallback, useRef } from 'react'
import {
    Platform,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native'
import {
    Camera,
    type CameraDevice,
    type CameraRef,
} from 'react-native-vision-camera'
import {
    useBarcodeScannerOutput,
    type TargetBarcodeFormat,
} from 'react-native-vision-camera-barcode-scanner'
import { logger } from '@perawallet/wallet-core-shared'

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
    const cameraRef = useRef<CameraRef>(null)
    // Latest measured preview size, used to derive the centre view point for
    // focusTo. Kept in a ref (not state) so measuring the layout doesn't
    // re-render the camera.
    const previewSizeRef = useRef<{ width: number; height: number } | null>(
        null,
    )

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

    // Record the preview size so focusCenter can target the view's centre.
    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout
        previewSizeRef.current = { width, height }
    }, [])

    // Android-only: the v5 pipeline doesn't reliably continuous-autofocus a QR
    // held close to the lens, so codes stay blurry. iOS's native AF handles it,
    // hence the scoping. Focus the reticle's centre (focusTo takes screen
    // coordinates); 'continuous' keeps re-adapting and autoResetAfter:null
    // stops it reverting to whole-scene AF.
    //
    // No-ops before layout is measured and rejects without focus metering —
    // both fall back to native AF plus tap-to-focus. See PERA-4402.
    const focusCenter = useCallback(() => {
        if (Platform.OS !== 'android') {
            return
        }

        const previewSize = previewSizeRef.current
        if (
            !previewSize ||
            previewSize.width === 0 ||
            previewSize.height === 0
        ) {
            return
        }

        cameraRef.current
            ?.focusTo(
                { x: previewSize.width / 2, y: previewSize.height / 2 },
                {
                    adaptiveness: 'continuous',
                    autoResetAfter: null,
                },
            )
            ?.catch((error: unknown) => {
                logger.debug('QRCameraScanner: centre auto-focus unavailable', {
                    error,
                })
            })
    }, [])

    return (
        <Camera
            ref={cameraRef}
            style={style}
            outputs={[scannerOutput]}
            device={device}
            isActive={isActive}
            onLayout={handleLayout}
            onPreviewStarted={focusCenter}
            // Manual override so the user can also tap to focus elsewhere.
            enableNativeTapToFocusGesture
        />
    )
}
