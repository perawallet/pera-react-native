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

import { PWSheetLayout, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { type RampQuote } from '@perawallet/wallet-core-onramp'
import { ProviderSelectionItem } from './ProviderSelectionItem'
import { getOnrampProviderName } from '../onrampQuoteDisplay'
import { useStyles } from './styles'
import { useOnrampProviderContent } from './useOnrampProviderContent'

export type OnrampProviderContentProps = {
    quotes: RampQuote[]
    selectedQuoteId: Nullable<string>
    /** Narrows the list to one row per provider; null lists every quote. */
    selectedPaymentMethodId: Nullable<string>
    /** The receive asset's symbol, which each row shows its amount in. */
    destinationSymbol: string
}

export const OnrampProviderContent = ({
    quotes,
    selectedQuoteId,
    selectedPaymentMethodId,
    destinationSymbol,
}: OnrampProviderContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const { sortedQuotes, bestQuoteId, handleSelect } =
        useOnrampProviderContent({
            quotes,
            selectedPaymentMethodId,
        })

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('onramp.provider.title')} />}
        >
            <PWView style={styles.list}>
                {sortedQuotes.map(quote => (
                    <ProviderSelectionItem
                        key={quote.quoteId}
                        label={getOnrampProviderName(quote)}
                        quote={quote}
                        destinationSymbol={destinationSymbol}
                        isBest={quote.quoteId === bestQuoteId}
                        isSelected={quote.quoteId === selectedQuoteId}
                        onPress={() => handleSelect(quote.quoteId)}
                        testID={`onramp-provider-option-${quote.quoteId}`}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
