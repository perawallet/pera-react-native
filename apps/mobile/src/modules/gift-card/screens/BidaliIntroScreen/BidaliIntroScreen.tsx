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
    PWButton,
    PWIcon,
    PWImage,
    PWScrollView,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'

import bidaliBackground from '@assets/images/bidali-background.png'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useBidali } from '../../hooks/useBidali'
import type { BidaliStackParamList } from '../../routes/types'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'

const BG_IMAGE_ASPECT_RATIO = 0.784

export const BidaliIntroScreen = () => {
    const { width } = useWindowDimensions()
    const styles = useStyles()
    const { t } = useLanguage()
    const { onClose } = useBidali()
    const navigation =
        useNavigation<StackNavigationProp<BidaliStackParamList>>()

    const handleBuyGiftCards = () => {
        navigation.navigate('BidaliAccountSelection')
    }

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        variant='primary'
                        onPress={onClose}
                    />
                }
                center={
                    <PWText
                        variant='h4'
                        style={styles.toolbarTitle}
                    >
                        {t('giftCard.intro.navigation_title')}
                    </PWText>
                }
                paddingStyle='dense'
            />

            <PWScrollView>
                <PWView style={styles.heroSection}>
                    <PWView style={styles.heroImage}>
                        <PWImage
                            source={bidaliBackground}
                            width={width}
                            height={width * BG_IMAGE_ASPECT_RATIO}
                            resizeMode='contain'
                        />
                    </PWView>
                </PWView>

                <PWView style={styles.contentSection}>
                    <PWText variant='h1'>{t('giftCard.intro.title')}</PWText>

                    <PWText style={styles.description}>
                        {t('giftCard.intro.body')}
                    </PWText>
                </PWView>

                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('giftCard.intro.buy_gift_cards')}
                        onPress={handleBuyGiftCards}
                        testID='bidali_intro_buy_button'
                    />
                </PWView>
            </PWScrollView>
        </PWView>
    )
}
