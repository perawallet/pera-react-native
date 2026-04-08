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

import { PWButton, PWScrollView, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SwapAssetSelectionBottomSheet } from '../SwapAssetSelectionBottomSheet'
import { SwapAmountSection } from '../SwapAmountSection'
import { SwapConfigurationBottomSheet } from '../SwapConfigurationBottomSheet'
import { SwapConfirmationBottomSheet } from '../SwapConfirmationBottomSheet'
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
        canSwap,
        swapStatus,
        payAssetModal,
        receiveAssetModal,
        configModal,
        confirmModal,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handlePayAssetSelected,
        handleReceiveAssetSelected,
        handleConfigApply,
        handleConfirmSwap,
    } = useSwapForm()

    return (
        <>
            <PWScrollView contentContainerStyle={styles.formContainer}>
                <PWView>
                    <SwapAmountSection
                        variant='pay'
                        assetId={payAssetId}
                        balance={payBalance}
                        amount={payAmount}
                        onAmountChange={handlePayAmountChange}
                        onAssetPress={payAssetModal.open}
                    />

                    <SwapFormControls
                        onSwapPress={handleSwapDirection}
                        onMaxPress={handleMaxPress}
                        onConfigurePress={configModal.open}
                    />

                    <SwapAmountSection
                        variant='receive'
                        assetId={receiveAssetId}
                        balance={receiveBalance}
                        amount={receiveAmount}
                        isLoading={isQuoteFetching && !receiveAmount}
                        onAssetPress={receiveAssetModal.open}
                    />
                </PWView>

                {isQuoteError && (
                    <PWView style={styles.errorContainer}>
                        <PWText
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('swap.quote.quote_error')}
                        </PWText>
                    </PWView>
                )}

                <PWButton
                    variant='primary'
                    title={t('swap.form.swap')}
                    onPress={confirmModal.open}
                    isDisabled={!canSwap}
                    style={styles.swapButton}
                    testID='swap-button'
                />
            </PWScrollView>

            <SwapAssetSelectionBottomSheet
                isVisible={payAssetModal.isOpen}
                onClose={payAssetModal.close}
                onAssetSelected={handlePayAssetSelected}
                excludeAssetId={receiveAssetId}
            />

            <SwapAssetSelectionBottomSheet
                isVisible={receiveAssetModal.isOpen}
                onClose={receiveAssetModal.close}
                onAssetSelected={handleReceiveAssetSelected}
                excludeAssetId={payAssetId}
            />

            <SwapConfigurationBottomSheet
                isVisible={configModal.isOpen}
                onClose={configModal.close}
                onApply={handleConfigApply}
            />

            <SwapConfirmationBottomSheet
                isVisible={confirmModal.isOpen}
                onClose={confirmModal.close}
                onConfirm={handleConfirmSwap}
                quote={selectedQuote}
                swapStatus={swapStatus}
            />
        </>
    )
}
