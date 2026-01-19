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

import React, { useCallback } from 'react'
import { useIsCreatingAccount } from '@modules/onboarding/hooks'
import { useStyles } from './styles'
import { PWImage, PWText, PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { useAppNavigation } from '@hooks/useAppNavigation'

import welcomeBackground from '@assets/images/welcome-background.webp'
import { useLanguage } from '@hooks/useLanguage'
import { Trans } from 'react-i18next'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'

export const OnboardingScreen = () => {
    const navigation = useAppNavigation()
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { setIsCreatingAccount } = useIsCreatingAccount()

    const handleTermsPress = () => {
        pushWebView({
            url: config.termsOfServiceUrl,
            id: 'terms-of-service',
        })
    }

    const handlePrivacyPress = () => {
        pushWebView({
            url: config.privacyPolicyUrl,
            id: 'privacy-policy',
        })
    }

    const handleCreateAccount = useCallback(() => {
        setIsCreatingAccount(true)
        navigation.push('NameAccount')
    }, [navigation, setIsCreatingAccount])

    const handleImportAccount = useCallback(() => {
        setIsCreatingAccount(true)
        navigation.push('ImportAccount')
    }, [navigation, setIsCreatingAccount])

    return (
        <>
            <PWView style={styles.rootContainer}>
                <PWView style={styles.headerContainer}>
                    <PWText
                        style={styles.headerTitle}
                        variant='h1'
                    >
                        {t('onboarding.main_screen.welcome')}
                    </PWText>
                    <PWImage
                        source={welcomeBackground}
                        style={styles.headerImage}
                    />
                </PWView>
                <PWView style={styles.mainContainer}>
                    <PWText
                        style={styles.buttonTitle}
                        variant='h4'
                    >
                        {t('onboarding.main_screen.new_to_algo')}
                    </PWText>
                    <PanelButton
                        title={t('onboarding.main_screen.create_wallet')}
                        titleWeight='h4'
                        onPress={handleCreateAccount}
                        leftIcon={'wallet-with-algo'}
                        rightIcon={'chevron-right'}
                    />

                    <PWText
                        style={styles.buttonTitle}
                        variant='h4'
                    >
                        {t('onboarding.main_screen.already_have_account')}
                    </PWText>
                    <PanelButton
                        title={t('onboarding.main_screen.import_account')}
                        titleWeight='h4'
                        onPress={handleImportAccount}
                        leftIcon={'key'}
                        rightIcon={'chevron-right'}
                    />
                </PWView>

                <PWView style={styles.footerContainer}>
                    <PWText style={styles.termsAndPrivacyText}>
                        <Trans
                            i18nKey='onboarding.main_screen.terms_and_privacy'
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
        </>
    )
}
