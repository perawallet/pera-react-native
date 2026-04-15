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

import {
    PWBottomSheet,
    PWDivider,
    PWIcon,
    PWSlideToConfirm,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import type { SwapExecutionStatus } from '../../hooks/useSwapExecution'
import { useSwapConfirmation } from './useSwapConfirmation'
import { SwapAssetSection } from './SwapAssetSection'
import { SwapDetailsSection } from './SwapDetailsSection'
import { useStyles } from './styles'

export type SwapConfirmationBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onConfirm: () => void
    quote: SwapQuote | null
    swapStatus: SwapExecutionStatus
}

export const SwapConfirmationBottomSheet = ({
    isVisible,
    onClose,
    onConfirm,
    quote,
    swapStatus,
}: SwapConfirmationBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

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
        hasHighPriceImpact,
        priceImpactDisplay,
        priceImpactStyle,
    } = useSwapConfirmation({ quote, swapStatus })

    if (!quote) return null

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={isProcessing ? undefined : onClose}
            size='auto'
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={isProcessing ? undefined : onClose}
                            testID='swap-confirm-close'
                        />
                    }
                    center={
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
                    paddingStyle='dense'
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

                {swapStatus === 'error' && (
                    <PWView
                        style={styles.errorBanner}
                        testID='swap-confirm-error'
                    >
                        <PWText style={styles.errorText}>
                            {t('swap.execution.error')}
                        </PWText>
                    </PWView>
                )}

                <PWSlideToConfirm
                    title={t('swap.quote.slide_to_confirm')}
                    onConfirm={onConfirm}
                    isLoading={isProcessing}
                    isConfirmed={swapStatus === 'success'}
                    style={styles.confirmButton}
                    testID='swap-confirm-slide'
                />
            </PWView>
        </PWBottomSheet>
    )
}
