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

import { PWSkeleton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import {
    useSwapQuoteDetails,
    type PriceImpactLevel,
} from './useSwapQuoteDetails'
import { useStyles } from './styles'

export type SwapQuoteDetailsProps = {
    quote: SwapQuote
    isLoading?: boolean
}

export const SwapQuoteDetails = ({
    quote,
    isLoading,
}: SwapQuoteDetailsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        rateDisplay,
        priceImpactDisplay,
        priceImpactLevel,
        slippageDisplay,
        peraFeeDisplay,
        exchangeFeeDisplay,
        providerDisplay,
    } = useSwapQuoteDetails(quote)

    const priceImpactStyleMap: Record<PriceImpactLevel, typeof styles.value> = {
        none: styles.value,
        low: styles.priceImpactLow,
        medium: styles.priceImpactMedium,
        high: styles.priceImpactHigh,
    }

    return (
        <PWView
            style={styles.container}
            testID='swap-quote-details'
        >
            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.rate')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={140}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {rateDisplay}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.price_impact')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={60}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={priceImpactStyleMap[priceImpactLevel]}
                    >
                        {priceImpactDisplay}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.slippage_tolerance')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={50}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {slippageDisplay}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.pera_fee')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={80}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {peraFeeDisplay}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.exchange_fee')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={80}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {exchangeFeeDisplay}
                    </PWText>
                )}
            </PWView>

            <PWView style={styles.row}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {t('swap.quote.provider')}
                </PWText>
                {isLoading ? (
                    <PWSkeleton
                        width={70}
                        height={16}
                    />
                ) : (
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {providerDisplay}
                    </PWText>
                )}
            </PWView>
        </PWView>
    )
}
