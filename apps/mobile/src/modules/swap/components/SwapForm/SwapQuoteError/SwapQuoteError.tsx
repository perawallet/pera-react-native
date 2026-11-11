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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useSwapQuoteError,
    type UseSwapQuoteErrorParams,
} from './useSwapQuoteError'
import { useStyles } from './styles'

export type SwapQuoteErrorProps = UseSwapQuoteErrorParams & {
    onRetry: () => void
}

export const SwapQuoteError = ({ onRetry, ...params }: SwapQuoteErrorProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { message, canRetry } = useSwapQuoteError(params)

    return (
        <PWView
            style={styles.container}
            testID='swap_quote_error'
        >
            <PWText
                variant='body'
                style={styles.message}
            >
                {message}
            </PWText>
            {canRetry && (
                <PWButton
                    variant='secondary'
                    paddingStyle='dense'
                    title={t('swap.quote.retry')}
                    onPress={onRetry}
                    style={styles.retryButton}
                    testID='swap-quote-retry'
                />
            )}
        </PWView>
    )
}
