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

import { useMemo } from 'react'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { SwapProviderDisplay } from '../SwapProviderDisplay'
import { formatSwapRate } from '../../hooks/swapQuoteHelpers'
import { useStyles } from './styles'

export type SwapProviderRowProps = {
    quote: SwapQuote
    selectionMode: 'auto' | 'manual'
    onPress: () => void
}

export const SwapProviderRow = ({
    quote,
    selectionMode,
    onPress,
}: SwapProviderRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const rateDisplay = useMemo(() => formatSwapRate(quote), [quote])

    const title =
        selectionMode === 'auto'
            ? t('swap.provider.title_auto')
            : t('swap.provider.title_manual')

    return (
        <PWView style={styles.container}>
            <PWText
                variant='body'
                style={styles.title}
            >
                {title}
            </PWText>
            <PWTouchableOpacity
                style={styles.row}
                onPress={onPress}
                testID='swap-provider-row'
            >
                <SwapProviderDisplay
                    providerName={quote.provider}
                    providerDisplayName={quote.providerDisplayName}
                />
                <PWView style={styles.right}>
                    <PWText
                        variant='body'
                        style={styles.rate}
                    >
                        {rateDisplay}
                    </PWText>
                    <PWIcon
                        name='chevron-right'
                        size='xs'
                        variant='secondary'
                    />
                </PWView>
            </PWTouchableOpacity>
        </PWView>
    )
}
