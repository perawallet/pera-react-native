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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeepLink } from '@modules/deeplink'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { openExpandedTab } from '@perawallet/wallet-core-browser-runtime'

// 'unknown' covers both "not queried yet" (initial render, before the
// permission effect below resolves) and "Permissions API unsupported/threw"
// — both are treated identically to 'prompt': never silently probe the
// camera, always fall back to the hand-off button/paste.
type CameraPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown'

export type UseQRScannerContentProps = {
    onSuccess: (url: string, restartScanning: () => void) => void
    skipDeepLinkHandler?: boolean
    onRestart: () => void
}

export type UseQRScannerContentResult = {
    handleResult: (value: string) => void
    canUseCameraInline: boolean
    isPopup: boolean
    cameraPermission: CameraPermissionState
    handleScanWithCamera: () => void
    handleAllowCamera: () => void
}

export const useQRScannerContent = ({
    onSuccess,
    skipDeepLinkHandler = false,
    onRestart,
}: UseQRScannerContentProps): UseQRScannerContentResult => {
    const { t } = useLanguage()
    const { handleDeepLink, isValidDeepLink, parseDeeplink } = useDeepLink()
    const { errorToast } = useToast()

    // Synchronous guard against double-fire, same reasoning as the native
    // hook: a result can arrive while a previous one is still dispatching.
    const handlingRef = useRef(false)

    const handleResult = useCallback(
        (value: string) => {
            try {
                if (handlingRef.current) return
                // `skipDeepLinkHandler` callers validate the payload
                // themselves and scan things that are not deeplinks at all
                // (e.g. a raw JSON backup envelope), so the gate is theirs to
                // apply, not ours.
                if (!skipDeepLinkHandler && !isValidDeepLink(value)) {
                    // Toast rather than a blocking error: a near-miss decode
                    // is common, and the re-armed scanner is the retry.
                    errorToast(t('qr_scanner.invalid_code'), '')
                    onRestart()
                    return
                }
                handlingRef.current = true

                if (skipDeepLinkHandler) {
                    onSuccess(value, () => {
                        handlingRef.current = false
                        onRestart()
                    })
                    return
                }

                void handleDeepLink(
                    value,
                    false,
                    'qr',
                    () => {
                        // Dispatcher toasted the failure where a toast
                        // applies (capability-gated CARDS/SELL drop silently —
                        // toast follow-up tracked) — keep the
                        // scanner open for a retry rather than closing
                        // (closing, which on a scan-only tab now closes the
                        // whole tab, would eat the toast).
                        handlingRef.current = false
                        onRestart()
                    },
                    () => {
                        // Log only the parsed type, never the raw scanned /
                        // pasted string: a RECOVER_ADDRESS payload is a
                        // mnemonic. The logger's redactor would scrub it, but
                        // we don't hand the secret to logging in the first
                        // place.
                        logger.debug(
                            'QRScannerView.web: Deep link handled successfully',
                            { type: parseDeeplink(value)?.type },
                        )
                        onSuccess(value, () => {
                            handlingRef.current = false
                            onRestart()
                        })
                    },
                    () => {
                        // e.g. WalletConnect handshake rejected — keep the
                        // scanner open and re-arm rather than closing.
                        handlingRef.current = false
                        onRestart()
                    },
                )
            } catch (error) {
                handlingRef.current = false
                logger.error('QRScannerView.web: QR scanner error:', {
                    error,
                })
            }
        },
        [
            handleDeepLink,
            isValidDeepLink,
            parseDeeplink,
            onSuccess,
            onRestart,
            skipDeepLinkHandler,
            errorToast,
            t,
        ],
    )

    // Chrome tears the popup down the instant it loses focus, and
    // `getUserMedia`'s permission prompt is an OS dialog that steals focus. But
    // permission is per-origin and persists, so once 'granted' the call resolves
    // silently and the popup can auto-start inline.
    //
    // So never call `getUserMedia` in the 'prompt' or unqueryable states —
    // paste stays functional there, plus a button handing off to the expanded
    // tab where the OS dialog can't kill the surface. That button only shows
    // for deep-link scans: a value scanned in the tab can't round-trip back
    // into a field on the closed popup. 'denied' is paste-only too, since the
    // expanded tab would hit the same per-origin denial.
    const isPopup = getSurface() === 'popup'

    const [cameraPermission, setCameraPermission] =
        useState<CameraPermissionState>('unknown')

    // Only the popup needs this: the expanded tab/full page always
    // auto-starts regardless of permission state (see `canUseCameraInline`
    // below), so querying there is wasted work. Feature-detects
    // `navigator.permissions.query` — Firefox/Safari either lack the
    // Permissions API or may reject the 'camera' name — both fall back to
    // 'unknown', identical to 'prompt'. Subscribes to `status.onchange` so a
    // grant/revoke made elsewhere (e.g. the expanded tab, or chrome://settings)
    // while this popup happens to be open is picked up live.
    useEffect(() => {
        if (!isPopup) return
        if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
            return
        }
        let cancelled = false
        let status: Optional<PermissionStatus>

        navigator.permissions
            .query({ name: 'camera' })
            .then(result => {
                if (cancelled) return
                status = result
                setCameraPermission(status.state as CameraPermissionState)
                status.onchange = () => {
                    if (cancelled) return
                    setCameraPermission(status!.state as CameraPermissionState)
                }
            })
            .catch((error: unknown) => {
                logger.debug(
                    'QRScannerContent.web: camera permission query failed',
                    { error },
                )
                if (cancelled) return
                setCameraPermission('unknown')
            })

        return () => {
            cancelled = true
            if (status) {
                status.onchange = null
            }
        }
    }, [isPopup])

    // Outside the popup this is always true (unconditional auto-start, as
    // before). Inside the popup it's true only once the permission query
    // above has resolved to 'granted' — WHY this is safe to flip live rather
    // than needing a remount: useWebQRScanner's camera effect lists
    // `autoStart` in its dependency array, so when this flips false→true
    // after the async permission query resolves, that effect simply re-runs
    // (its `!autoStart` early-return branch registers no cleanup to unwind),
    // starting the camera cleanly with no stale state left over.
    const canUseCameraInline = !isPopup || cameraPermission === 'granted'

    const handleScanWithCamera = useCallback(() => {
        void openExpandedTab('scan')
    }, [])

    // A field scanner can't move to the tab, but the camera permission is
    // per-origin: granting it there once lets this popup start the camera
    // inline from then on.
    const handleAllowCamera = useCallback(() => {
        void openExpandedTab('camera-access')
    }, [])

    return {
        handleResult,
        canUseCameraInline,
        isPopup,
        cameraPermission,
        handleScanWithCamera,
        handleAllowCamera,
    }
}
