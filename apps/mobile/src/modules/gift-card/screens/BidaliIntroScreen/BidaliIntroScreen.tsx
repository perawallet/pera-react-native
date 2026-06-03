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

import { useWindowDimensions } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
    PWButton,
    PWIcon,
    PWImage,
    PWSheetLayout,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import bidaliBackground from '@assets/images/bidali-background.png'
import { useBidali } from '../../hooks/useBidali'
import { useStyles } from './styles'

import type { StackNavigationProp } from '@react-navigation/stack'
import type { BidaliStackParamList } from '../../routes/types'

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
        <PWSheetLayout
            horizontalPadding='none'
            header={
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
            }
            footer={
                <PWButton
                    variant='primary'
                    title={t('giftCard.intro.buy_gift_cards')}
                    onPress={handleBuyGiftCards}
                    testID='bidali_intro_buy_button'
                />
            }
        >
            <PWView style={styles.heroImage}>
                <PWImage
                    source={bidaliBackground}
                    width={width}
                    height={width * BG_IMAGE_ASPECT_RATIO}
                    resizeMode='contain'
                />
            </PWView>
            <ScreenHeader
                style={styles.headerSection}
                title={t('giftCard.intro.title')}
                description={t('giftCard.intro.body')}
            />
        </PWSheetLayout>
    )
}
