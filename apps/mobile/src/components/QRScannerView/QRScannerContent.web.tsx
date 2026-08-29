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

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDeepLink } from '@hooks/useDeepLink'
import { useLanguage } from '@hooks/useLanguage'
import { logger } from '@perawallet/wallet-core-shared'
import {
    getSurface,
    openExpandedTab,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    PWButton,
    PWInput,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { useWebQRScanner } from './useWebQRScanner'
// Explicit `.web` suffix (not a bare './styles' specifier): `tsc --noEmit`
// (this repo's `build` script) has no platform-suffix resolution, so an
// implicit `./styles` import here would always type-check against the
// native styles.ts. The Metro bundler resolves this identically on both
// platforms since it's an unambiguous plain filename, not platform-magic.
import { useStyles } from './styles.web'

// react-native JSX typings have no DOM intrinsics; under react-native-web the
// renderer is react-dom, which renders host elements like 'video' directly
// (same cast pattern as PWStaticWebView's iframe). `ref` still attaches to
// the real DOM node — React special-cases it for string element types at
// runtime regardless of this type annotation.
const Video = 'video' as unknown as React.ComponentType<{
    ref?: React.Ref<HTMLVideoElement>
    autoPlay?: boolean
    playsInline?: boolean
    muted?: boolean
    style?: Record<string, string | number>
}>

// 'unknown' covers both "not queried yet" (initial render, before the
// permission effect below resolves) and "Permissions API unsupported/threw"
// — both are treated identically to 'prompt': never silently probe the
// camera, always fall back to the hand-off button/paste.
type CameraPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown'

export type QRScannerContentProps = {
    title?: string
    onClose: () => void
    onSuccess: (url: string, restartScanning: () => void) => void
    skipDeepLinkHandler?: boolean
    onRestart: () => void
}

// Mirrors useQRScannerView's onBarcodeScanned: a decoded/pasted value isn't
// necessarily a deep link Pera understands, so it's validated and dispatched
// here rather than trusted blindly. `onSuccess` only fires once the dispatch
// actually did something (matching the native contract, where the modal's
// `onSuccess` is "close, the side effect already happened" — not "hand the
// raw string to the caller").
export const QRScannerContent = ({
    title,
    onClose,
    onSuccess,
    skipDeepLinkHandler = false,
    onRestart,
}: QRScannerContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleDeepLink, isValidDeepLink, parseDeeplink } = useDeepLink()

    // Synchronous guard against double-fire, same reasoning as the native
    // hook: a result can arrive while a previous one is still dispatching.
    const handlingRef = useRef(false)

    const handleResult = useCallback(
        (value: string) => {
            try {
                // WCDIAG: temporary instrumentation, remove before commit.
                console.log(
                    '[WCDIAG-PAGE] handleResult latched=',
                    handlingRef.current,
                    'valid=',
                    isValidDeepLink(value),
                )
                if (handlingRef.current) return
                if (!isValidDeepLink(value)) {
                    // Unrecognized payload — re-arm so the user can retry
                    // (camera stops after its first decode; paste can
                    // always be resubmitted).
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
        let status: PermissionStatus | undefined

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

    const {
        hasCameraError,
        videoRef,
        pastedValue,
        setPastedValue,
        submitPasted,
    } = useWebQRScanner(handleResult, { autoStart: canUseCameraInline })

    const handleScanWithCamera = useCallback(() => {
        void openExpandedTab('scan')
    }, [])

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <PWTouchableIcon
                    name='cross'
                    variant='primary'
                    onPress={onClose}
                />
            </PWView>
            <PWText
                variant='h2'
                style={styles.title}
            >
                {title ?? t('qr_scanner.title')}
            </PWText>
            {canUseCameraInline && !hasCameraError ? (
                <Video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={styles.video}
                />
            ) : isPopup &&
              !skipDeepLinkHandler &&
              cameraPermission !== 'denied' &&
              !hasCameraError ? (
                <PWButton
                    testID='qr-scan-with-camera'
                    variant='secondary'
                    title={t('qr_scanner.scan_with_camera')}
                    onPress={handleScanWithCamera}
                    style={styles.scanWithCamera}
                />
            ) : (
                <PWText
                    variant='body'
                    style={styles.unavailable}
                >
                    {t('qr_scanner.camera_unavailable')}
                </PWText>
            )}
            <PWText
                variant='caption'
                style={styles.pasteLabel}
            >
                {t('qr_scanner.paste_label')}
            </PWText>
            <PWView style={styles.pasteRow}>
                <PWInput
                    testID='qr-paste-input'
                    value={pastedValue}
                    onChangeText={setPastedValue}
                    placeholder={t('qr_scanner.paste_placeholder')}
                    onSubmitEditing={submitPasted}
                />
                <PWButton
                    testID='qr-paste-submit'
                    variant='primary'
                    title={t('qr_scanner.paste_submit')}
                    onPress={submitPasted}
                />
            </PWView>
        </PWView>
    )
}
