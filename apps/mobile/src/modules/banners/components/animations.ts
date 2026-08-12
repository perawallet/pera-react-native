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

import { useEffect, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'
import {
    Easing,
    type SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated'
import {
    BANNER_REVEAL_DELAY_MS,
    BANNER_REVEAL_DURATION_MS,
} from '@constants/ui'

export const BANNER_REVEAL_EASING = Easing.inOut(Easing.quad)

export type BannerRevealResult = {
    animatedStyle: ReturnType<typeof useAnimatedStyle>
    // 0 → 1 over the reveal. Exposed so callers can drive sibling animations
    // (e.g. a safe-area overlay fade) in lockstep with the height animation.
    progress: SharedValue<number>
    isMeasured: boolean
    onMeasureLayout: (event: LayoutChangeEvent) => void
}

export type BannerRevealOptions = {
    /** Pause before the reveal starts. Defaults to `BANNER_REVEAL_DELAY_MS`. */
    delayMs?: number
    /** Length of the reveal. Defaults to `BANNER_REVEAL_DURATION_MS`. */
    durationMs?: number
}

// Off-screen measurement of the natural height drives a shared-value height
// animation. `values.targetHeight` via `entering={...}` didn't propagate
// parent reflow when content had a fixed pager height.
export const useBannerReveal = ({
    delayMs = BANNER_REVEAL_DELAY_MS,
    durationMs = BANNER_REVEAL_DURATION_MS,
}: BannerRevealOptions = {}): BannerRevealResult => {
    const [measuredHeight, setMeasuredHeight] = useState(0)
    const height = useSharedValue(0)
    const opacity = useSharedValue(0)
    const progress = useSharedValue(0)

    useEffect(() => {
        if (measuredHeight <= 0) return
        height.value = withDelay(
            delayMs,
            withTiming(measuredHeight, {
                duration: durationMs,
                easing: BANNER_REVEAL_EASING,
            }),
        )
        opacity.value = withDelay(
            delayMs,
            withTiming(1, {
                duration: durationMs,
                easing: BANNER_REVEAL_EASING,
            }),
        )
        progress.value = withDelay(
            delayMs,
            withTiming(1, {
                duration: durationMs,
                easing: BANNER_REVEAL_EASING,
            }),
        )
    }, [measuredHeight, height, opacity, progress, delayMs, durationMs])

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
        opacity: opacity.value,
    }))

    const onMeasureLayout = (event: LayoutChangeEvent) => {
        if (measuredHeight !== 0) return
        const h = event.nativeEvent.layout.height
        if (h > 0) setMeasuredHeight(h)
    }

    return {
        animatedStyle,
        progress,
        isMeasured: measuredHeight > 0,
        onMeasureLayout,
    }
}
