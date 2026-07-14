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

import { memo } from 'react'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CompactBanner } from '@modules/banners/components/CompactBanner'
import { PWView } from '@components/core'
import { useBannerReveal } from '../animations'
import { useHomeBannersStrip } from './useHomeBannersStrip'
import { useStyles } from './styles'

const HomeBannersStripComponent = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { isVisible, current, additionalCount, onPress } =
        useHomeBannersStrip()
    const { animatedStyle, progress, isMeasured, onMeasureLayout } =
        useBannerReveal()

    const insetOverlayStyle = useAnimatedStyle(() => ({
        opacity: 1 - progress.value,
    }))

    if (!isVisible || !current) return null

    const content = (
        <CompactBanner
            primary={current}
            additionalCount={additionalCount}
            onPress={onPress}
            testID='home_banners_strip'
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
            <PWView style={styles.wrapper}>
                <Animated.View style={[styles.inner, animatedStyle]}>
                    {isMeasured && content}
                </Animated.View>
                <Animated.View
                    style={[styles.insetOverlay, insetOverlayStyle]}
                    pointerEvents='none'
                />
            </PWView>
        </>
    )
}

export const HomeBannersStrip = memo(HomeBannersStripComponent)
