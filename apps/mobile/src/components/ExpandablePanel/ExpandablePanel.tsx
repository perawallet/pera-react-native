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
import React, { type PropsWithChildren } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { useStyles } from './styles'
import { useExpandablePanel } from './useExpandablePanel'

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
    const styles = useStyles()
    const { collapsableStyle, onLayout } = useExpandablePanel({
        isExpanded,
        onStateChangeEnd,
    })

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
