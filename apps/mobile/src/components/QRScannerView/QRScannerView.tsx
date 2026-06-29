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

import { useStyles } from './styles'
import CameraOverlay from '@assets/images/camera-overlay.svg'
import { Modal } from 'react-native'
import { Suspense, lazy } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { EmptyView } from '@components/EmptyView'
import { PWButton, PWText, PWTouchableIcon } from '@components/core'
import { useQRScannerView } from './useQRScannerView'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Loaded lazily and only when a camera device exists. QRCameraScanner is the
// sole importer of `react-native-vision-camera-barcode-scanner`, which pulls in
// MLKit at import time — MLKit is excluded from the iOS simulator build (no
// arm64-simulator slice), and there is no camera device on a simulator, so this
// module is never imported there. The `.then` keeps named exports (repo convention).
const QRCameraScanner = lazy(() =>
    import('./QRCameraScanner').then(module => ({
        default: module.QRCameraScanner,
    })),
)

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

    const {
        device,
        scanningEnabled,
        permissionDenied,
        hasPermission,
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
            {device == null || permissionDenied || !hasPermission ? (
                <>
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
                </>
            ) : (
                <>
                    <PWTouchableIcon
                        name='cross'
                        variant='white'
                        onPress={props.onClose}
                        containerStyle={styles.icon}
                    />
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
                    <PWText
                        variant='h2'
                        style={styles.title}
                    >
                        {props.title ?? t('camera.find_qr.title')}
                    </PWText>
                </>
            )}
        </Modal>
    )
}
