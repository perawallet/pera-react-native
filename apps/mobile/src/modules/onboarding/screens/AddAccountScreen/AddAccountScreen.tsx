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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    PWIcon,
    PWImage,
    PWLoadingOverlay,
    PWScrollView,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { ImportOptionsBottomSheet } from '../OnboardingScreen/ImportOptionsBottomSheet'
import { useAddAccountScreen } from './useAddAccountScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { Trans } from 'react-i18next'

import welcomeBackground from '@assets/images/welcome-background.webp'

export const AddAccountScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const {
        isCreatingAccount,
        isImportOptionsVisible,
        mainOptions,
        otherOptions,
        handleClose,
        handleCloseImportOptions,
        handleHDWalletPress,
        handleAlgo25Press,
        handleTermsPress,
        handlePrivacyPress,
        isOtherOptionsVisible,
        handleToggleOtherOptions,
    } = useAddAccountScreen()

    return (
        <>
            <PWView style={styles.imageContainer}>
                <PWImage
                    source={welcomeBackground}
                    style={styles.headerImage}
                />
            </PWView>
            <PWView style={[styles.rootContainer, { paddingTop: insets.top }]}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={handleClose}
                            testID='add_account_close_button'
                        />
                    }
                />

                <PWView style={styles.headerContainer}>
                    <PWText
                        variant='h1'
                        style={styles.headerTitle}
                    >
                        {t('onboarding.add_account.title')}
                    </PWText>
                </PWView>

                <PWScrollView contentContainerStyle={styles.scrollContent}>
                    <PWView style={styles.mainContainer}>
                        {mainOptions.map(option => (
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
                        ))}

                        {isOtherOptionsVisible &&
                            otherOptions.map(option => (
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
                            ))}
                    </PWView>

                    {!isOtherOptionsVisible && (
                        <PWTouchableOpacity
                            style={styles.otherOptionsButton}
                            onPress={handleToggleOtherOptions}
                            testID='add_account_see_other_options_button'
                        >
                            <PWView style={styles.otherOptionsIconWrapper}>
                                <PWIcon name='chevron-down' />
                            </PWView>
                            <PWText variant='h4'>
                                {t('onboarding.add_account.see_other_options')}
                            </PWText>
                        </PWTouchableOpacity>
                    )}

                    <PWView style={styles.footerContainer}>
                        <PWText style={styles.termsAndPrivacyText}>
                            <Trans
                                i18nKey='onboarding.add_account.terms_and_privacy'
                                components={[
                                    <PWText
                                        key='terms'
                                        variant='link'
                                        onPress={handleTermsPress}
                                    />,
                                    <PWText
                                        key='privacy'
                                        variant='link'
                                        onPress={handlePrivacyPress}
                                    />,
                                ]}
                            />
                        </PWText>
                    </PWView>
                </PWScrollView>
            </PWView>

            <ImportOptionsBottomSheet
                isVisible={isImportOptionsVisible}
                onClose={handleCloseImportOptions}
                onHDWalletPress={handleHDWalletPress}
                onAlgo25Press={handleAlgo25Press}
            />

            <PWLoadingOverlay
                isVisible={isCreatingAccount}
                title={t('onboarding.create_account.processing')}
            />
        </>
    )
}
