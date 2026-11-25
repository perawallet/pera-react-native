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

import type { StyleProp, ViewStyle } from 'react-native'
import type { CameraDevice } from 'react-native-vision-camera'

// Minimal shape both platform scanners emit, so callers need not import
// either scanner package's types.
export type ScannedBarcode = { rawValue?: string }

export type QRCameraScannerProps = {
    device: CameraDevice
    isActive: boolean
    style: StyleProp<ViewStyle>
    onBarcodeScanned: (barcodes: ScannedBarcode[]) => void
    onError: (error: Error) => void
}
