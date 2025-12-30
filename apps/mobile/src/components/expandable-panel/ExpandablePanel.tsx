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

import React, { PropsWithChildren, useState } from 'react'
import {
    View,
    StyleProp,
    ViewStyle,
    LayoutChangeEvent,
} from 'react-native'
import Animated, {
    useSharedValue,
    withTiming,
    useAnimatedStyle,
} from 'react-native-reanimated'
import { useStyles } from './styles'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'

type ExpandablePanelProps = {
    expanded: boolean
    containerStyle?: StyleProp<ViewStyle>
    onStateChangeEnd?: (expanded: boolean) => void
} & PropsWithChildren

const ExpandablePanel = ({
    children,
    expanded,
    onStateChangeEnd,
    containerStyle,
}: ExpandablePanelProps) => {
    const [height, setHeight] = useState(0)
    const animatedHeight = useSharedValue(0)
    const animatedOpacity = useSharedValue(0)
    const styles = useStyles()

    const onLayout = (event: LayoutChangeEvent) => {
        const onLayoutHeight = event.nativeEvent.layout.height

        if (onLayoutHeight > 0 && height !== onLayoutHeight) {
            setHeight(onLayoutHeight)
        }
    }

    const collapsableStyle = useAnimatedStyle(() => {
        animatedHeight.value = expanded
            ? withTiming(height, {
                duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
            }, () => onStateChangeEnd?.(expanded))
            : withTiming(0, { duration: EXPANDABLE_PANEL_ANIMATION_DURATION }, () => onStateChangeEnd?.(expanded))
        animatedOpacity.value = expanded
            ? withTiming(1, { duration: EXPANDABLE_PANEL_ANIMATION_DURATION })
            : withTiming(0, { duration: EXPANDABLE_PANEL_ANIMATION_DURATION })

        return {
            height: animatedHeight.value,
            opacity: animatedOpacity.value,
        }
    }, [expanded, height])

    return (
        <Animated.View style={[collapsableStyle, containerStyle]}>
            <View
                style={styles.wrapper}
                onLayout={onLayout}
                pointerEvents={expanded ? 'auto' : 'none'}
            >
                {children}
            </View>
        </Animated.View>
    )
}

export default ExpandablePanel
