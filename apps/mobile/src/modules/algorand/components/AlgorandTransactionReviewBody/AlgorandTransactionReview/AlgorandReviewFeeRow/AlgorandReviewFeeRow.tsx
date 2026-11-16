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

import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { InfoButton } from '@components/InfoButton'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { ReviewFeeRow } from '@modules/signing'
import { QuantumFeeExplainer } from '@modules/transactions'
import { useFeeAdjustment } from '@modules/algorand/components/FeeDisplay/useFeeAdjustment'
import { useFeeWarning } from '@modules/algorand/components/FeeDisplay/useFeeWarning'
import { useQuantumFeeExplainer } from '@modules/algorand/components/FeeDisplay/useQuantumFeeExplainer'
import { useStyles } from './styles'

export type AlgorandReviewFeeRowProps = {
    transaction: AlgorandTransactionView
}

/** Algorand's fee is fixed when signed, so the row has no maximum. */
export const AlgorandReviewFeeRow = ({
    transaction,
}: AlgorandReviewFeeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
    const nativeAsset = useNativeAsset(scope)
    const { showWarning, fee } = useFeeWarning()
    const { isQuantumFee } = useQuantumFeeExplainer(transaction)
    const { isAdjusted, originalFee, adjustedFee } =
        useFeeAdjustment(transaction)

    return (
        <ReviewFeeRow
            testID='algorand_review_fee'
            labelAccessory={
                <PWView style={styles.accessories}>
                    {(isQuantumFee || isAdjusted) && (
                        <QuantumFeeExplainer
                            adjustment={
                                isAdjusted
                                    ? { originalFee, adjustedFee }
                                    : undefined
                            }
                        />
                    )}
                    {showWarning && (
                        <InfoButton
                            variant='error'
                            size='sm'
                            title={t('transactions.fee_warning.title')}
                        >
                            <PWText>
                                {t('transactions.fee_warning.body')}
                            </PWText>
                        </InfoButton>
                    )}
                </PWView>
            }
            expected={
                <PWView style={styles.expected}>
                    <AssetAmount
                        chainId={scope.chainId}
                        asset={nativeAsset}
                        value={fee}
                        showSymbol
                        ignorePrivacyMode
                        variant='h4'
                        style={styles.amount}
                        testID='algorand_review_fee_amount'
                    />
                    {isAdjusted && (
                        <PWText
                            variant='caption'
                            style={styles.adjusted}
                        >
                            {t('transactions.quantum_fee.adjusted_label')}
                        </PWText>
                    )}
                </PWView>
            }
            maximum={
                <PreferredAmount
                    sourceAmount={fee}
                    sourceAssetId={nativeAsset.assetId}
                    variant='caption'
                    ignorePrivacyMode
                    style={styles.fiat}
                />
            }
        />
    )
}
