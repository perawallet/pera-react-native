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

import { useDeepLink } from '@hooks/useDeepLink'
import { logger } from '@perawallet/wallet-core-shared'
import { useEffect, useState } from 'react'
import {
    useCameraDevice,
    useCameraPermission,
    useCodeScanner,
} from 'react-native-vision-camera'

export type UseQRScannerViewProps = {
    isVisible: boolean
    onSuccess: (url: string, restartScanning: () => void) => void
}

export const useQRScannerView = ({
    isVisible,
    onSuccess,
}: UseQRScannerViewProps) => {
    const device = useCameraDevice('back')
    const { hasPermission, requestPermission } = useCameraPermission()
    const [scanningEnabled, setScanningEnabled] = useState(true)
    const [permissionDenied, setPermissionDenied] = useState(false)

    const { handleDeepLink, isValidDeepLink } = useDeepLink()

    useEffect(() => {
        if (!isVisible) {
            setScanningEnabled(false)
        } else {
            setScanningEnabled(true)
        }
    }, [isVisible])

    const codeScanner = useCodeScanner({
        codeTypes: ['qr', 'ean-13'],
        onCodeScanned: codes => {
            try {
                const url = codes.at(0)?.value
                setScanningEnabled(false)
                if (url) {
                    if (isValidDeepLink(url)) {
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
                                onSuccess(url, () => setScanningEnabled(true))
                            },
                        )
                    }
                }
            } catch (error) {
                logger.error('QRScannerView: QR scanner error:', { error })
            }
        },
    })

    useEffect(() => {
        if (!hasPermission && isVisible) {
            requestPermission().then(result => {
                if (!result) {
                    setPermissionDenied(true)
                } else {
                    setPermissionDenied(false)
                }
            })
        }
    }, [isVisible, hasPermission, requestPermission])

    return {
        hasPermission,
        codeScanner,
        scanningEnabled,
        permissionDenied,
        device,
    }
}
