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

import { PWButton, PWView } from '@components/core'
import { type PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useTransactionFooter } from './useTransactionFooter'
import { RawTransactionButton } from '../RawTransactionButton'

export const TransactionFooter = ({
    transaction,
}: {
    transaction: PeraDisplayableTransaction
}) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { showInExplorer, assetUrl, showAssetUrl } =
        useTransactionFooter(transaction)

    return (
        <PWView style={styles.container}>
            <RawTransactionButton transaction={transaction} />
            {!!assetUrl && (
                <PWButton
                    variant='secondary'
                    title={t('transactions.common.view_asset_url')}
                    iconRight='arrow-up-right'
                    onPress={showAssetUrl}
                    paddingStyle='dense'
                    style={styles.actionButton}
                />
            )}
            {!!transaction.id && !!showInExplorer && (
                <PWButton
                    testID='transaction_detail_explorer'
                    variant='secondary'
                    title={t('transactions.common.view_in_explorer')}
                    iconRight='arrow-up-right'
                    onPress={showInExplorer}
                    paddingStyle='dense'
                    style={styles.actionButton}
                />
            )}
        </PWView>
    )
}
