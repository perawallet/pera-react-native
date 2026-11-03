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

import { useEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent, ViewStyle } from 'react-native'
import {
    useSharedValue,
    withTiming,
    useAnimatedStyle,
    runOnJS,
    type AnimatedStyle,
} from 'react-native-reanimated'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    EXPANDABLE_PANEL_ANIMATION_DURATION,
    EXPANDABLE_PANEL_ANIMATION_EASING,
} from '@constants/ui'

export type UseExpandablePanelParams = {
    isExpanded: boolean
    onStateChangeEnd?: (isExpanded: boolean) => void
}

export type UseExpandablePanelResult = {
    collapsableStyle: AnimatedStyle<ViewStyle>
    onLayout: (event: LayoutChangeEvent) => void
}

export const useExpandablePanel = ({
    isExpanded,
    onStateChangeEnd,
}: UseExpandablePanelParams): UseExpandablePanelResult => {
    const [height, setHeight] = useState(0)
    const animatedHeight = useSharedValue(0)
    const animatedOpacity = useSharedValue(isExpanded ? 1 : 0)
    // The content's height is only known after its first layout, so until the
    // panel is toggled it snaps there: a list cell remounting already expanded
    // would otherwise grow open again each time it scrolls into view. Null once
    // toggled.
    const untoggledState = useRef<Nullable<boolean>>(isExpanded)

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
        if (isExpanded !== untoggledState.current) untoggledState.current = null
        if (untoggledState.current !== null) {
            animatedHeight.value = targetHeight
            animatedOpacity.value = targetOpacity
            return
        }
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

    return { collapsableStyle, onLayout }
}
