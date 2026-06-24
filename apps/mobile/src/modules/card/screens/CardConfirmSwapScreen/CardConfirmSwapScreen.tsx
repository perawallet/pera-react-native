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

import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { KeyValueRow } from '@components/KeyValueRow'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { useCardConfirmSwapScreen } from './useCardConfirmSwapScreen'
import { useStyles } from './styles'

export const CardConfirmSwapScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        sourceAsset,
        usdcAsset,
        payDisplay,
        receiveDisplay,
        priceDisplay,
        slippageDisplay,
        priceImpactDisplay,
        minimumReceivedDisplay,
        exchangeFeeDisplay,
        peraFeeDisplay,
        isQuoteLoading,
        isConfirmDisabled,
        isConfirming,
        handleConfirm,
    } = useCardConfirmSwapScreen()

    if (isQuoteLoading) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWScreen
            footer={
                <PWButton
                    variant='primary'
                    title={t('peraCard.confirm_swap.confirm')}
                    onPress={handleConfirm}
                    isDisabled={isConfirmDisabled}
                    isLoading={isConfirming}
                    testID='card_confirm_swap_button'
                />
            }
        >
            <PWView style={styles.summaryPill}>
                <PWView style={styles.assetGroup}>
                    {sourceAsset && (
                        <AssetIcon
                            asset={sourceAsset}
                            size='sm'
                        />
                    )}
                    <PWText variant='footnoteMedium'>{payDisplay}</PWText>
                </PWView>
                <PWIcon
                    name='chevron-right'
                    variant='secondary'
                />
                <PWView style={styles.assetGroup}>
                    {usdcAsset && (
                        <AssetIcon
                            asset={usdcAsset}
                            size='sm'
                        />
                    )}
                    <PWText variant='footnoteMedium'>{receiveDisplay}</PWText>
                </PWView>
            </PWView>

            <PWView style={styles.details}>
                <KeyValueRow title={t('peraCard.confirm_swap.price')}>
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {priceDisplay}
                    </PWText>
                </KeyValueRow>
                <KeyValueRow title={t('peraCard.confirm_swap.slippage')}>
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {slippageDisplay}
                    </PWText>
                </KeyValueRow>
                <KeyValueRow title={t('peraCard.confirm_swap.price_impact')}>
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {priceImpactDisplay}
                    </PWText>
                </KeyValueRow>
                <KeyValueRow
                    title={t('peraCard.confirm_swap.minimum_received')}
                >
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {minimumReceivedDisplay}
                    </PWText>
                </KeyValueRow>
                <KeyValueRow title={t('peraCard.confirm_swap.exchange_fee')}>
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {exchangeFeeDisplay}
                    </PWText>
                </KeyValueRow>
                <KeyValueRow title={t('peraCard.confirm_swap.pera_fee')}>
                    <PWText
                        variant='body'
                        style={styles.value}
                    >
                        {peraFeeDisplay}
                    </PWText>
                </KeyValueRow>
            </PWView>
        </PWScreen>
    )
}
