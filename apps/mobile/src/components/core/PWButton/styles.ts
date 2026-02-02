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
import { PWButtonProps } from './PWButton'
import { getFontFamily } from '@theme/theme'

export const useStyles = makeStyles((theme, props: PWButtonProps) => {
    const variantStyles = {
        primary: {
            backgroundColor: theme.colors.buttonPrimaryBg,
            color: theme.colors.buttonPrimaryText,
        },
        secondary: {
            backgroundColor: theme.colors.layerGrayLighter,
            color: theme.colors.textMain,
        },
        helper: {
            backgroundColor: theme.colors.buttonSquareBg,
            color: theme.colors.buttonSquareText,
        },
        destructive: {
            backgroundColor: theme.colors.error,
            color: theme.colors.textWhite,
        },
        link: {
            backgroundColor: theme.colors.background,
            color: theme.colors.linkPrimary,
        },
        errorLink: {
            backgroundColor: theme.colors.background,
            color: theme.colors.error,
        },
    }

    const paddingStyles = {
        normal: {
            paddingHorizontal: theme.spacing.xxl,
            paddingVertical: theme.spacing.md,
            minWidth: undefined as number | undefined,
        },
        dense: {
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            minWidth: theme.spacing.xxl,
        },
        none: {
            paddingHorizontal: 0,
            paddingVertical: 0,
            minWidth: undefined as number | undefined,
        },
    }

    const { backgroundColor, color } =
        variantStyles[props.variant ?? 'primary']
    const { paddingHorizontal, paddingVertical, minWidth } =
        paddingStyles[props.paddingStyle ?? 'normal']

    return {
        loadingStyle: {
            color,
        },
        buttonStyle: {
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            borderRadius: theme.spacing.sm,
            paddingHorizontal,
            paddingVertical,
            minWidth,
            opacity: props.isDisabled ? 0.7 : 1,
            backgroundColor,
        },
        titleStyle: {
            fontFamily: getFontFamily(false, 500),
            fontSize: 15,
            lineHeight: 24,
            flexWrap: 'nowrap',
            textAlign: 'center',
            verticalAlign: 'middle',
            justifyContent: 'center',
            padding: 0,
            color,
        },
    }
})
