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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { KeyValueRow } from '@components/KeyValueRow'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { CardStepRow } from '../../components/CardStepRow'
import { useCardConfirmSwapScreen } from './useCardConfirmSwapScreen'
import { useStyles } from './styles'

const STEP_LABEL_KEYS = {
    swap: i18nKey('peraCard.add_funds.confirm_step_swap'),
    deposit: i18nKey('peraCard.add_funds.confirm_step_deposit'),
} as const

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
        step,
        steps,
        handleConfirm,
        handleRetryDeposit,
        chainId,
    } = useCardConfirmSwapScreen()
    const isDepositFailed = step === 'deposit-failed'
    const detailRows = [
        [
            i18nKey('peraCard.confirm_swap.price'),
            priceDisplay,
            'card-confirm-swap-price',
        ],
        [
            i18nKey('peraCard.confirm_swap.slippage'),
            slippageDisplay,
            'card-confirm-swap-slippage',
        ],
        [
            i18nKey('peraCard.confirm_swap.price_impact'),
            priceImpactDisplay,
            'card-confirm-swap-price-impact',
        ],
        [
            i18nKey('peraCard.confirm_swap.minimum_received'),
            minimumReceivedDisplay,
            'card-confirm-swap-minimum-received',
        ],
        [
            i18nKey('peraCard.confirm_swap.exchange_fee'),
            exchangeFeeDisplay,
            'card-confirm-swap-exchange-fee',
        ],
        [
            i18nKey('peraCard.confirm_swap.pera_fee'),
            peraFeeDisplay,
            'card-confirm-swap-pera-fee',
        ],
    ] as const

    if (isQuoteLoading) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWScreen
            testID='card-confirm-swap'
            footer={
                isDepositFailed ? (
                    <PWButton
                        variant='primary'
                        title={t(
                            'peraCard.add_funds.swap_deposit_retry_button',
                        )}
                        onPress={handleRetryDeposit}
                        isLoading={isConfirming}
                        testID='card_confirm_swap_retry_deposit_button'
                    />
                ) : (
                    <PWButton
                        variant='primary'
                        title={t('peraCard.add_funds.confirm_button')}
                        onPress={handleConfirm}
                        isDisabled={isConfirmDisabled}
                        isLoading={isConfirming}
                        testID='card_confirm_swap_button'
                    />
                )
            }
        >
            <PWView style={styles.summaryPill}>
                <PWView style={styles.assetGroup}>
                    {sourceAsset && (
                        <AssetIcon
                            chainId={chainId}
                            asset={sourceAsset}
                            size='sm'
                        />
                    )}
                    <PWText
                        variant='footnoteMedium'
                        testID='card-confirm-swap-pay'
                    >
                        {payDisplay}
                    </PWText>
                </PWView>
                <PWIcon
                    name='chevron-right'
                    variant='secondary'
                />
                <PWView style={styles.assetGroup}>
                    {usdcAsset && (
                        <AssetIcon
                            chainId={chainId}
                            asset={usdcAsset}
                            size='sm'
                        />
                    )}
                    <PWText
                        variant='footnoteMedium'
                        testID='card-confirm-swap-receive'
                    >
                        {receiveDisplay}
                    </PWText>
                </PWView>
                <PWIcon
                    name='chevron-right'
                    variant='secondary'
                />
                <PWView style={styles.assetGroup}>
                    <PWIcon
                        name='card'
                        size='sm'
                    />
                    <PWText variant='footnoteMedium'>
                        {t('peraCard.add_funds.confirm_card_label')}
                    </PWText>
                </PWView>
            </PWView>

            <PWView style={styles.stepsCard}>
                {steps.map(row => (
                    <CardStepRow
                        key={row.id}
                        stepNumber={row.stepNumber}
                        label={t(STEP_LABEL_KEYS[row.id], {
                            asset: sourceAsset?.unitName ?? '',
                        })}
                        status={row.status}
                        isBusy={row.isBusy}
                        testID={`card-confirm-swap-step-${row.id}`}
                    />
                ))}
                <PWText
                    variant='footnoteMedium'
                    style={styles.note}
                    testID='card_confirm_swap_note'
                >
                    {t(
                        isDepositFailed
                            ? i18nKey(
                                  'peraCard.add_funds.swap_deposit_failed_body',
                              )
                            : i18nKey('peraCard.add_funds.confirm_note'),
                    )}
                </PWText>
            </PWView>

            <PWText
                variant='footnoteMedium'
                style={styles.detailsTitle}
            >
                {t('peraCard.add_funds.confirm_details_title')}
            </PWText>
            <PWView>
                {detailRows.map(([key, value, valueTestID]) => (
                    <KeyValueRow
                        key={key}
                        title={t(key)}
                        style={styles.detailRow}
                    >
                        <PWText
                            variant='body'
                            style={styles.value}
                            testID={valueTestID}
                        >
                            {value}
                        </PWText>
                    </KeyValueRow>
                ))}
            </PWView>
        </PWScreen>
    )
}
