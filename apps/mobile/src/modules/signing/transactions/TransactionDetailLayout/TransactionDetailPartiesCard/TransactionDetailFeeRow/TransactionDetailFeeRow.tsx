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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { TransactionDetailAmount } from '@modules/signing/transactions/types'
import { useStyles } from './styles'
import { useTransactionDetailFeeRow } from './useTransactionDetailFeeRow'

type TransactionDetailFeeRowProps = {
    fee: TransactionDetailAmount
    scope: ChainScope
    /** Labels `fee` as the most the transaction can be charged. */
    isMaximum?: boolean
}

export const TransactionDetailFeeRow = ({
    fee,
    scope,
    isMaximum,
}: TransactionDetailFeeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { hasFiat } = useTransactionDetailFeeRow(fee, scope)

    return (
        <KeyValueRow
            testID='transaction_detail_fee'
            title={t(
                isMaximum
                    ? 'send_funds.fee.max_fee'
                    : 'transactions.common.fee',
            )}
        >
            <PWView style={styles.amounts}>
                <AssetAmount
                    chainId={scope.chainId}
                    asset={fee.asset}
                    value={fee.value}
                    showSymbol
                    ignorePrivacyMode
                />
                {hasFiat && (
                    <PreferredAmount
                        sourceAmount={fee.value}
                        sourceAssetId={fee.asset.assetId}
                        scope={scope}
                        variant='caption'
                        style={styles.fiat}
                        showSymbol
                        ignorePrivacyMode
                        testID='transaction_detail_fee_fiat'
                    />
                )}
            </PWView>
        </KeyValueRow>
    )
}
