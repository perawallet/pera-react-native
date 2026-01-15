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

export type PWTabViewProps = {
    value?: number
    onChange?: (value: number) => void
    animationType?: 'spring' | 'timing'
    animationConfig?: Omit<
        Animated.SpringAnimationConfig & Animated.TimingAnimationConfig,
        'toValue'
    >
    children?: ReactNode
}

const PWTabViewComponent = ({
    value,
    onChange,
    animationType,
    animationConfig,
    children,
}: PWTabViewProps) => {
    return (
        <RNETabView
            value={value}
            onChange={onChange}
            animationType={animationType}
            animationConfig={animationConfig}
        >
            {children}
        </RNETabView>
    )
}

export type PWTabViewItemProps = {
    children?: ReactNode
    style?: StyleProp<ViewStyle>
}

const PWTabViewItem = ({ children, style }: PWTabViewItemProps) => {
    return <RNETabView.Item style={style}>{children}</RNETabView.Item>
}

export const PWTabView = Object.assign(PWTabViewComponent, {
    Item: PWTabViewItem,
})
