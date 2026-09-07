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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    PWIcon,
    PWImage,
    PWLoadingOverlay,
    PWScreen,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { ScreenHeader } from '@components/ScreenHeader'
import { useAddAccountScreen } from './useAddAccountScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { Trans } from 'react-i18next'
import { MultisigIntroductionDialog } from '@modules/multisig/components/MultisigIntroductionDialog'
import type { AccountOption } from '@modules/onboarding/types'

import welcomeBackground from '@assets/images/welcome-background.webp'

export const AddAccountScreen = () => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const {
        isCreatingAccount,
        creatingTitleKey,
        mainOptions,
        otherOptions,
        handleClose,
        handleTermsPress,
        handlePrivacyPress,
        isMultisigIntroductionVisible,
        handleCloseMultisigIntroduction,
        handleContinueMultisigIntroduction,
        isOtherOptionsVisible,
        handleToggleOtherOptions,
    } = useAddAccountScreen()

    // Single render path for both option lists so their prop wiring (badge,
    // learn-more, etc.) can never drift apart.
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
            badge={
                option.badge && {
                    label: t(option.badge.labelKey),
                    variant: option.badge.variant,
                }
            }
            learnMore={
                option.learnMore && {
                    label: t(option.learnMore.labelKey),
                    onPress: option.learnMore.onPress,
                }
            }
        />
    )

    return (
        <>
            <PWView style={styles.imageContainer}>
                <PWImage
                    source={welcomeBackground}
                    style={styles.headerImage}
                />
            </PWView>
            <PWScreen
                horizontalPadding='none'
                style={styles.screen}
            >
                <PWView style={styles.scrollContent}>
                    <PWToolbar
                        left={
                            <PWIcon
                                name='cross'
                                onPress={handleClose}
                                testID='add_account_close_button'
                            />
                        }
                    />

                    <ScreenHeader
                        title={t('onboarding.add_account.title')}
                        style={styles.header}
                    />

                    <PWView style={styles.mainContainer}>
                        {mainOptions.map(renderOption)}

                        {isOtherOptionsVisible &&
                            otherOptions.map(renderOption)}
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
                </PWView>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isCreatingAccount}
                title={t(creatingTitleKey)}
            />

            <MultisigIntroductionDialog
                isVisible={isMultisigIntroductionVisible}
                onDismiss={handleCloseMultisigIntroduction}
                onContinue={handleContinueMultisigIntroduction}
            />
        </>
    )
}
