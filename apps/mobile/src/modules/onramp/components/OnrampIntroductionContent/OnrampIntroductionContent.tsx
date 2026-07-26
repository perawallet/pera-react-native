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

import {
    PWButton,
    PWChip,
    PWImage,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { NumberedList } from '@components/NumberedList'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import onrampIntroHeroLight from '@assets/images/onramp-intro-hero-light.png'
import onrampIntroHeroDark from '@assets/images/onramp-intro-hero-dark.png'
import { useStyles } from './styles'

const FEATURE_KEYS = [
    'onramp.introduction.feature_buy',
    'onramp.introduction.feature_swap',
    'onramp.introduction.feature_portal',
] as const

export const OnrampIntroductionContent = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const isDarkMode = useIsDarkMode()
    const { resolve } = useBottomSheetResult<'start'>()

    return (
        <PWScrollView
            inBottomSheet
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            testID='onramp-intro-scroll'
        >
            <PWImage
                source={isDarkMode ? onrampIntroHeroDark : onrampIntroHeroLight}
                style={styles.heroImage}
                // 'contain' matches the box's aspectRatio (327/222) to the
                // image on native, so this is a no-op there — it only
                // matters on web, where styles.web.ts caps heroImage's
                // height below that ratio to fit the popup; without this,
                // the default 'cover' would crop the illustration instead of
                // letterboxing it.
                resizeMode='contain'
            />

            <PWView style={styles.contentSection}>
                <PWView style={styles.header}>
                    <PWChip
                        title={t('onramp.introduction.new_chip')}
                        variant='helper'
                        paddingStyle='dense'
                        style={styles.newChip}
                    />
                    <PWText
                        variant='h3'
                        style={styles.title}
                    >
                        {t('onramp.introduction.title')}
                    </PWText>
                </PWView>

                <NumberedList
                    items={FEATURE_KEYS.map(key => t(key))}
                    textVariant='body'
                    testID='onramp-intro-features'
                />

                <PWButton
                    variant='primary'
                    title={t('onramp.introduction.continue')}
                    onPress={() => resolve('start')}
                    style={styles.startButton}
                    testID='onramp-intro-start-button'
                />
            </PWView>
        </PWScrollView>
    )
}
