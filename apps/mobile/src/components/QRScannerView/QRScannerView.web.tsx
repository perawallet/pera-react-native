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

// Web replacement for the react-native-vision-camera-backed QRScannerView:
// vision-camera has no web implementation (M3 T8's nitro shim makes its
// module-scope factory reject gracefully, leaving the native path dead but
// non-crashing on web). This gives web a real capability: `getUserMedia` +
// the browser's built-in `BarcodeDetector` for camera decoding, with a
// paste field as a fallback for browsers that lack `BarcodeDetector`
// (Firefox) or when the user denies camera permission.
import React, { createRef, useState } from 'react'
import { type Nullable } from '@perawallet/wallet-core-shared'
import type { NotifierRoot } from 'react-native-notifier'
import { PWBottomSheet } from '@components/core'
// Explicit `.web` suffix (not a bare './QRScannerContent' specifier): `tsc
// --noEmit` (this repo's `build` script) has no platform-suffix resolution,
// so an implicit specifier here would always type-check against a
// non-existent native module. The Metro bundler resolves this identically on
// both platforms since it's an unambiguous plain filename, not
// platform-magic.
import { QRScannerContent } from './QRScannerContent.web'

// Mirrors the native module's export so `@components/QRScannerView`'s barrel
// (`export { scannerNotifier } from './QRScannerView'`) resolves on both
// platforms. The web view renders no local NotifierWrapper, so this ref stays
// `null` — consumers (e.g. useWalletConnectProvider) already treat a null
// `current` as "fall back to the global notifier", which is correct here.
export const scannerNotifier = createRef<Nullable<NotifierRoot>>()

export type QRScannerViewProps = {
    title?: string
    isVisible: boolean
    animationType: 'slide' | 'fade' | 'none'
    onClose: () => void
    onSuccess: (url: string, restartScanning: () => void) => void
    skipDeepLinkHandler?: boolean
}

export const QRScannerView = (props: QRScannerViewProps) => {
    // Remount key: bumped whenever a decoded/pasted value turns out not to be
    // a valid or dispatchable deep link, so the camera+detect effect (which
    // otherwise permanently stops after its first decode) starts fresh.
    const [restartKey, setRestartKey] = useState(0)

    return (
        // No `onDismiss`: the X button and backdrop already call
        // props.onClose directly (the X inline, backdrop via
        // onBackdropPress below); wiring onClose as onDismiss too would
        // double-fire it when the parent then flips isVisible false and the
        // exit animation completes. PWBottomSheet still tears itself down
        // (setIsRendered(false)) on that flip regardless of onDismiss.
        <PWBottomSheet
            isVisible={props.isVisible}
            onBackdropPress={props.onClose}
            size='auto'
            testID='qr-scanner-sheet'
        >
            <QRScannerContent
                key={restartKey}
                title={props.title}
                onClose={props.onClose}
                onSuccess={props.onSuccess}
                skipDeepLinkHandler={props.skipDeepLinkHandler}
                onRestart={() => setRestartKey(key => key + 1)}
            />
        </PWBottomSheet>
    )
}
