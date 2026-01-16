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

/**
 * Props for the PWTab component.
 */
export type PWTabProps = {
    /** Current active index of the tab */
    value?: number
    /** Callback when the active tab index changes */
    onChange?: (value: number) => void
    /** Whether to hide the active tab indicator */
    disableIndicator?: boolean
    /** Style overrides for the active tab indicator */
    indicatorStyle?: StyleProp<ViewStyle>
    /** Style overrides for the tab container */
    containerStyle?: StyleProp<ViewStyle>
    /** Style overrides for individual tab buttons */
    buttonStyle?: StyleProp<ViewStyle>
    /** Style overrides for tab titles */
    titleStyle?: StyleProp<TextStyle>
    /** Tab style variant */
    variant?: 'primary' | 'default'
    /** Whether to use dense styling (smaller height) */
    dense?: boolean
    /** Tab items */
    children?: ReactNode
}

/**
 * A themed tab container for switching between views.
 * Supports {@link PWTab.Item} as children.
 *
 * @example
 * <PWTab value={index} onChange={setIndex}>
 *   <PWTab.Item title="Account" />
 *   <PWTab.Item title="Settings" />
 * </PWTab>
 */
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
    ...props
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
            {...props}
        >
            {children}
        </RNETab>
    )
}

/**
 * Props for the PWTab.Item component.
 */
export type PWTabItemProps = {
    /** Tab item title text */
    title?: string
    /** Style overrides for the tab item title text */
    titleStyle?: StyleProp<TextStyle>
    /** Optional icon for the tab item */
    icon?: IconProps | ReactElement
    /** Style overrides for the tab item button */
    buttonStyle?: StyleProp<ViewStyle>
    /** Style overrides for the tab item container */
    containerStyle?: StyleProp<ViewStyle>
}

/**
 * Individual tab item for the PWTab container.
 *
 * @example
 * <PWTab.Item title="Account" icon={<PWIcon name="person" />} />
 */
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
