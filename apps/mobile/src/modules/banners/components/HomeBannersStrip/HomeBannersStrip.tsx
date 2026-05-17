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
import { CompactBanner } from '@modules/banners/components/CompactBanner'
import { PWView } from '@components/core'
import { useBannerReveal } from '../animations'
import { useHomeBannersStrip } from './useHomeBannersStrip'
import { useStyles } from './styles'

const HomeBannersStripComponent = () => {
    const styles = useStyles()
    const { isVisible, current, additionalCount, onPress } =
        useHomeBannersStrip()
    const { animatedStyle, isMeasured, onMeasureLayout } = useBannerReveal()

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
            <Animated.View style={[styles.wrapper, animatedStyle]}>
                {isMeasured && content}
            </Animated.View>
        </>
    )
}

export const HomeBannersStrip = memo(HomeBannersStripComponent)
