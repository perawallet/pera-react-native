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

import {
    formatCurrency,
    formatPercentage,
} from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWView } from '@components/core'
import { useStyles } from './styles'

import type { Decimal } from 'decimal.js'
import type { TypographyVariant } from '@theme/typography'

export type TrendIndicatorAbsolute = {
    /** Rendered as `|amount|` with a `+`/`-` prefix taken from `percentage`'s sign. */
    amount: Decimal
    currency: string
    precision?: number
    variant?: TypographyVariant
}

export type TrendIndicatorProps = {
    /** Sign drives the icon and color. */
    percentage: Decimal
    /** Applies to the percentage text only; the `±` line uses `absolute.variant`. */
    variant?: TypographyVariant
    hasIconBackground?: boolean
    shouldHideIconWhenZero?: boolean
    /** Neutral-colors the text only; the icon still reflects direction. */
    hasNeutralText?: boolean
    absolute?: TrendIndicatorAbsolute
}

export const TrendIndicator = ({
    percentage,
    variant = 'h4',
    hasIconBackground = false,
    shouldHideIconWhenZero = false,
    hasNeutralText = false,
    absolute,
}: TrendIndicatorProps) => {
    const styles = useStyles()

    const isPositive = percentage.greaterThan(0)
    const isZero = percentage.isZero()
    const itemStyle =
        hasNeutralText || isZero
            ? styles.itemNeutral
            : isPositive
              ? styles.itemUp
              : styles.itemDown

    return (
        <PWView style={styles.container}>
            <PWView style={styles.percentageContainer}>
                {!(shouldHideIconWhenZero && isZero) && (
                    <PWIcon
                        testID={
                            isPositive
                                ? 'trend-indicator-up'
                                : 'trend-indicator-down'
                        }
                        name={isPositive ? 'arrow-up' : 'arrow-down'}
                        variant={isPositive ? 'helper' : 'error'}
                        size='sm'
                        style={
                            hasIconBackground && isPositive
                                ? styles.iconBackground
                                : undefined
                        }
                    />
                )}
                <PWText
                    style={itemStyle}
                    variant={variant}
                    truncate
                >
                    {formatPercentage(percentage.abs())}
                </PWText>
            </PWView>

            {absolute && (
                <PWText
                    style={styles.absoluteText}
                    variant={absolute.variant ?? 'h4'}
                    truncate
                >
                    {isZero ? '' : isPositive ? '+' : '-'}
                    {formatCurrency(
                        absolute.amount.abs(),
                        absolute.precision ?? 2,
                        absolute.currency,
                        undefined,
                        true,
                    )}
                </PWText>
            )}
        </PWView>
    )
}
