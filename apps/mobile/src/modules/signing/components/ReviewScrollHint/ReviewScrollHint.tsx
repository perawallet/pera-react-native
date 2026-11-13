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

import { useEffect, useRef } from 'react'
import Animated, {
    cancelAnimation,
    Easing,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated'
import { PWIcon, PWTouchableOpacity } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

// A few nudges, not a loop: it is a cue, and it stays put once given.
const PULSE_COUNT = 3
const PULSE_MS = 450
const PULSE_DISTANCE = 4
// How far the ring grows past the chip before it fades out.
const RING_SCALE = 1.9
const RING_OPACITY = 0.6

export type ReviewScrollHintProps = {
    isVisible: boolean
    onPress: () => void
}

export const ReviewScrollHint = ({
    isVisible,
    onPress,
}: ReviewScrollHintProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isReducedMotion = useReducedMotion()
    const offset = useSharedValue(0)
    const ripple = useSharedValue(1)
    // The cue plays once per review; scrolling back up shows the chevron still.
    const hasPlayedRef = useRef(false)

    useEffect(() => {
        if (!isVisible || isReducedMotion || hasPlayedRef.current) {
            cancelAnimation(offset)
            cancelAnimation(ripple)
            offset.value = 0
            ripple.value = 1
            return
        }
        hasPlayedRef.current = true
        offset.value = withRepeat(
            withSequence(
                withTiming(PULSE_DISTANCE, { duration: PULSE_MS }),
                withTiming(0, { duration: PULSE_MS }),
            ),
            PULSE_COUNT,
        )
        ripple.value = 0
        ripple.value = withRepeat(
            withTiming(1, {
                duration: PULSE_MS * 2,
                easing: Easing.out(Easing.quad),
            }),
            PULSE_COUNT,
        )
    }, [isVisible, isReducedMotion, offset, ripple])

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: offset.value }],
    }))

    // A ring that grows out of the chip and fades: the bounce alone is easy to miss.
    const ringStyle = useAnimatedStyle(() => ({
        opacity: interpolate(ripple.value, [0, 1], [RING_OPACITY, 0]),
        transform: [
            { scale: interpolate(ripple.value, [0, 1], [1, RING_SCALE]) },
        ],
    }))

    if (!isVisible) return null

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            accessibilityRole='button'
            accessibilityLabel={t('signing.review.scroll_hint')}
            testID='review_scroll_hint'
        >
            <Animated.View style={[styles.chip, animatedStyle]}>
                <Animated.View
                    pointerEvents='none'
                    style={[styles.ring, ringStyle]}
                />
                <PWIcon
                    name='chevron-down'
                    size='sm'
                    variant='secondary'
                />
            </Animated.View>
        </PWTouchableOpacity>
    )
}
