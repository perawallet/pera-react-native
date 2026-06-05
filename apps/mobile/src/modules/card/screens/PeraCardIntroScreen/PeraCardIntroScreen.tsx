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
import { PWButton, PWImage, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
// TODO(card): swap in the reworked hero asset — current one has a baked-in gradient that clashes with the dark background
import peraCardHero from '@assets/images/pera-card-hero.png'
import baanxLogo from '@assets/images/baanx-logo.png'
import { usePeraCardIntroScreen } from './usePeraCardIntroScreen'
import { useStyles } from './styles'

export const PeraCardIntroScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { handleCreateAccount, handleAlreadyHaveAccount, handleLearnMore } =
        usePeraCardIntroScreen()

    return (
        <PWScreen
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('peraCard.intro.create_account')}
                        onPress={handleCreateAccount}
                        testID='pera_card_intro_create_button'
                    />
                    <PWButton
                        variant='secondary'
                        title={t('peraCard.intro.already_have_account')}
                        onPress={handleAlreadyHaveAccount}
                        testID='pera_card_intro_login_button'
                    />
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
                    {t('peraCard.intro.title')}
                </PWText>

                <PWText
                    variant='bodyLarge'
                    style={styles.body}
                >
                    {t('peraCard.intro.body')}
                </PWText>

                <PWText
                    variant='link'
                    onPress={handleLearnMore}
                    style={styles.learnMore}
                    testID='pera_card_intro_learn_more'
                >
                    {t('peraCard.intro.learn_more')}
                </PWText>
            </PWView>
        </PWScreen>
    )
}
