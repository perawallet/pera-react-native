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
import { PWLoadingOverlay, PWScreen, PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { ScreenHeader } from '@components/ScreenHeader'
import { QRScannerView } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import type { AccountOption } from '@modules/onboarding/types'
import { SeeOtherOptionsButton } from '../../components/SeeOtherOptionsButton'
import { useImportAccountOptionsScreen } from './useImportAccountOptionsScreen'
import { useStyles } from './styles'

export const ImportAccountOptionsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        titleKey,
        mainOptions,
        otherOptions,
        isOtherOptionsVisible,
        handleToggleOtherOptions,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
        isReadingCredentials,
    } = useImportAccountOptionsScreen()

    const renderOption = (option: AccountOption) => (
        <PanelButton
            key={option.testID}
            testID={option.testID}
            title={t(option.titleKey)}
            description={t(option.descriptionKey)}
            titleWeight='h3'
            leftIcon={option.leftIcon}
            onPress={option.onPress}
            disabled={option.isDisabled}
        />
    )

    return (
        <>
            <PWScreen>
                <ScreenHeader title={t(titleKey)} />
                <PWView style={styles.mainContainer}>
                    {mainOptions.map(renderOption)}
                    {isOtherOptionsVisible && otherOptions.map(renderOption)}
                </PWView>
                {!isOtherOptionsVisible && otherOptions.length > 0 && (
                    <SeeOtherOptionsButton
                        onPress={handleToggleOtherOptions}
                        testID='import_account_options_see_other_options_button'
                    />
                )}
            </PWScreen>

            <QRScannerView
                isVisible={isQRScannerVisible}
                onClose={handleCloseQRScanner}
                onSuccess={handleQRScannerSuccess}
                animationType='slide'
                skipDeepLinkHandler
            />

            <PWLoadingOverlay
                isVisible={isReadingCredentials}
                title={t('cloud_backup.restore.import_reading')}
            />
        </>
    )
}
