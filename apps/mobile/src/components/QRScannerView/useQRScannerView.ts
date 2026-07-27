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

import { useDeepLink } from '@hooks/useDeepLink'
import { logger } from '@perawallet/wallet-core-shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
    useCameraDevice,
    useCameraPermission,
} from 'react-native-vision-camera'
import { type ScannedBarcode } from './QRCameraScanner'

// NOTE: this hook intentionally does NOT import
// `react-native-vision-camera-barcode-scanner`. That package pulls in MLKit at
// import time, which is excluded from the iOS simulator build. The scanner hook
// lives in QRCameraScanner, lazily mounted only when a camera device exists.
// We expose `onBarcodeScanned`/`onError` here and wire them up there.

export type UseQRScannerViewProps = {
    isVisible: boolean
    onSuccess: (url: string, restartScanning: () => void) => void
    /**
     * Called when a recognised deeplink URL fails to dispatch (handler
     * threw, parser-recognised but unsupported, etc.). Used to dismiss
     * the camera Modal so any error toast queued by the deeplink handler
     * becomes visible — toasts render above Modal in the root tree but
     * are obscured by the Modal's native window while it's open.
     */
    onClose?: () => void
    skipDeepLinkHandler?: boolean
}

export const useQRScannerView = ({
    isVisible,
    onSuccess,
    onClose,
    skipDeepLinkHandler = false,
}: UseQRScannerViewProps) => {
    const device = useCameraDevice('back')
    const { hasPermission, requestPermission } = useCameraPermission()
    const [scanningEnabled, setScanningEnabled] = useState(true)
    const [permissionDenied, setPermissionDenied] = useState(false)

    const { handleDeepLink, isValidDeepLink } = useDeepLink()

    // Synchronous guard against double-fire. The barcode scanner's
    // `onBarcodeScanned` is invoked from the native camera frame loop and
    // can fire multiple times in the same tick — a `setScanningEnabled`
    // (React state) update doesn't propagate to the `isActive` prop fast
    // enough to suppress the second call. Without this ref we end up
    // dispatching the same deeplink twice (visible in QR logs as two
    // "Deep link handled successfully" entries → two stacked sign sheets
    // / two error popups the user has to dismiss separately).
    const handlingRef = useRef(false)

    // Reset the guard whenever the modal opens; same lifecycle as the
    // scanningEnabled state.
    useEffect(() => {
        if (!isVisible) {
            setScanningEnabled(false)
        } else {
            handlingRef.current = false
            setScanningEnabled(true)
        }
    }, [isVisible])

    // Handlers passed down to QRCameraScanner, which wires them into the native
    // barcode-scanner output. Memoised so the native output isn't recreated on
    // every render.
    const onBarcodeScanned = useCallback(
        (barcodes: ScannedBarcode[]) => {
            try {
                if (handlingRef.current) return
                const url = barcodes.at(0)?.rawValue
                if (!url) return
                if (!isValidDeepLink(url)) {
                    // Unrecognized code — leave the scanner armed so the
                    // user can try again without closing the modal.
                    return
                }
                // Take the lock before doing anything that could re-enter.
                handlingRef.current = true
                setScanningEnabled(false)
                if (skipDeepLinkHandler) {
                    onSuccess(url, () => {
                        handlingRef.current = false
                        setScanningEnabled(true)
                    })
                    return
                }
                // Push, don't replace: the QR modal dismisses itself via
                // `onSuccess`, so the underlying nav already advances. Using
                // `replace` here would discard the screen the user was on,
                // leaving destinations like Staking / AssetDetails with no
                // back path.
                void handleDeepLink(
                    url,
                    false,
                    'qr',
                    () => {
                        // Dispatcher toasted the failure where a toast
                        // applies (capability-gated CARDS/SELL drop silently —
                        // toast follow-up tracked). Close the
                        // Modal so the toast (rendered behind it via the
                        // root NotifierRoot) becomes visible.
                        handlingRef.current = false
                        setScanningEnabled(true)
                        onClose?.()
                    },
                    () => {
                        logger.debug(
                            'QRScannerView: Deep link handled successfully',
                            { url },
                        )
                        onSuccess(url, () => {
                            handlingRef.current = false
                            setScanningEnabled(true)
                        })
                    },
                    () => {
                        // WalletConnect handshake rejected (e.g. wrong
                        // network). The provider already surfaced a toast on
                        // this Modal's own notifier, so keep the scanner open
                        // and re-arm it for another scan instead of closing.
                        handlingRef.current = false
                        setScanningEnabled(true)
                    },
                )
            } catch (error) {
                handlingRef.current = false
                logger.error('QRScannerView: QR scanner error:', { error })
            }
        },
        [
            isValidDeepLink,
            handleDeepLink,
            skipDeepLinkHandler,
            onSuccess,
            onClose,
        ],
    )

    const onError = useCallback((error: Error) => {
        logger.error('QRScannerView: barcode scanner failed:', { error })
    }, [])

    useEffect(() => {
        if (hasPermission) {
            // Permission may have been granted via Settings while the
            // sheet was backgrounded — clear any stale denied flag.
            setPermissionDenied(false)
            return
        }
        if (!isVisible) return
        let active = true
        void requestPermission().then(result => {
            if (!active) return
            setPermissionDenied(!result)
        })
        return () => {
            active = false
        }
    }, [isVisible, hasPermission, requestPermission])

    return {
        hasPermission,
        scanningEnabled,
        permissionDenied,
        device,
        onBarcodeScanned,
        onError,
    }
}
