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

import { SLIDE_ANIMATION_DURATION } from '@constants/ui'
import React, { PropsWithChildren, useEffect } from 'react'
import { Dimensions, StyleProp, ViewStyle } from 'react-native'
import Animated, {
    useSharedValue,
    withTiming,
    useAnimatedStyle,
    Easing,
} from 'react-native-reanimated'

const SCREEN_WIDTH = Dimensions.get('window').width

export type SlideViewProps = {
    isVisible: boolean
    direction?: 'left' | 'right'
    style?: StyleProp<ViewStyle>
} & PropsWithChildren

export const SlideView = ({
    children,
    isVisible,
    direction = 'right',
    style,
}: SlideViewProps) => {
    const translateX = useSharedValue(
        direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH,
    )

    useEffect(() => {
        const targetValue = isVisible
            ? 0
            : direction === 'right'
              ? SCREEN_WIDTH
              : -SCREEN_WIDTH

        translateX.value = withTiming(targetValue, {
            duration: SLIDE_ANIMATION_DURATION,
            easing: Easing.out(Easing.cubic),
        })
    }, [isVisible, direction, translateX])

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        }
    })

    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
            {children}
        </Animated.View>
    )
}
