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
import PWView from '@components/common/view/PWView'
import CameraOverlay from '@assets/images/camera-overlay.svg'
import {
    useCameraPermission,
    useCameraDevice,
    Camera,
    useCodeScanner,
} from 'react-native-vision-camera'
import { Text } from '@rneui/themed'
import { PropsWithChildren, useState } from 'react'
import { Modal } from 'react-native'
import { useLanguage } from '@hooks/language'
import { useDeepLink } from '@hooks/deeplink'

type QRScannerViewProps = {
    title?: string
    visible: boolean
    animationType: 'slide' | 'fade' | 'none'
    onSuccess: (url: string, restartScanning: () => void) => void
} & PropsWithChildren

const QRScannerView = (props: QRScannerViewProps) => {
    const styles = useStyles()
    const device = useCameraDevice('back')
    const { hasPermission, requestPermission } = useCameraPermission()
    const [scanningEnabled, setScanningEnabled] = useState(true)
    const { t } = useLanguage()

    const { handleDeepLink, isValidDeepLink } = useDeepLink()

    const codeScanner = useCodeScanner({
        codeTypes: ['qr', 'ean-13'],
        onCodeScanned: codes => {
            const url = codes.at(0)?.value
            setScanningEnabled(false)
            if (url) {
                if (isValidDeepLink(url, 'qr')) {
                    handleDeepLink(url, true, 'qr', () =>
                        setScanningEnabled(true),
                    )
                }
            }
        },
    })

    if (!hasPermission) {
        requestPermission()
    }
    if (device == null) {
        return (
            <PWView>
                <Text>{t('camera.no_camera_device_found.label')}</Text>
            </PWView>
        )
    }

    return (
        <Modal
            style={styles.container}
            visible={props.visible}
            animationType={props.animationType}
        >
            {props.children}
            <Camera
                style={styles.camera}
                codeScanner={codeScanner}
                device={device}
                isActive={scanningEnabled}
            />
            <CameraOverlay style={styles.overlay} />
            <Text
                h2
                h2Style={styles.title}
            >
                {props.title ?? 'Find a code to scan'}
            </Text>
        </Modal>
    )
}

export default QRScannerView
