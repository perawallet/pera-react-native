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

import { useEffect, useMemo, useRef } from 'react'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    useAnimatedReaction,
} from 'react-native-reanimated'
import { useStyles } from './styles'
import { PWView } from '../PWView'

export type PWPinCirclesProps = {
    length: number
    filledCount: number
    hasError?: boolean
    onShakeComplete?: () => void
}

export const PWPinCircles = ({
    length,
    filledCount,
    hasError = false,
    onShakeComplete,
}: PWPinCirclesProps) => {
    const styles = useStyles()
    const translateX = useSharedValue(0)
    const isShaking = useSharedValue(false)
    const onShakeCompleteRef = useRef(onShakeComplete)
    onShakeCompleteRef.current = onShakeComplete

    // Detect when shake animation completes (translateX returns to 0 after shaking)
    useAnimatedReaction(
        () => ({ x: translateX.value, shaking: isShaking.value }),
        () => {},
    )

    useEffect(() => {
        if (hasError) {
            isShaking.value = true
            translateX.value = withSequence(
                withTiming(10, { duration: 50 }),
                withTiming(-10, { duration: 50 }),
                withTiming(10, { duration: 50 }),
                withTiming(-10, { duration: 50 }),
                withTiming(0, { duration: 50 }),
            )
            // Use a timeout matching the animation duration to trigger callback
            const timeout = setTimeout(() => {
                isShaking.value = false
                onShakeCompleteRef.current?.()
            }, 250)
            return () => clearTimeout(timeout)
        }
    }, [hasError, translateX, isShaking])

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }))

    const circles = useMemo(
        () =>
            Array.from({ length }, (_, index) => {
                const isFilled = index < filledCount

                return (
                    <PWView
                        key={index}
                        style={[
                            styles.circle,
                            isFilled && styles.circleFilled,
                            hasError && styles.circleError,
                        ]}
                    />
                )
            }),
        [
            length,
            filledCount,
            hasError,
            styles.circle,
            styles.circleFilled,
            styles.circleError,
        ],
    )

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            {circles}
        </Animated.View>
    )
}
