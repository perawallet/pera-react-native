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

import { useCallback } from 'react'
import { PWDivider, PWSlideToConfirm, PWText, PWView } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { useSwapConfirmation } from './useSwapConfirmation'
import { useSwapConfirmationActions } from './useSwapConfirmationActions'
import { SwapAssetSection } from './SwapAssetSection'
import { SwapDetailsSection } from './SwapDetailsSection'
import { useStyles } from './styles'

export type SwapConfirmationResult =
    | { kind: 'confirm' }
    | { kind: 'cancelled' }
    | { kind: 'error'; message: string }

export type SwapConfirmationContentProps = {
    quote: SwapQuote
}

export const SwapConfirmationContent = ({
    quote,
}: SwapConfirmationContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const { swapStatus, handleSlideConfirm, handleClose } =
        useSwapConfirmationActions({ quoteIdStr: quote.quoteIdStr })

    const {
        selectedAccount,
        inAsset,
        outAsset,
        isProcessing,
        payDisplay,
        receiveDisplay,
        payFiatDisplay,
        receiveFiatDisplay,
        rateDisplay,
        minimumReceivedDisplay,
        peraFeeDisplay,
        slippageDisplay,
        hasHighPriceImpact,
        priceImpactDisplay,
        priceImpactStyle,
    } = useSwapConfirmation({ quote, swapStatus })

    const onClosePress = useCallback(
        () => handleClose(isProcessing),
        [handleClose, isProcessing],
    )

    return (
        <PWView style={styles.container}>
            <SheetHeader
                onClose={onClosePress}
                testID='swap-confirm'
                title={
                    <PWView style={styles.headerCenter}>
                        <PWText variant='h4'>
                            {t('swap.quote.confirm_swap')}
                        </PWText>
                        {selectedAccount && (
                            <AccountDisplay
                                account={selectedAccount}
                                iconProps={{ size: 'sm' }}
                                textProps={{ variant: 'caption' }}
                                showChevron={false}
                                style={styles.accountRow}
                            />
                        )}
                    </PWView>
                }
            />

            <PWView style={styles.assetsGroup}>
                <SwapAssetSection
                    asset={inAsset}
                    amountDisplay={payDisplay}
                    fiatDisplay={payFiatDisplay}
                    unitName={quote.assetIn.unitName}
                    verificationTier={quote.assetIn.verificationTier}
                />

                <PWView style={styles.toDivider}>
                    <PWDivider style={styles.toDividerLine} />
                    <PWText
                        variant='caption'
                        style={styles.toLabel}
                    >
                        {t('swap.form.to')}
                    </PWText>
                    <PWDivider style={styles.toDividerLine} />
                </PWView>

                <SwapAssetSection
                    asset={outAsset}
                    amountDisplay={receiveDisplay}
                    fiatDisplay={receiveFiatDisplay}
                    unitName={quote.assetOut.unitName}
                    verificationTier={quote.assetOut.verificationTier}
                />
            </PWView>

            <PWDivider style={styles.detailsDivider} />

            <SwapDetailsSection
                quote={quote}
                rateDisplay={rateDisplay}
                minimumReceivedDisplay={minimumReceivedDisplay}
                peraFeeDisplay={peraFeeDisplay}
                slippageDisplay={slippageDisplay}
                priceImpactDisplay={priceImpactDisplay}
                priceImpactStyle={priceImpactStyle}
            />

            {hasHighPriceImpact && (
                <PWView
                    style={styles.warningBanner}
                    testID='swap-confirm-warning'
                >
                    <PWText style={styles.warningText}>
                        {t('swap.quote.high_price_impact_warning')}
                    </PWText>
                </PWView>
            )}

            <PWSlideToConfirm
                title={t('swap.quote.slide_to_confirm')}
                onConfirm={handleSlideConfirm}
                isLoading={isProcessing}
                isConfirmed={swapStatus === 'success'}
                style={styles.confirmButton}
                testID='swap-confirm-slide'
            />
        </PWView>
    )
}
