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

import { type SvgProps } from 'react-native-svg'
import { useTheme } from '@rneui/themed'
import { useCallback, useMemo } from 'react'
import { Keyboard, type GestureResponderEvent } from 'react-native'
import { ICON_LIBRARY, type IconName } from './constants'
import { getIconPixelSize, type PWIconSize, type PWIconVariant } from './types'

export type PWIconProps = {
    name: IconName
    size?: PWIconSize
    variant?: PWIconVariant
    dismissKeyboardOnPress?: boolean
} & Omit<SvgProps, 'color' | 'width' | 'height'>

export const PWIcon = ({
    name,
    size = 'md',
    variant = 'primary',
    onPress,
    dismissKeyboardOnPress = true,
    ...rest
}: PWIconProps) => {
    const { theme } = useTheme()
    const IconComponent = ICON_LIBRARY[name]

    // onPress before Keyboard.dismiss — bottom-sheet open races if reversed.
    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            onPress?.(event)
            if (dismissKeyboardOnPress) {
                Keyboard.dismiss()
            }
        },
        [onPress, dismissKeyboardOnPress],
    )

    const variantColors: Record<PWIconVariant, string> = useMemo(
        () => ({
            primary: theme.colors.textMain,
            buttonPrimary: theme.colors.buttonPrimaryText,
            secondary: theme.colors.textGray,
            helper: theme.colors.buttonSquareIcon,
            white: theme.colors.textWhite,
            link: theme.colors.linkPrimary,
            error: theme.colors.alertNegative,
            positive: theme.colors.positive,
            negative: theme.colors.negative,
            warning: theme.colors.warningText,
            brand: theme.colors.primary,
            favorite: theme.colors.favorite,
            banner: theme.colors.bannerText,
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
            error: theme.colors.alertNegative,
            positive: theme.colors.textGray,
            negative: theme.colors.textGray,
            warning: theme.colors.textGray,
            brand: theme.colors.textGray,
            favorite: theme.colors.textGray,
            banner: theme.colors.textGray,
        }),
        [theme],
    )

    if (!IconComponent) return null

    const resolvedSize = getIconPixelSize(theme, size)
    const resolvedColor = rest.disabled
        ? disabledColors[variant]
        : variantColors[variant]

    // web react-native-svg only sets width/height as SVG attributes, and a
    // bare <svg> defaults to flex-shrink: 1 — mirror the size into style so
    // icons stay rigid in tight flex rows. Native ignores this (Yoga already
    // treats width/height as fixed). Consumer style stays last so it wins.
    const { style, ...restProps } = rest
    const rigidSizeStyle = {
        width: resolvedSize,
        height: resolvedSize,
        flexShrink: 0,
    }
    const resolvedStyle = [rigidSizeStyle, style]

    // Every icon is a react-native-svg subtree of real Android Views, and
    // TalkBack's node walk is quadratic over such a subtree with a node-info
    // allocation per visit (ReactAccessibilityDelegate.getTalkbackDescription ->
    // isSpeakingNode -> hasNonActionableSpeakingDescendants). That walk was the
    // app's top ANR. A decorative icon offers a screen reader nothing — the
    // name belongs on the control wrapping it — so keep it out of the tree:
    // 'no-hide-descendants' is the exact flag isSpeakingNode bails on.
    const isDecorative =
        rest.accessibilityLabel === undefined && onPress === undefined
    const decorativeAccessibilityProps = isDecorative
        ? ({
              accessibilityElementsHidden: true,
              importantForAccessibility: 'no-hide-descendants',
          } as const)
        : undefined

    return (
        <IconComponent
            width={resolvedSize}
            height={resolvedSize}
            color={resolvedColor}
            onPress={onPress ? handlePress : undefined}
            {...decorativeAccessibilityProps}
            {...restProps}
            style={resolvedStyle}
        />
    )
}
