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

import { PWButton, PWScrollView, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SwapAmountSection } from '../SwapAmountSection'
import { SwapPairHistoryWidget } from '../SwapPairHistoryWidget'
import { SwapProviderRow } from '../SwapProviderRow'
import { SwapTopPairs } from '../SwapTopPairs'
import { SwapFormControls } from './SwapFormControls'
import { useSwapForm } from './useSwapForm'
import { useStyles } from './styles'

export const SwapForm = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        payAssetId,
        receiveAssetId,
        payAmount,
        receiveAmount,
        payBalance,
        receiveBalance,
        isQuoteFetching,
        isQuoteError,
        selectedQuote,
        providerSelectionMode,
        canSwap,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handleOpenPayAssetSelection,
        handleOpenReceiveAssetSelection,
        handleOpenConfig,
        handleOpenProvider,
        handleOpenConfirm,
    } = useSwapForm()

    return (
        <PWScrollView contentContainerStyle={styles.formContainer}>
            <PWView style={styles.amountSections}>
                <SwapAmountSection
                    variant='pay'
                    assetId={payAssetId}
                    balance={payBalance}
                    amount={payAmount}
                    onAmountChange={handlePayAmountChange}
                    onAssetPress={handleOpenPayAssetSelection}
                />

                <SwapFormControls
                    onSwapPress={handleSwapDirection}
                    onMaxPress={handleMaxPress}
                    onConfigurePress={handleOpenConfig}
                />

                <SwapAmountSection
                    variant='receive'
                    assetId={receiveAssetId}
                    balance={receiveBalance}
                    amount={receiveAmount}
                    isLoading={isQuoteFetching && !receiveAmount}
                    onAssetPress={handleOpenReceiveAssetSelection}
                />
            </PWView>

            {selectedQuote && (
                <SwapProviderRow
                    quote={selectedQuote}
                    selectionMode={providerSelectionMode}
                    onPress={handleOpenProvider}
                />
            )}

            {isQuoteError && (
                <PWView
                    style={styles.errorContainer}
                    testID='swap_quote_error'
                >
                    <PWText
                        variant='body'
                        style={styles.errorText}
                    >
                        {t('swap.quote.quote_error')}
                    </PWText>
                </PWView>
            )}

            {selectedQuote && (
                <PWButton
                    variant='primary'
                    title={t('swap.form.swap')}
                    onPress={handleOpenConfirm}
                    isDisabled={!canSwap}
                    style={styles.swapButton}
                    testID='swap-button'
                />
            )}

            <SwapPairHistoryWidget />
            <SwapTopPairs />
        </PWScrollView>
    )
}
