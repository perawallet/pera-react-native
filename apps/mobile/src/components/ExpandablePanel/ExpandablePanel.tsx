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

import { PWView } from '@components/core'
import React, { type PropsWithChildren, useEffect, useState } from 'react'
import {
    type StyleProp,
    type ViewStyle,
    type LayoutChangeEvent,
} from 'react-native'
import Animated, {
    useSharedValue,
    withTiming,
    useAnimatedStyle,
    runOnJS,
} from 'react-native-reanimated'
import { useStyles } from './styles'
import {
    EXPANDABLE_PANEL_ANIMATION_DURATION,
    EXPANDABLE_PANEL_ANIMATION_EASING,
} from '@constants/ui'

export type ExpandablePanelProps = {
    isExpanded: boolean
    containerStyle?: StyleProp<ViewStyle>
    onStateChangeEnd?: (isExpanded: boolean) => void
} & PropsWithChildren

export const ExpandablePanel = ({
    children,
    isExpanded,
    onStateChangeEnd,
    containerStyle,
}: ExpandablePanelProps) => {
    const [height, setHeight] = useState(0)
    // Initialise the shared values so the very first render (before the
    // expanded-target effect fires) shows the correct state — important when
    // the panel is mounted already expanded and we need it visible
    // synchronously rather than animating in from collapsed.
    const animatedHeight = useSharedValue(isExpanded ? height : 0)
    const animatedOpacity = useSharedValue(isExpanded ? 1 : 0)
    const styles = useStyles()

    const onLayout = (event: LayoutChangeEvent) => {
        const onLayoutHeight = event.nativeEvent.layout.height
        if (onLayoutHeight > 0 && height !== onLayoutHeight) {
            setHeight(onLayoutHeight)
        }
    }

    // Drive the animation from a side effect so the worklet inside
    // useAnimatedStyle is a pure projection of shared values — never
    // mutating them during render. Mutating inside useAnimatedStyle was
    // re-firing withTiming on every parent render (e.g. when a bottom
    // sheet portal mounted), occasionally leaving the panel at height=0.
    useEffect(() => {
        const targetHeight = isExpanded ? height : 0
        const targetOpacity = isExpanded ? 1 : 0
        animatedHeight.value = withTiming(
            targetHeight,
            {
                duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
                easing: EXPANDABLE_PANEL_ANIMATION_EASING,
            },
            finished => {
                'worklet'
                if (finished && onStateChangeEnd) {
                    runOnJS(onStateChangeEnd)(isExpanded)
                }
            },
        )
        animatedOpacity.value = withTiming(targetOpacity, {
            duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
            easing: EXPANDABLE_PANEL_ANIMATION_EASING,
        })
    }, [isExpanded, height, animatedHeight, animatedOpacity, onStateChangeEnd])

    const collapsableStyle = useAnimatedStyle(() => ({
        height: animatedHeight.value,
        opacity: animatedOpacity.value,
    }))

    return (
        <Animated.View
            style={[
                styles.collapsableContainer,
                collapsableStyle,
                containerStyle,
            ]}
        >
            <PWView
                style={styles.wrapper}
                onLayout={onLayout}
                pointerEvents={isExpanded ? 'auto' : 'none'}
            >
                {children}
            </PWView>
        </Animated.View>
    )
}
