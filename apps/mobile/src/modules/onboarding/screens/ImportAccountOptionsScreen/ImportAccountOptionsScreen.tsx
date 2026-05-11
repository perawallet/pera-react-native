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
import {
    PWLoadingOverlay,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { QRScannerView } from '@components/QRScannerView'
import { ImportOptionsBottomSheet } from '../../components/ImportOptionsBottomSheet'
import { useLanguage } from '@hooks/useLanguage'
import { useImportAccountOptionsScreen } from './useImportAccountOptionsScreen'
import { useStyles } from './styles'

export const ImportAccountOptionsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        options,
        isImportOptionsVisible,
        handleCloseImportOptions,
        handleHDWalletPress,
        handleAlgo25Press,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
        isImporting,
    } = useImportAccountOptionsScreen()

    return (
        <>
            <PWView style={styles.rootContainer}>
                <PWView style={styles.headerContainer}>
                    <PWText
                        variant='h1'
                        style={styles.headerTitle}
                    >
                        {t('onboarding.import_account_options.title')}
                    </PWText>
                </PWView>

                <PWScrollView contentContainerStyle={styles.scrollContent}>
                    <PWView style={styles.mainContainer}>
                        {options.map(option => (
                            <PanelButton
                                key={option.testID}
                                testID={option.testID}
                                title={t(option.titleKey)}
                                description={t(option.descriptionKey)}
                                titleWeight='h3'
                                leftIcon={option.leftIcon}
                                onPress={option.onPress}
                            />
                        ))}
                    </PWView>
                </PWScrollView>
            </PWView>

            <ImportOptionsBottomSheet
                isVisible={isImportOptionsVisible}
                onClose={handleCloseImportOptions}
                onHDWalletPress={handleHDWalletPress}
                onAlgo25Press={handleAlgo25Press}
            />

            <QRScannerView
                isVisible={isQRScannerVisible}
                onClose={handleCloseQRScanner}
                onSuccess={handleQRScannerSuccess}
                animationType='slide'
            />

            <PWLoadingOverlay
                isVisible={isImporting}
                title={t('onboarding.create_account.processing')}
            />
        </>
    )
}
