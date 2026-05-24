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

import { formatCurrency, formatPercentage } from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWView } from '@components/core'
import { useStyles } from './styles'

import type { Decimal } from 'decimal.js'
import type { TypographyVariant } from '@theme/typography'

export type TrendIndicatorAbsolute = {
    /** Signed amount for the `±` line. Rendered as an absolute (positive) value with a `+`/`-` prefix derived from `percentage`. */
    amount: Decimal
    /** Currency code for the `±` line (e.g. 'ALGO', 'USD'). */
    currency: string
    /** Decimal places for the `±` line. Defaults to 2. */
    precision?: number
    /** Typography variant for the `±` line. Defaults to 'h4'. */
    variant?: TypographyVariant
}

export type TrendIndicatorProps = {
    /** Signed percent change. Direction (up/down), icon and color are derived from its sign. */
    percentage: Decimal
    /** Typography variant for the percentage (and `±`) text. Defaults to 'h4'. */
    variant?: TypographyVariant
    /** Renders a rounded background behind the up arrow. Defaults to false. */
    hasIconBackground?: boolean
    /** Hides the direction icon when the change is exactly zero. Defaults to false. */
    shouldHideIconWhenZero?: boolean
    /**
     * Colors the percentage (and `±`) text with a neutral color instead of the
     * up/down colors. The icon still reflects direction. Defaults to false.
     */
    hasNeutralText?: boolean
    /** Optional `±{amount}` currency line shown below the percentage. */
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

    const isPositive = percentage.greaterThanOrEqualTo(0)
    const isZero = percentage.isZero()
    const itemStyle = hasNeutralText
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
                    {isPositive ? '+' : '-'}
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
