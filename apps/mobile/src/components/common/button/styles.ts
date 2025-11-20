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
import { getFontFamily } from '../../../theme/theme'

export const useStyles = makeStyles((theme, props: PWButtonProps) => {
    let backgroundColor = theme.colors.buttonPrimaryBg
    let color = theme.colors.buttonPrimaryText

    if (props.variant === 'secondary') {
        backgroundColor = theme.colors.layerGrayLighter
        color = theme.colors.textMain
    } else if (props.variant === 'helper') {
        backgroundColor = theme.colors.buttonSquareBg
        color = theme.colors.buttonSquareText
    } else if (props.variant === 'destructive') {
        backgroundColor = theme.colors.error
        color = theme.colors.textWhite
    } else if (props.variant === 'link') {
        backgroundColor = theme.colors.background
        color = theme.colors.linkPrimary
    }

    let paddingHorizontal = theme.spacing.xl * 1.5
    if (props.paddingStyle === 'dense') {
        paddingHorizontal = theme.spacing.md
    } else if (props.paddingStyle === 'none') {
        paddingHorizontal = 0
    }

    let paddingVertical = theme.spacing.md
    if (props.paddingStyle === 'none') {
        paddingVertical = 0
    }

    let minWidth: number | undefined = undefined
    if (props.paddingStyle === 'dense') {
        minWidth = theme.spacing.xl * 1.5
    }

    return {
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
            opacity: props.disabled ? 0.7 : 1,
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
