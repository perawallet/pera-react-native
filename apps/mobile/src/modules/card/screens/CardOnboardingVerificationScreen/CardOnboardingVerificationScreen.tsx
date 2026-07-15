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
import { Trans } from 'react-i18next'
import {
    PWButton,
    PWIcon,
    PWImage,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import peraCardHeroLight from '@assets/images/pera-card-hero-light.png'
import peraCardHeroDark from '@assets/images/pera-card-hero-dark.png'
import baanxLogo from '@assets/images/baanx-logo.png'
import { useCardOnboardingVerificationScreen } from './useCardOnboardingVerificationScreen'
import { useStyles } from './styles'

export const CardOnboardingVerificationScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const isDarkMode = useIsDarkMode()
    const peraCardHero = isDarkMode ? peraCardHeroDark : peraCardHeroLight
    const { isBusy, handleVerify, handleLogout, handleOpenSupport } =
        useCardOnboardingVerificationScreen()

    return (
        <PWScreen
            testID='card-onboarding-verification'
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='secondary'
                        title={t('peraCard.verification.logout_button')}
                        onPress={handleLogout}
                        testID='card-onboarding-verification-logout'
                    />
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.contactText}
                    >
                        <Trans
                            i18nKey='peraCard.verification.contact_us'
                            components={[
                                <PWText
                                    key='link'
                                    variant='linkPositive'
                                    onPress={handleOpenSupport}
                                    testID='card-onboarding-verification-contact-link'
                                />,
                            ]}
                        />
                    </PWText>
                </PWView>
            }
        >
            <PWView style={styles.content}>
                <PWImage
                    source={peraCardHero}
                    style={styles.hero}
                    resizeMode='contain'
                />

                <PWView style={styles.poweredByRow}>
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.poweredByText}
                    >
                        {t('peraCard.intro.powered_by')}
                    </PWText>
                    <PWImage
                        source={baanxLogo}
                        style={styles.baanxLogo}
                        resizeMode='contain'
                    />
                </PWView>

                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('peraCard.verification.title')}
                </PWText>

                <PWView style={styles.callout}>
                    <PWView style={styles.calloutIcon}>
                        <PWIcon
                            name='shield-warning'
                            variant='favorite'
                        />
                    </PWView>
                    <PWView style={styles.calloutColumn}>
                        <PWView style={styles.calloutTexts}>
                            <PWText variant='bodyLarge'>
                                {t('peraCard.verification.callout_title')}
                            </PWText>
                            <PWText
                                variant='footnoteMedium'
                                weight={400}
                                style={styles.calloutBody}
                            >
                                {t('peraCard.verification.callout_body')}
                            </PWText>
                        </PWView>
                        <PWButton
                            variant='primary'
                            title={t('peraCard.verification.verify_button')}
                            onPress={handleVerify}
                            isDisabled={isBusy}
                            isLoading={isBusy}
                            testID='card-onboarding-verification-cta'
                        />
                    </PWView>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
