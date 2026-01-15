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

import { Tab as RNETab, IconProps } from '@rneui/themed'
import { StyleProp, ViewStyle, TextStyle } from 'react-native'
import { ReactElement, ReactNode } from 'react'

export type PWTabProps = {
    value?: number
    onChange?: (value: number) => void
    disableIndicator?: boolean
    indicatorStyle?: StyleProp<ViewStyle>
    containerStyle?: StyleProp<ViewStyle>
    buttonStyle?: StyleProp<ViewStyle>
    titleStyle?: StyleProp<TextStyle>
    variant?: 'primary' | 'default'
    dense?: boolean
    children?: ReactNode
}

const PWTabComponent = ({
    value,
    onChange,
    disableIndicator,
    indicatorStyle,
    containerStyle,
    variant = 'default',
    dense,
    children,
    buttonStyle,
    titleStyle,
}: PWTabProps) => {
    return (
        <RNETab
            value={value}
            onChange={onChange}
            disableIndicator={disableIndicator}
            indicatorStyle={indicatorStyle}
            containerStyle={containerStyle}
            variant={variant}
            dense={dense}
            buttonStyle={buttonStyle}
            titleStyle={titleStyle}
        >
            {children}
        </RNETab>
    )
}

export type PWTabItemProps = {
    title?: string
    titleStyle?: StyleProp<TextStyle>
    icon?: IconProps | ReactElement
    buttonStyle?: StyleProp<ViewStyle>
    containerStyle?: StyleProp<ViewStyle>
}

const PWTabItem = ({
    title,
    titleStyle,
    icon,
    buttonStyle,
    containerStyle,
    ...rest
}: PWTabItemProps & { onPress?: () => void }) => {
    return (
        <RNETab.Item
            title={title}
            titleStyle={titleStyle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            icon={icon as any}
            buttonStyle={buttonStyle}
            containerStyle={containerStyle}
            {...rest}
        />
    )
}

export const PWTab = Object.assign(PWTabComponent, {
    Item: PWTabItem,
})
