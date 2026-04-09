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

import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CurrencyDisplay } from '@components/CurrencyDisplay/CurrencyDisplay'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { DetailRow } from './DetailRow'
import { useStyles } from './styles'

type SwapDetailsSectionProps = {
    quote: SwapQuote
    rateDisplay: string
    minimumReceivedDisplay: string
    priceImpactDisplay: string
    priceImpactStyle: object
}

export const SwapDetailsSection = ({
    quote,
    rateDisplay,
    minimumReceivedDisplay,
    priceImpactDisplay,
    priceImpactStyle,
}: SwapDetailsSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.detailsSection}>
            <DetailRow label={t('swap.quote.rate')}>
                <PWView style={styles.rateValueRow}>
                    <PWText
                        variant='body'
                        style={styles.detailValue}
                    >
                        {rateDisplay}
                    </PWText>
                    <PWIcon
                        name='swap'
                        size='xs'
                    />
                </PWView>
            </DetailRow>
            <DetailRow
                label={t('swap.quote.provider')}
                value={quote.provider ?? '-'}
                valueStyle={styles.detailValue}
            />
            <DetailRow
                label={t('swap.quote.slippage_tolerance')}
                value={quote.slippage ? `${quote.slippage.toString()}%` : '-'}
                valueStyle={styles.detailValue}
                info={t('swap.info.slippage_tolerance')}
            />
            <DetailRow
                label={t('swap.quote.price_impact')}
                value={priceImpactDisplay}
                valueStyle={priceImpactStyle}
                info={t('swap.info.price_impact')}
            />
            <DetailRow
                label={t('swap.quote.minimum_received')}
                value={minimumReceivedDisplay}
                valueStyle={styles.detailValue}
            />
            <DetailRow
                label={t('swap.quote.exchange_fee')}
                info={t('swap.info.exchange_fee')}
            >
                <CurrencyDisplay
                    currency={
                        quote.assetIn.unitName === 'ALGO'
                            ? 'ALGO'
                            : (quote.assetIn.unitName ?? '')
                    }
                    value={quote.exchangeFeeAmount ?? null}
                    precision={quote.assetIn.decimals ?? 6}
                    showSymbol={quote.assetIn.unitName === 'ALGO'}
                    symbolPosition='start'
                    variant='body'
                />
            </DetailRow>
            <DetailRow label={t('swap.quote.pera_fee')}>
                <CurrencyDisplay
                    currency={
                        quote.assetIn.unitName === 'ALGO'
                            ? 'ALGO'
                            : (quote.assetIn.unitName ?? '')
                    }
                    value={quote.peraFeeAmount ?? null}
                    precision={quote.assetIn.decimals ?? 6}
                    showSymbol={quote.assetIn.unitName === 'ALGO'}
                    symbolPosition='start'
                    variant='body'
                />
            </DetailRow>
        </PWView>
    )
}
