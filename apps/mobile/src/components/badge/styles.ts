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
import { PWBadgeProps } from './PWBadge'

export const useStyles = makeStyles((theme, props: PWBadgeProps) => {
    const { variant } = props

    let backgroundColor = theme.colors.buttonPrimaryBg
    let textColor = theme.colors.buttonPrimaryText
    if (variant === 'testnet') {
        backgroundColor = theme.colors.testnetBackground
    } else if (variant === 'secondary') {
        textColor = theme.colors.textMain
        backgroundColor = theme.colors.layerGrayLighter
    } else if (variant === 'positive') {
        textColor = theme.colors.helperPositive
        backgroundColor = theme.colors.buttonSquareBg
    }

    return {
        container: {
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            height: theme.spacing.xl,
            backgroundColor,
            borderWidth: 0,
            borderRadius: theme.spacing.xl * 2,
        },
        text: {
            color: textColor,
        },
    }
})
