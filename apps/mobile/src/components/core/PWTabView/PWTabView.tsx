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

import { TabView as RNETabView } from '@rneui/themed'
import { StyleProp, ViewStyle, Animated } from 'react-native'
import { ReactNode } from 'react'

/**
 * Props for the PWTabView component.
 */
export type PWTabViewProps = {
    /** Current active index of the tab view */
    value?: number
    /** Callback when the tab index changes */
    onChange?: (value: number) => void
    /** Type of animation when switching tabs */
    animationType?: 'spring' | 'timing'
    /** Configuration for the switch animation */
    animationConfig?: Omit<
        Animated.SpringAnimationConfig & Animated.TimingAnimationConfig,
        'toValue'
    >
    /** Tab view items */
    children?: ReactNode
}

/**
 * A themed tab view component for managing multiple screens or views with animations.
 * Supports {@link PWTabView.Item} as children.
 *
 * @example
 * <PWTabView value={index} onChange={setIndex}>
 *   <PWTabView.Item>
 *     <PWText>Screen 1</PWText>
 *   </PWTabView.Item>
 * </PWTabView>
 */
const PWTabViewComponent = ({
    value,
    onChange,
    animationType,
    animationConfig,
    children,
    ...props
}: PWTabViewProps) => {
    return (
        <RNETabView
            value={value}
            onChange={onChange}
            animationType={animationType}
            animationConfig={animationConfig}
            {...props}
        >
            {children}
        </RNETabView>
    )
}

/**
 * Props for the PWTabView.Item component.
 */
export type PWTabViewItemProps = {
    /** Content for the tab view item */
    children?: ReactNode
    /** Style overrides for the tab view item */
    style?: StyleProp<ViewStyle>
}

/**
 * Individual tab view item for the PWTabView container.
 *
 * @example
 * <PWTabView.Item>
 *   <PWText>Tab Content</PWText>
 * </PWTabView.Item>
 */
const PWTabViewItem = ({ children, style, ...props }: PWTabViewItemProps) => {
    return (
        <RNETabView.Item
            style={style}
            {...props}
        >
            {children}
        </RNETabView.Item>
    )
}

export const PWTabView = Object.assign(PWTabViewComponent, {
    Item: PWTabViewItem,
})
