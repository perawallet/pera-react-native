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

import { makeStyles } from '@rneui/themed'
import { type TextStyle } from 'react-native'
import type { PWButtonProps } from './PWButton'
import { type Optional } from '@perawallet/wallet-core-shared'

const TITLE_LINE_HEIGHT = 15

export const useStyles = makeStyles((theme, props: PWButtonProps) => {
    const variantStyles = {
        primary: {
            backgroundColor: !props.isDisabled
                ? theme.colors.buttonPrimaryBg
                : theme.colors.buttonPrimaryDisabledBg,
            color: !props.isDisabled
                ? theme.colors.buttonPrimaryText
                : theme.colors.buttonPrimaryDisabledText,
        },
        secondary: {
            backgroundColor: !props.isDisabled
                ? theme.colors.buttonSecondaryBg
                : theme.colors.buttonSecondaryDisabledBg,
            color: !props.isDisabled
                ? theme.colors.buttonSecondaryText
                : theme.colors.buttonSecondaryDisabledText,
        },
        helper: {
            backgroundColor: !props.isDisabled
                ? theme.colors.buttonSquareBg
                : theme.colors.buttonHelperDisabledBg,
            color: theme.colors.buttonSquareIcon,
        },
        destructive: {
            backgroundColor: theme.colors.alertNegative,
            color: theme.colors.textWhite,
        },
        destructiveLight: {
            backgroundColor: theme.colors.negativeLighter,
            color: theme.colors.negative,
        },
        link: {
            backgroundColor: 'transparent',
            color: theme.colors.linkPrimary,
        },
        linkNeutral: {
            backgroundColor: 'transparent',
            color: theme.colors.textMain,
        },
        linkPositive: {
            backgroundColor: 'transparent',
            color: theme.colors.positive,
        },
        errorLink: {
            backgroundColor: 'transparent',
            color: theme.colors.alertNegative,
        },
    }

    const paddingStyles = {
        normal: {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            minWidth: undefined as Optional<number>,
        },
        dense: {
            paddingHorizontal: theme.spacing.md,
            // Titled buttons trim vertical padding so they match icon-only
            // height (the 24px label box is 8px taller than the 16px icon).
            paddingVertical: props.title ? theme.spacing.sm : theme.spacing.md,
            minWidth: theme.spacing.xxl,
        },
        none: {
            paddingHorizontal: 0,
            paddingVertical: 0,
            minWidth: undefined as Optional<number>,
        },
    }

    const { backgroundColor, color } = variantStyles[props.variant ?? 'primary']
    const { paddingHorizontal, paddingVertical, minWidth } =
        paddingStyles[props.paddingStyle ?? 'normal']

    const titleStyle: TextStyle = {
        flexWrap: 'nowrap',
        flexShrink: 1,
        minWidth: 0,
        textAlign: 'center',
        verticalAlign: 'middle',
        justifyContent: 'center',
        padding: 0,
        color,
    }

    return {
        loadingStyle: {
            color,
        },
        // Match the title's line-height so the button doesn't grow when its
        // content swaps from the title text to the ActivityIndicator (which
        // is ~20px tall while the title sits at 15px).
        loadingContainer: {
            height: TITLE_LINE_HEIGHT,
            width: TITLE_LINE_HEIGHT,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
        },
        buttonStyle: {
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            borderRadius: props.rounded ? theme.spacing.xl : theme.spacing.sm,
            paddingHorizontal,
            paddingVertical,
            minWidth: minWidth ?? 0,
            maxWidth: '100%',
            flexShrink: 1,
            overflow: 'hidden',
            opacity: props.isDisabled ? 0.7 : 1,
            backgroundColor,
        },
        titleContainer: {
            flexGrow: 0,
            flexShrink: 1,
            minWidth: 0,
            overflow: 'hidden',
        },
        titleStyle,
    }
})
