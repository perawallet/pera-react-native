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

import { useEffect } from 'react'
import {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
    type AnimatedStyle,
} from 'react-native-reanimated'
import { useTheme } from '@rneui/themed'
import {
    BANNER_REVEAL_DELAY_MS,
    BANNER_REVEAL_DURATION_MS,
} from '@constants/ui'
import { BANNER_REVEAL_EASING } from '@modules/banners/components/animations'

export type UseAccountScreenAnimationResult = {
    animatedCornerStyle: AnimatedStyle
}

// Animates the content view's top-corner radius from 0 → borderRadius.lg in
// lockstep with the home banner reveal (same delay + duration + easing).
export const useAccountScreenAnimation = (
    hasHomeBanner: boolean,
): UseAccountScreenAnimationResult => {
    const { theme } = useTheme()
    const targetCornerRadius = theme.borderRadius.lg
    const cornerProgress = useSharedValue(0)

    useEffect(() => {
        if (hasHomeBanner) {
            cornerProgress.value = withDelay(
                BANNER_REVEAL_DELAY_MS,
                withTiming(1, {
                    duration: BANNER_REVEAL_DURATION_MS,
                    easing: BANNER_REVEAL_EASING,
                }),
            )
        } else {
            cornerProgress.value = 0
        }
    }, [hasHomeBanner, cornerProgress])

    const animatedCornerStyle = useAnimatedStyle(() => {
        const radius = targetCornerRadius * cornerProgress.value
        return {
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
        }
    })

    return { animatedCornerStyle }
}
