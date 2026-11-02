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
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import {
    TransactionDetailAddress,
    TransactionDetailCard,
} from '@modules/signing'
import { usePaymentTransactionDisplay } from './usePaymentTransactionDisplay'

export type PaymentTransactionDisplayProps = {
    transaction: AlgorandTransactionView
}

/** A payment's sender, receiver, amount and fee are shared; only a close-out has more to say. */
export const PaymentTransactionDisplay = ({
    transaction,
}: PaymentTransactionDisplayProps) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const nativeAsset = useNativeAsset(scope)
    const { t } = useLanguage()
    const { closeToAddress, closeAmountValue } =
        usePaymentTransactionDisplay(transaction)

    if (!closeToAddress) {
        return null
    }

    return (
        <TransactionDetailCard>
            <KeyValueRow
                testID='transaction_detail_close_to'
                title={t('transactions.common.close_to')}
            >
                <TransactionDetailAddress
                    address={closeToAddress}
                    scope={scope}
                />
            </KeyValueRow>

            {!!closeAmountValue && (
                <KeyValueRow
                    testID='transaction_detail_close_amount'
                    title={t('transactions.common.close_amount')}
                >
                    <AssetAmount
                        chainId={scope.chainId}
                        asset={nativeAsset}
                        value={closeAmountValue}
                        showSymbol
                        ignorePrivacyMode
                    />
                </KeyValueRow>
            )}
        </TransactionDetailCard>
    )
}
