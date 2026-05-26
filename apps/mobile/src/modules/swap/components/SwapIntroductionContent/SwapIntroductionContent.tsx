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

import { PWButton, PWImage, PWText, PWView } from '@components/core'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Trans } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'

import swapIntroHero from '@assets/images/swap-intro-hero.png'

export const SwapIntroductionContent = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { resolve, dismiss } = useBottomSheetResult<'start'>()

    const handleTermsPress = () => {
        dismiss()
        pushWebView({
            url: config.swapSupportUrl,
        })
    }

    return (
        <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            testID='swap-intro-scroll'
        >
            <PWView style={styles.heroSection}>
                <PWImage
                    source={swapIntroHero}
                    style={styles.heroImage}
                    resizeMode='contain'
                />
            </PWView>

            <PWView style={styles.contentSection}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('swap.introduction.title')}
                </PWText>

                <PWText style={styles.description}>
                    {t('swap.introduction.description')}
                </PWText>

                <PWText style={styles.poweredBy}>
                    {t('swap.introduction.powered_by')}
                    <PWText style={styles.poweredByBrand}>
                        {t('swap.introduction.powered_by_brand')}
                    </PWText>
                </PWText>

                <PWButton
                    variant='primary'
                    title={t('swap.introduction.start_swapping')}
                    onPress={() => resolve('start')}
                    style={styles.startButton}
                    testID='swap-intro-start-button'
                />

                <PWText style={styles.termsText}>
                    <Trans
                        i18nKey='swap.introduction.terms_agreement'
                        components={[
                            <PWText
                                key='terms'
                                variant='link'
                                onPress={handleTermsPress}
                            />,
                        ]}
                    />
                </PWText>
            </PWView>
        </BottomSheetScrollView>
    )
}
