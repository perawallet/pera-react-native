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
import { InfoButton } from '@components/InfoButton'
import { AssetAmount } from '@components/AssetAmount'
import { useLanguage } from '@hooks/useLanguage'
import { QuantumFeeExplainer } from '@modules/transactions/components/QuantumFeeExplainer'
import { useStyles } from './styles'
import { useFeeWarning } from './useFeeWarning'
import { useQuantumFeeExplainer } from './useQuantumFeeExplainer'
import { useFeeAdjustment } from './useFeeAdjustment'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { useNavigation } from '@react-navigation/native'
import { type PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { SigningStackParamList } from '@modules/signing/routes'
import { type StackNavigationProp } from '@react-navigation/stack'

export type FeeDisplayProps = {
    transaction?: PeraDisplayableTransaction
    label?: string
}
type NavigationProp = StackNavigationProp<SigningStackParamList>

export const FeeDisplay = ({ transaction, label }: FeeDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const { showWarning, fee } = useFeeWarning()
    const { isQuantumFee } = useQuantumFeeExplainer(transaction)
    const { isAdjusted, originalFee, adjustedFee } =
        useFeeAdjustment(transaction)

    const handleViewDetails = () => {
        if (!transaction) {
            return
        }
        navigation.navigate('TransactionDetails', { transaction })
    }

    return (
        <PWView>
            <PWView style={styles.feeContainer}>
                <PWText style={styles.label}>
                    {label ?? t('transactions.common.tx_fee')}
                </PWText>
                <PWView style={styles.feeValueContainer}>
                    <AssetAmount
                        asset={ALGO_ASSET}
                        value={fee.mul(-1)}
                        showSymbol
                        ignorePrivacyMode
                        style={fee.greaterThan(0) ? styles.value : undefined}
                    />
                    {isAdjusted && (
                        <PWText style={styles.adjustedLabel}>
                            {t('transactions.quantum_fee.adjusted_label')}
                        </PWText>
                    )}
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
            </PWView>
            {!!transaction && (
                <PWButton
                    variant='linkPositive'
                    style={styles.transactionDetails}
                    paddingStyle='none'
                    title={t('signing.view_details')}
                    iconRight='chevron-right'
                    onPress={handleViewDetails}
                />
            )}
        </PWView>
    )
}
