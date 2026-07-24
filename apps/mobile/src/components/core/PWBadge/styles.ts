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

import { makeStyles } from '@rneui/themed'
import type { PWBadgeProps } from './PWBadge'

export const useStyles = makeStyles((theme, props: PWBadgeProps) => {
    const { variant } = props

    let backgroundColor = theme.colors.buttonPrimaryBg
    let textColor = theme.colors.buttonPrimaryText
    if (variant === 'testnet') {
        backgroundColor = theme.colors.testnetBg
    } else if (variant === 'secondary') {
        textColor = theme.colors.textMain
        backgroundColor = theme.colors.layerGrayLighter
    } else if (variant === 'positive') {
        textColor = theme.colors.positive
        backgroundColor = theme.colors.buttonSquareBg
    } else if (variant === 'new') {
        // Solid "NEW feature" highlight pill (e.g. Quantum accounts) — mint
        // fill with dark text, per the Wallet/4 design tokens.
        textColor = theme.colors.wallet4Icon
        backgroundColor = theme.colors.wallet4
    } else if (variant === 'alert') {
        textColor = theme.colors.textWhite
        backgroundColor = theme.colors.alertNegative
    }

    const isAlert = variant === 'alert'

    return {
        container: {
            paddingHorizontal: isAlert ? 0 : theme.spacing.sm,
            minWidth: isAlert ? theme.spacing.xl : undefined,
            height: theme.spacing.xl,
            backgroundColor,
            borderWidth: isAlert ? theme.borders.lg : theme.borders.none,
            borderColor: isAlert ? theme.colors.background : undefined,
            borderRadius: isAlert
                ? theme.borderRadius.full
                : theme.spacing['3xl'],
        },
        text: {
            color: textColor,
        },
    }
})
