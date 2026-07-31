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

import { useStyles } from './styles'
import CameraOverlay from '@assets/images/camera-overlay.svg'
import { ActivityIndicator, Modal } from 'react-native'
import { useTheme } from '@rneui/themed'
import { Suspense, createRef, lazy, useCallback, useState } from 'react'
import { type NotifierRoot, NotifierWrapper } from 'react-native-notifier'
import { useLanguage } from '@hooks/useLanguage'
import { BaseErrorBoundary } from '@components/BaseErrorBoundary'
import { EmptyView } from '@components/EmptyView'
import { PWButton, PWText, PWTouchableIcon, PWView } from '@components/core'
import { useQRScannerView } from './useQRScannerView'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Local notifier scoped to the scanner Modal. The scanner is a native
 * `<Modal>` (a separate OS window) that sits above the app's root view
 * tree, so toasts shown through the global `Notifier` render behind it and
 * stay hidden until the Modal closes. Routing WalletConnect errors through
 * this notifier — mirroring `bottomSheetNotifier` — lets them appear on top
 * of the live camera, matching the native apps. The ref is populated only
 * while the Modal is visible (the `NotifierWrapper` unmounts otherwise), so
 * consumers can treat a non-null `current` as "scanner is open".
 */
export const scannerNotifier = createRef<Nullable<NotifierRoot>>()

// Loaded lazily and only when a camera device exists. QRCameraScanner is the
// sole importer of `react-native-vision-camera-barcode-scanner`, which pulls in
// MLKit at import time — MLKit is excluded from the iOS simulator build (no
// arm64-simulator slice), and there is no camera device on a simulator, so this
// module is never imported there. The `.then` keeps named exports (repo convention).
//
// Minted per instance instead of module-level: `lazy` caches a rejected import
// forever, so one failed chunk fetch / MLKit init would otherwise re-throw on
// every scanner open until app restart (PERA-4465). Retry mints a fresh one.
const createQRCameraScanner = () =>
    lazy(() =>
        import('./QRCameraScanner').then(module => ({
            default: module.QRCameraScanner,
        })),
    )

type ScannerErrorFallbackProps = {
    onRetry: () => void
    onClose: () => void
}

const ScannerErrorFallback = ({
    onRetry,
    onClose,
}: ScannerErrorFallbackProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    return (
        <EmptyView
            style={styles.emptyView}
            title={t('camera.scanner_load_failed.title')}
            body={t('camera.scanner_load_failed.body')}
            button={
                <PWView style={styles.errorActions}>
                    <PWButton
                        variant='primary'
                        title={t('common.retry.label')}
                        onPress={onRetry}
                    />
                    <PWButton
                        variant='secondary'
                        title={t('common.close.label')}
                        onPress={onClose}
                    />
                </PWView>
            }
        />
    )
}

export type QRScannerViewProps = {
    title?: string
    isVisible: boolean
    animationType: 'slide' | 'fade' | 'none'
    onClose: () => void
    onSuccess: (url: string, restartScanning: () => void) => void
    skipDeepLinkHandler?: boolean
}

export const QRScannerView = (props: QRScannerViewProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const { theme } = useTheme()

    const [QRCameraScanner, setQRCameraScanner] = useState(() =>
        createQRCameraScanner(),
    )
    const handleScannerRetry = useCallback((reset: () => void) => {
        // Order matters: swap in a fresh lazy component first so clearing the
        // boundary re-renders against a clean import, not the cached rejection.
        setQRCameraScanner(() => createQRCameraScanner())
        reset()
    }, [])

    const {
        device,
        scanningEnabled,
        permissionDenied,
        hasPermission,
        isHandling,
        onBarcodeScanned,
        onError,
    } = useQRScannerView({
        isVisible: props.isVisible,
        onSuccess: props.onSuccess,
        onClose: props.onClose,
        skipDeepLinkHandler: props.skipDeepLinkHandler,
    })

    return (
        <Modal
            style={styles.container}
            visible={props.isVisible}
            animationType={props.animationType}
        >
            {props.isVisible ? (
                <NotifierWrapper
                    omitGlobalMethodsHookup
                    ref={scannerNotifier}
                    componentProps={{ ContainerComponent: SafeAreaView }}
                >
                    {device == null || permissionDenied || !hasPermission ? (
                        <EmptyView
                            style={styles.emptyView}
                            title={t('camera.no_camera_device_found.title')}
                            body={t('camera.no_camera_device_found.body')}
                            button={
                                <PWButton
                                    variant='primary'
                                    title={t('common.close.label')}
                                    onPress={props.onClose}
                                />
                            }
                        />
                    ) : (
                        // Catches a failed QRCameraScanner chunk load (Metro
                        // blip in dev, MLKit init in release), which would
                        // otherwise escape to the app root as a crash. The
                        // fallback mirrors the no-camera empty state, with
                        // Retry re-attempting the import (PERA-4465).
                        <BaseErrorBoundary
                            t={t}
                            fallback={(_error, reset) => (
                                <ScannerErrorFallback
                                    onRetry={() => handleScannerRetry(reset)}
                                    onClose={props.onClose}
                                />
                            )}
                        >
                            {/* Order matters for paint stacking: none of these
                                carry an explicit `zIndex`, so they layer purely
                                by document order (camera at the back,
                                title/close on top). This deliberately leaves
                                the toast — rendered last by `NotifierWrapper` —
                                as the top-most layer. An explicit `zIndex` on
                                any of these would jump it above the toast,
                                hiding the WalletConnect error behind the
                                overlay. */}
                            <Suspense fallback={null}>
                                <QRCameraScanner
                                    device={device}
                                    isActive={scanningEnabled}
                                    style={styles.camera}
                                    onBarcodeScanned={onBarcodeScanned}
                                    onError={onError}
                                />
                            </Suspense>
                            <CameraOverlay style={styles.overlay} />
                            <PWTouchableIcon
                                name='cross'
                                variant='white'
                                onPress={props.onClose}
                                containerStyle={styles.icon}
                            />
                            <PWText
                                variant='h2'
                                style={styles.title}
                            >
                                {props.title ?? t('camera.find_qr.title')}
                            </PWText>
                            {/* Hand-rolled rather than PWLoadingOverlay: that
                                renders through PWOverlay → rneui Overlay, i.e.
                                its own Modal, and nesting a Modal inside this
                                one is the layering trap the comment above
                                describes.

                                Last in document order among the scanner's own
                                layers, so it covers the stilled camera frame —
                                but still before NotifierWrapper's toast, which
                                must stay on top. */}
                            {isHandling ? (
                                <PWView style={styles.handlingOverlay}>
                                    <ActivityIndicator
                                        size='large'
                                        color={theme.colors.textWhite}
                                    />
                                    <PWText
                                        variant='body'
                                        style={styles.handlingLabel}
                                    >
                                        {t('camera.handling_code')}
                                    </PWText>
                                </PWView>
                            ) : null}
                        </BaseErrorBoundary>
                    )}
                </NotifierWrapper>
            ) : null}
        </Modal>
    )
}
