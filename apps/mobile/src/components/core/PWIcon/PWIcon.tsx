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

import { SvgProps } from 'react-native-svg'
import { useTheme } from '@rneui/themed'
import { useMemo } from 'react'
import { ICON_LIBRARY, IconName } from './constants'
import { PWIconSize, PWIconVariant } from './types'

export type PWIconProps = {
    name: IconName
    size?: PWIconSize
    variant?: PWIconVariant
} & Omit<SvgProps, 'color' | 'width' | 'height'>

export const PWIcon = ({
    name,
    size = 'md',
    variant = 'primary',
    ...rest
}: PWIconProps) => {
    const { theme } = useTheme()
    const IconComponent = ICON_LIBRARY[name]

    const sizeMap: Record<PWIconSize, number> = useMemo(
        () => ({
            xs: theme.spacing.md,
            sm: theme.spacing.lg,
            md: theme.spacing.xl,
            lg: theme.spacing.xxl,
            xl: theme.spacing['3xl'],
            xxl: theme.spacing['4xl'],
        }),
        [theme],
    )

    const variantColors: Record<PWIconVariant, string> = useMemo(
        () => ({
            primary: theme.colors.textMain,
            buttonPrimary: theme.colors.buttonPrimaryText,
            secondary: theme.colors.textGray,
            helper: theme.colors.buttonSquareText,
            white: theme.colors.textWhite,
            link: theme.colors.linkPrimary,
            error: theme.colors.error,
            positive: theme.colors.helperPositive,
            brand: theme.colors.primary,
            favorite: theme.colors.favorite,
        }),
        [theme],
    )

    const disabledColors: Record<PWIconVariant, string> = useMemo(
        () => ({
            primary: theme.colors.textGray,
            buttonPrimary: theme.colors.textGray,
            secondary: theme.colors.textGray,
            helper: theme.colors.textGray,
            white: theme.colors.textGray,
            link: theme.colors.textGray,
            error: theme.colors.error,
            positive: theme.colors.textGray,
            brand: theme.colors.textGray,
            favorite: theme.colors.textGray,
        }),
        [theme],
    )

    if (!IconComponent) return null

    const resolvedSize = sizeMap[size] ?? theme.spacing.xl
    const resolvedColor = rest.disabled
        ? disabledColors[variant]
        : variantColors[variant]

    return (
        <IconComponent
            width={resolvedSize}
            height={resolvedSize}
            color={resolvedColor}
            {...rest}
        />
    )
}
