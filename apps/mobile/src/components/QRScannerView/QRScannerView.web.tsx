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

// Web replacement for the react-native-vision-camera-backed QRScannerView:
// vision-camera has no web implementation (M3 T8's nitro shim makes its
// module-scope factory reject gracefully, leaving the native path dead but
// non-crashing on web). This gives web a real capability: `getUserMedia` +
// the browser's built-in `BarcodeDetector` for camera decoding, with a
// paste field as a fallback for browsers that lack `BarcodeDetector`
// (Firefox) or when the user denies camera permission.
import React, { createRef, useCallback, useRef, useState } from 'react'
import { useDeepLink } from '@hooks/useDeepLink'
import { useLanguage } from '@hooks/useLanguage'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    getSurface,
    openExpandedTab,
} from '@perawallet/wallet-extension-platform-chrome'
import type { NotifierRoot } from 'react-native-notifier'
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

type QRScannerContentProps = QRScannerViewProps & { onRestart: () => void }

// Mirrors useQRScannerView's onBarcodeScanned: a decoded/pasted value isn't
// necessarily a deep link Pera understands, so it's validated and dispatched
// here rather than trusted blindly. `onSuccess` only fires once the dispatch
// actually did something (matching the native contract, where the modal's
// `onSuccess` is "close, the side effect already happened" — not "hand the
// raw string to the caller").
const QRScannerContent = ({
    title,
    onClose,
    onSuccess,
    skipDeepLinkHandler = false,
    onRestart,
}: QRScannerContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleDeepLink, isValidDeepLink } = useDeepLink()

    // Synchronous guard against double-fire, same reasoning as the native
    // hook: a result can arrive while a previous one is still dispatching.
    const handlingRef = useRef(false)

    const handleResult = useCallback(
        (value: string) => {
            try {
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
                        // Dispatcher already toasted the failure.
                        handlingRef.current = false
                        onClose()
                    },
                    () => {
                        logger.debug(
                            'QRScannerView.web: Deep link handled successfully',
                            { value },
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
            onClose,
            onSuccess,
            onRestart,
            skipDeepLinkHandler,
        ],
    )

    // The popup is a 360x600 toolbar window Chrome tears down the instant it
    // loses focus. `getUserMedia`'s permission prompt is an OS-level dialog
    // that steals focus to grant it — exactly the failure `openExpandedTab`
    // exists to dodge (see navigation.ts and WebMainRoutes' add-account /
    // backup-wallet redirects). So in the popup we never auto-start the
    // camera: paste stays fully functional, and a button hands off to the
    // expanded tab, where the scanner (running outside the popup) auto-starts
    // normally. There's no dedicated "scan" expanded-tab route to deep-link
    // into — this component is mounted inline from ~10 different screens
    // (AddressEntryField, ContactForm, WalletConnect screens, etc.), each
    // needing its own scanned-value round-trip back across tabs — so wiring
    // a full ExpandedFlow for it is out of scope here; opening the bare
    // expanded tab is the minimal, honest hand-off.
    const isPopup = getSurface() === 'popup'

    const {
        hasCameraError,
        videoRef,
        pastedValue,
        setPastedValue,
        submitPasted,
    } = useWebQRScanner(handleResult, { autoStart: !isPopup })

    const handleScanWithCamera = useCallback(() => {
        void openExpandedTab()
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
            {isPopup ? (
                <PWButton
                    testID='qr-scan-with-camera'
                    variant='secondary'
                    title={t('qr_scanner.scan_with_camera')}
                    onPress={handleScanWithCamera}
                    style={styles.scanWithCamera}
                />
            ) : hasCameraError ? (
                <PWText
                    variant='body'
                    style={styles.unavailable}
                >
                    {t('qr_scanner.camera_unavailable')}
                </PWText>
            ) : (
                <Video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={styles.video}
                />
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

export const QRScannerView = (props: QRScannerViewProps) => {
    // Remount key: bumped whenever a decoded/pasted value turns out not to be
    // a valid or dispatchable deep link, so the camera+detect effect (which
    // otherwise permanently stops after its first decode) starts fresh.
    const [restartKey, setRestartKey] = useState(0)

    if (!props.isVisible) return null

    return (
        <QRScannerContent
            key={restartKey}
            {...props}
            onRestart={() => setRestartKey(key => key + 1)}
        />
    )
}
