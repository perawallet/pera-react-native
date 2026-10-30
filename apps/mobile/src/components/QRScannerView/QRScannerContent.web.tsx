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

import React from 'react'
import { useLanguage } from '@hooks/useLanguage'
import {
    PWButton,
    PWInput,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { useWebQRScanner } from './useWebQRScanner'
import { useQRScannerContent } from './useQRScannerContent'
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
    const {
        handleResult,
        canUseCameraInline,
        handleScanWithCamera,
        handleAllowCamera,
    } = useQRScannerContent({ onSuccess, skipDeepLinkHandler, onRestart })

    const {
        hasCameraError,
        cameraError,
        videoRef,
        pastedValue,
        setPastedValue,
        submitPasted,
    } = useWebQRScanner(handleResult, { autoStart: canUseCameraInline })

    const renderCameraArea = () => {
        if (canUseCameraInline && !hasCameraError) {
            return (
                <Video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={styles.video}
                />
            )
        }
        if (cameraError === 'blocked' || cameraError === 'unavailable') {
            return (
                <PWView testID='qr-camera-error'>
                    <PWText
                        variant='body'
                        style={styles.unavailable}
                    >
                        {t(
                            cameraError === 'blocked'
                                ? 'qr_scanner.camera_access_denied'
                                : 'qr_scanner.camera_unavailable',
                        )}
                    </PWText>
                    <PWView style={styles.cameraErrorActions}>
                        <PWButton
                            testID='qr-camera-retry'
                            variant='primary'
                            title={t('qr_scanner.try_again')}
                            onPress={onRestart}
                        />
                        <PWButton
                            testID='qr-camera-cancel'
                            variant='secondary'
                            title={t('common.cancel.label')}
                            onPress={onClose}
                        />
                    </PWView>
                </PWView>
            )
        }
        if (isPopup && cameraPermission !== 'denied' && !hasCameraError) {
            if (!skipDeepLinkHandler) {
                return (
                    <PWButton
                        testID='qr-scan-with-camera'
                        variant='secondary'
                        title={t('qr_scanner.scan_with_camera')}
                        onPress={handleScanWithCamera}
                        style={styles.scanWithCamera}
                    />
                )
            }
            return (
                <PWButton
                    testID='qr-allow-camera'
                    variant='secondary'
                    title={t('qr_scanner.allow_camera')}
                    onPress={handleAllowCamera}
                    style={styles.scanWithCamera}
                />
            )
        }
        return (
            <PWText
                variant='body'
                style={styles.unavailable}
            >
                {t('qr_scanner.camera_unavailable')}
            </PWText>
        )
    }

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
            {renderCameraArea()}
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
