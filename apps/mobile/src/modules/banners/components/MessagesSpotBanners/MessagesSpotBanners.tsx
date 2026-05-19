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

import { memo } from 'react'
import Animated from 'react-native-reanimated'
import { SpotBannerCarousel } from '@modules/banners/components/SpotBannerCarousel'
import { PWView } from '@components/core'
import { useBannerReveal } from '../animations'
import { useStyles } from './styles'
import { useMessagesSpotBanners } from './useMessagesSpotBanners'

const MessagesSpotBannersComponent = () => {
    const styles = useStyles()
    const { isVisible, spotBanners, onPress, onDismiss } =
        useMessagesSpotBanners()
    const { animatedStyle, isMeasured, onMeasureLayout } = useBannerReveal()

    if (!isVisible) return null

    const content = (
        <SpotBannerCarousel
            banners={spotBanners}
            onPress={onPress}
            onDismiss={onDismiss}
            testID='messages_spot_banners'
        />
    )

    return (
        <>
            {!isMeasured && (
                <PWView
                    style={styles.measurer}
                    onLayout={onMeasureLayout}
                    pointerEvents='none'
                    aria-hidden
                >
                    {content}
                </PWView>
            )}
            <Animated.View style={[styles.wrapper, animatedStyle]}>
                {isMeasured && content}
            </Animated.View>
        </>
    )
}

export const MessagesSpotBanners = memo(MessagesSpotBannersComponent)
