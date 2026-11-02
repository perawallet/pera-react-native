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
import { PreferredAmount } from '@components/PreferredAmount'
import type { TransactionDetailAmount } from '@modules/signing/transactions/types'
import { useStyles } from './styles'
import { useTransactionDetailHeroAmount } from './useTransactionDetailHeroAmount'

type TransactionDetailHeroAmountProps = {
    amount: TransactionDetailAmount
    scope: ChainScope
}

export const TransactionDetailHeroAmount = ({
    amount,
    scope,
}: TransactionDetailHeroAmountProps) => {
    const styles = useStyles()
    const { isFiatLeading } = useTransactionDetailHeroAmount(amount, scope)

    if (!isFiatLeading) {
        return (
            <AssetAmount
                chainId={scope.chainId}
                asset={amount.asset}
                value={amount.value}
                variant='h1'
                style={styles.lead}
                showSymbol
                ignorePrivacyMode
                testID='transaction_detail_amount'
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <PreferredAmount
                sourceAmount={amount.value}
                sourceAssetId={amount.asset.assetId}
                scope={scope}
                variant='h1'
                style={styles.lead}
                showSymbol
                ignorePrivacyMode
                testID='transaction_detail_fiat'
            />
            <AssetAmount
                chainId={scope.chainId}
                asset={amount.asset}
                value={amount.value}
                style={styles.secondary}
                showSymbol
                ignorePrivacyMode
                testID='transaction_detail_amount'
            />
        </PWView>
    )
}
