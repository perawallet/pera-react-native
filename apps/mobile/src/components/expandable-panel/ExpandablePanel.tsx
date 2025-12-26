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

import PWIcon from '@components/icons/PWIcon'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import React, { PropsWithChildren, useState } from 'react'
import {
    View,
    StyleProp,
    ViewStyle,
    LayoutChangeEvent,
    GestureResponderEvent,
} from 'react-native'
import Animated, {
    useSharedValue,
    withTiming,
    useAnimatedStyle,
} from 'react-native-reanimated'
import { useStyles } from './styles'
import PWView from '@components/view/PWView'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'

type ExpandablePanelProps = {
    title: React.ReactNode
    iconPressed?: () => void
    containerStyle?: StyleProp<ViewStyle>
} & PropsWithChildren

export const CollapsableContainer = ({
    children,
    expanded,
}: {
    children: React.ReactNode
    expanded: boolean
}) => {
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
              })
            : withTiming(0, { duration: EXPANDABLE_PANEL_ANIMATION_DURATION })
        animatedOpacity.value = expanded
            ? withTiming(1, { duration: EXPANDABLE_PANEL_ANIMATION_DURATION })
            : withTiming(0, { duration: EXPANDABLE_PANEL_ANIMATION_DURATION })

        return {
            height: animatedHeight.value,
            opacity: animatedOpacity.value,
        }
    }, [expanded, height])

    return (
        <Animated.View style={[collapsableStyle, styles.collapsableContainer]}>
            <View
                style={styles.wrapper}
                onLayout={onLayout}
            >
                {children}
            </View>
        </Animated.View>
    )
}

export const ExpandablePanel = ({
    title,
    containerStyle,
    children,
    iconPressed,
}: ExpandablePanelProps) => {
    const [expanded, setExpanded] = useState(false)
    const styles = useStyles()
    const onPress = () => {
        setExpanded(!expanded)
    }

    const iconStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    rotate: withTiming(expanded ? '90deg' : '0deg', {
                        duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
                    }),
                },
            ],
        }
    }, [expanded])

    const handleIconPress = (event: GestureResponderEvent) => {
        if (iconPressed) {
            iconPressed()
            event.stopPropagation()
        }
    }

    return (
        <PWView style={containerStyle}>
            <PWTouchableOpacity
                onPress={onPress}
                style={styles.header}
            >
                {title}
                <Animated.View style={iconStyle}>
                    <PWIcon
                        name='chevron-right'
                        size='sm'
                        onPress={handleIconPress}
                    />
                </Animated.View>
            </PWTouchableOpacity>
            <CollapsableContainer expanded={expanded}>
                {children}
            </CollapsableContainer>
        </PWView>
    )
}
