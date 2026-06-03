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

import React, { useMemo } from 'react'
import { ViewStyle } from 'react-native'
import { useTheme } from '@rneui/themed'

import {
    IconName,
    PWIcon,
    PWIconSize,
    PWIconVariant,
} from '@components/core/PWIcon'
import { PWView, PWViewProps } from '@components/core/PWView'
import { useStyles } from './styles'

export type PWRoundIconProps = {
    icon: IconName
    size?: PWIconSize
    iconSize?: PWIconSize
    variant?: PWIconVariant
    style?: ViewStyle
} & PWViewProps

const ICON_SIZE_MAP: Record<PWIconSize, PWIconSize> = {
    xs: 'xs',
    sm: 'sm',
    md: 'sm',
    lg: 'md',
    xl: 'lg',
    xxl: 'xl',
    '3xl': 'xxl',
}

const ICON_VARIANT_MAP: Record<string, PWIconVariant> = {
    primary: 'white',
    secondary: 'primary',
    buttonPrimary: 'buttonPrimary',
    helper: 'helper',
    white: 'white',
    link: 'link',
    error: 'error',
    positive: 'positive',
    favorite: 'favorite',
}

export const PWRoundIcon = (props: PWRoundIconProps) => {
    const {
        icon,
        size = 'lg',
        iconSize,
        variant = 'secondary',
        style: propStyle,
        ...rest
    } = props
    const styles = useStyles(props)
    const { theme } = useTheme()

    const resolvedIconVariant = useMemo(() => {
        if (theme.mode === 'dark' && variant === 'primary') {
            return 'brand'
        }
        return (ICON_VARIANT_MAP[variant as string] ||
            'primary') as PWIconVariant
    }, [theme.mode, variant])

    return (
        <PWView
            style={[styles.container, propStyle]}
            {...rest}
        >
            <PWIcon
                name={icon}
                size={iconSize ?? ICON_SIZE_MAP[size]}
                variant={resolvedIconVariant}
            />
        </PWView>
    )
}
