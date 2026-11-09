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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import React, { type PropsWithChildren, useState } from 'react'
import type { StyleProp, ViewStyle, GestureResponderEvent } from 'react-native'
import Animated, { withTiming, useAnimatedStyle } from 'react-native-reanimated'
import { useStyles } from './styles'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'
import { ExpandablePanel } from './ExpandablePanel'

export type TitledExpandablePanelProps = {
    title: React.ReactNode | string
    iconPressed?: () => void
    containerStyle?: StyleProp<ViewStyle>
    headerStyle?: StyleProp<ViewStyle>
    contentStyle?: StyleProp<ViewStyle>
    startExpanded?: boolean
    /** Down when collapsed and up when expanded, instead of right and down. */
    hasVerticalChevron?: boolean
    /** On the header touchable. */
    testID?: string
} & PropsWithChildren

export const TitledExpandablePanel = ({
    title,
    containerStyle,
    headerStyle,
    contentStyle,
    startExpanded = false,
    hasVerticalChevron = false,
    testID,
    children,
    iconPressed,
}: TitledExpandablePanelProps) => {
    const [expanded, setExpanded] = useState(startExpanded)
    const styles = useStyles()
    const onPress = () => {
        setExpanded(!expanded)
    }

    const collapsedRotation = hasVerticalChevron ? '90deg' : '0deg'
    const expandedRotation = hasVerticalChevron ? '-90deg' : '90deg'
    const iconStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    rotate: withTiming(
                        expanded ? expandedRotation : collapsedRotation,
                        { duration: EXPANDABLE_PANEL_ANIMATION_DURATION },
                    ),
                },
            ],
        }
    }, [expanded, collapsedRotation, expandedRotation])

    const handleIconPress = (event: GestureResponderEvent) => {
        event.stopPropagation()
        onPress()
        iconPressed?.()
    }

    return (
        <PWView style={containerStyle}>
            <PWTouchableOpacity
                onPress={onPress}
                style={
                    headerStyle ? [styles.header, headerStyle] : styles.header
                }
                testID={testID}
            >
                {typeof title === 'string' ? (
                    <PWView style={styles.titleContainer}>
                        <PWText truncate>{title}</PWText>
                    </PWView>
                ) : (
                    title
                )}
                <PWTouchableOpacity
                    onPress={handleIconPress}
                    style={styles.chevronContainer}
                >
                    <Animated.View style={iconStyle}>
                        <PWIcon
                            name='chevron-right'
                            size='sm'
                        />
                    </Animated.View>
                </PWTouchableOpacity>
            </PWTouchableOpacity>
            <ExpandablePanel
                isExpanded={expanded}
                containerStyle={[styles.collapsableContainer, contentStyle]}
            >
                {children}
            </ExpandablePanel>
        </PWView>
    )
}
