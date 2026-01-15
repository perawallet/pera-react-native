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
import {
    useCameraPermission,
    useCameraDevice,
    Camera,
    useCodeScanner,
} from 'react-native-vision-camera'
import { useEffect, useState } from 'react'
import { Modal } from 'react-native'
import { useLanguage } from '@hooks/language'
import { useDeepLink } from '@hooks/deeplink'
import { EmptyView } from '@components/EmptyView'
import { logger } from '@perawallet/wallet-core-shared'
import { PWButton } from '@components/core/PWButton'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { PWIcon } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'

export type QRScannerViewProps = {
    title?: string
    isVisible: boolean
    animationType: 'slide' | 'fade' | 'none'
    onClose: () => void
    onSuccess: (url: string, restartScanning: () => void) => void
}

export const QRScannerView = (props: QRScannerViewProps) => {
    const styles = useStyles()
    const device = useCameraDevice('back')
    const { hasPermission, requestPermission } = useCameraPermission()
    const [scanningEnabled, setScanningEnabled] = useState(true)
    const { t } = useLanguage()

    const { handleDeepLink, isValidDeepLink } = useDeepLink()

    useEffect(() => {
        if (!props.isVisible) {
            setScanningEnabled(false)
        } else {
            setScanningEnabled(true)
        }
    }, [props.isVisible])

    const codeScanner = useCodeScanner({
        codeTypes: ['qr', 'ean-13'],
        onCodeScanned: codes => {
            try {
                const url = codes.at(0)?.value
                setScanningEnabled(false)
                if (url) {
                    if (isValidDeepLink(url, 'qr')) {
                        handleDeepLink(
                            url,
                            true,
                            'qr',
                            () => setScanningEnabled(true),
                            () => {
                                logger.debug(
                                    'QRScannerView: Deep link handled successfully',
                                    { url },
                                )
                                props.onSuccess(url, () =>
                                    setScanningEnabled(true),
                                )
                            },
                        )
                    }
                }
            } catch (error) {
                logger.error('QRScannerView: QR scanner error:', { error })
            }
        },
    })

    if (!hasPermission) {
        requestPermission()
    }

    return (
        <Modal
            style={styles.container}
            visible={props.isVisible}
            animationType={props.animationType}
        >
            {device == null ? (
                <>
                    <EmptyView
                        style={styles.emptyView}
                        title={t('camera.no_camera_device_found.label')}
                        body={''}
                        button={
                            <PWButton
                                variant='primary'
                                title={t('common.go_back.label')}
                                onPress={props.onClose}
                            />
                        }
                    />
                </>
            ) : (
                <>
                    <PWTouchableOpacity
                        onPress={props.onClose}
                        style={styles.icon}
                    >
                        <PWIcon
                            name='cross'
                            variant='white'
                        />
                    </PWTouchableOpacity>
                    <Camera
                        style={styles.camera}
                        codeScanner={codeScanner}
                        device={device}
                        isActive={scanningEnabled}
                    />
                    <CameraOverlay style={styles.overlay} />
                    <PWText
                        variant='h2'
                        style={styles.title}
                    >
                        {props.title ?? 'Find a code to scan'}
                    </PWText>
                </>
            )}
        </Modal>
    )
}
