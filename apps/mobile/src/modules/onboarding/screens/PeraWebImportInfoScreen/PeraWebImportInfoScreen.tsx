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

import React from 'react'
import { PWButton, PWScreen, PWView } from '@components/core'
import { QRScannerView } from '@components/QRScannerView'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { usePeraWebImportInfoScreen } from './usePeraWebImportInfoScreen'

export const PeraWebImportInfoScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        handleScan,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
    } = usePeraWebImportInfoScreen()

    return (
        <>
            <PWScreen
                scroll={false}
                footer={
                    <PWButton
                        variant='primary'
                        title={t('onboarding.pera_web_import.info.scan_button')}
                        onPress={handleScan}
                        testID='pera_web_import_info_scan_button'
                    />
                }
            >
                <PWView style={styles.content}>
                    <ScreenHeader
                        icon='globe'
                        title={t('onboarding.pera_web_import.info.title')}
                        description={t('onboarding.pera_web_import.info.body')}
                    />
                </PWView>
            </PWScreen>

            <QRScannerView
                isVisible={isQRScannerVisible}
                onClose={handleCloseQRScanner}
                onSuccess={handleQRScannerSuccess}
                animationType='slide'
                title={t('onboarding.pera_web_import.info.scanner_title')}
            />
        </>
    )
}
