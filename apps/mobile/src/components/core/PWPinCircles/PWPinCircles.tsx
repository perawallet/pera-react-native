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

import { View, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { useStyles } from './styles'

export type PinCircleState = 'empty' | 'filled' | 'error'

export type PWPinCirclesProps = {
    length: number
    filledCount: number
    state?: PinCircleState
    onShakeComplete?: () => void
}

export const PWPinCircles = ({
    length,
    filledCount,
    state = filledCount > 0 ? 'filled' : 'empty',
    onShakeComplete,
}: PWPinCirclesProps) => {
    const styles = useStyles()
    const shakeAnimation = useRef(new Animated.Value(0)).current

    useEffect(() => {
        if (state === 'error') {
            Animated.sequence([
                Animated.timing(shakeAnimation, {
                    toValue: 10,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnimation, {
                    toValue: -10,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnimation, {
                    toValue: 10,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnimation, {
                    toValue: -10,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnimation, {
                    toValue: 0,
                    duration: 50,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onShakeComplete?.()
            })
        }
    }, [state, shakeAnimation, onShakeComplete])

    const circles = Array.from({ length }, (_, index) => {
        const isFilled = index < filledCount
        const isError = state === 'error'

        return (
            <View
                key={index}
                style={[
                    styles.circle,
                    isFilled && styles.circleFilled,
                    isError && styles.circleError,
                ]}
            />
        )
    })

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateX: shakeAnimation }] },
            ]}
        >
            {circles}
        </Animated.View>
    )
}
