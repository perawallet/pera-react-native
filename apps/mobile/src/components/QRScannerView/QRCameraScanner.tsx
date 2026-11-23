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

import { Camera } from 'react-native-vision-camera'
import {
    useBarcodeScannerOutput,
    type TargetBarcodeFormat,
} from 'react-native-vision-camera-barcode-scanner'
import { useQRCameraScanner } from './useQRCameraScanner'
import type { QRCameraScannerProps } from './types'

// Android (ML Kit). iOS resolves QRCameraScanner.ios.tsx instead, because the
// ML Kit package is not linked there and creates its HybridObject at import
// time. Keep this the only importer of `react-native-vision-camera-barcode-scanner`.

// Hoisted to a stable reference: useBarcodeScannerOutput memoizes the native
// output on this array's identity, so an inline literal would recreate the
// output every render.
const BARCODE_FORMATS: TargetBarcodeFormat[] = ['qr-code', 'ean-13']

export const QRCameraScanner = ({
    device,
    isActive,
    style,
    onBarcodeScanned,
    onError,
}: QRCameraScannerProps) => {
    const { cameraRef, handleLayout, focusCenter } = useQRCameraScanner()

    const scannerOutput = useBarcodeScannerOutput({
        barcodeFormats: BARCODE_FORMATS,
        // The default 'preview' buffer caps ML Kit's frame at ~720p, too few
        // pixels per module for dense codes (long WalletConnect URIs).
        outputResolution: 'full',
        onBarcodeScanned,
        onError,
    })

    return (
        <Camera
            ref={cameraRef}
            style={style}
            outputs={[scannerOutput]}
            device={device}
            isActive={isActive}
            onLayout={handleLayout}
            onPreviewStarted={focusCenter}
            onError={onError}
            // Manual override so the user can also tap to focus elsewhere.
            enableNativeTapToFocusGesture
        />
    )
}
