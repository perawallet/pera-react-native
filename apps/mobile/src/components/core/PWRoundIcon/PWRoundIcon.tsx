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

import React, { useMemo } from 'react'
import type { ViewStyle } from 'react-native'
import { useTheme } from '@rneui/themed'

import {
    type IconName,
    PWIcon,
    type PWIconSize,
    type PWIconVariant,
} from '@components/core/PWIcon'
import { PWView, type PWViewProps } from '@components/core/PWView'
import { ROUND_ICON_SIZE_MAP, type PWRoundIconSize } from './sizing'
import { useStyles } from './styles'

export type PWRoundIconAccountVariant =
    | 'accountTurquoise'
    | 'accountPurple'
    | 'accountMagenta'
    | 'accountPink'
    | 'accountPeach'
    | 'accountNeutral'
    | 'accountQuantum'

export type PWRoundIconVariant = PWIconVariant | PWRoundIconAccountVariant

export type PWRoundIconProps = {
    icon: IconName
    size?: PWRoundIconSize
    iconSize?: PWIconSize
    variant?: PWRoundIconVariant
    style?: ViewStyle
} & PWViewProps

const ICON_VARIANT_MAP: Partial<Record<PWRoundIconVariant, PWIconVariant>> = {
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
        return ICON_VARIANT_MAP[variant] ?? 'primary'
    }, [theme.mode, variant])

    return (
        <PWView
            style={[styles.container, propStyle]}
            {...rest}
        >
            <PWIcon
                name={icon}
                size={iconSize ?? ROUND_ICON_SIZE_MAP[size].icon}
                variant={resolvedIconVariant}
            />
        </PWView>
    )
}
