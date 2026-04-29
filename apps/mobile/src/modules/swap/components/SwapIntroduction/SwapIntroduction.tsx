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

import {
    PWBottomSheet,
    PWButton,
    PWImage,
    PWText,
    PWView,
} from '@components/core'
import { Trans } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useStyles } from './styles'

import swapIntroHero from '@assets/images/swap-intro-hero.png'

export type SwapIntroductionProps = {
    isVisible: boolean
    onStartSwapping: () => void
    onClose: () => void
}

export const SwapIntroduction = ({
    isVisible,
    onStartSwapping,
    onClose,
}: SwapIntroductionProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const handleTermsPress = () => {
        onClose()
        pushWebView({
            url: config.swapSupportUrl,
        })
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.sheetContainer}
            enablePanDownToClose
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
                    onPress={onStartSwapping}
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
        </PWBottomSheet>
    )
}
