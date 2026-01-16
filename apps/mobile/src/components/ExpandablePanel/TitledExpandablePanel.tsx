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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import React, { PropsWithChildren, useState } from 'react'
import { StyleProp, ViewStyle, GestureResponderEvent } from 'react-native'
import Animated, { withTiming, useAnimatedStyle } from 'react-native-reanimated'
import { useStyles } from './styles'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'
import { ExpandablePanel } from './ExpandablePanel'

/**
 * Props for the TitledExpandablePanel component.
 */
type TitledExpandablePanelProps = {
    /** The header content, can be a string or custom React nodes */
    title: React.ReactNode | string
    /** Optional callback when the header icon is pressed specifically */
    iconPressed?: () => void
    /** Custom styles for the outer container */
    containerStyle?: StyleProp<ViewStyle>
} & PropsWithChildren

/**
 * A layout component consisting of a clickable header and an expandable body using ExpandablePanel.
 *
 * @example
 * <TitledExpandablePanel title="Details">
 *   <PWText>More info...</PWText>
 * </TitledExpandablePanel>
 */
export const TitledExpandablePanel = ({
    title,
    containerStyle,
    children,
    iconPressed,
}: TitledExpandablePanelProps) => {
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
                {typeof title === 'string' ? <PWText>{title}</PWText> : title}
                <Animated.View style={iconStyle}>
                    <PWIcon
                        name='chevron-right'
                        size='sm'
                        onPress={handleIconPress}
                    />
                </Animated.View>
            </PWTouchableOpacity>
            <ExpandablePanel
                isExpanded={expanded}
                containerStyle={styles.collapsableContainer}
            >
                {children}
            </ExpandablePanel>
        </PWView>
    )
}
