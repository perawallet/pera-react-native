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
    PeraDisplayableTransaction,
    getTransactionType,
    microAlgosToAlgos,
} from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import {
    useSingleAssetDetailsQuery,
    ALGO_ASSET,
} from '@perawallet/wallet-core-assets'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { PWText, PWView } from '@components/core'
import {
    DEFAULT_PRECISION,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { LONG_ADDRESS_FORMAT } from '@constants/ui'

const getInnerTransactionCount = (tx: PeraDisplayableTransaction): number => {
    return tx.innerTxns?.length ?? 0
}

export const TxTypeDetails = ({ tx }: { tx: PeraDisplayableTransaction }) => {
    const txType = getTransactionType(tx)
    const { t } = useLanguage()
    const styles = useStyles()
    const { data: asset } = useSingleAssetDetailsQuery(
        tx.assetTransferTransaction?.assetId?.toString() ?? '',
    )

    let secondary: React.ReactNode | null = null

    switch (txType) {
        case 'payment': {
            if (tx.paymentTransaction) {
                const amount = microAlgosToAlgos(tx.paymentTransaction.amount)
                secondary = (
                    <CurrencyDisplay
                        currency={'ALGO'}
                        precision={ALGO_ASSET.decimals}
                        minPrecision={DEFAULT_PRECISION}
                        value={Decimal(amount)}
                        showSymbol
                        variant='caption'
                        style={styles.secondaryText}
                    />
                )
            }
            break
        }
        case 'asset-transfer': {
            if (tx.assetTransferTransaction) {
                // Just show the raw amount for now - asset decimals would need asset lookup
                secondary = (
                    <CurrencyDisplay
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals ?? 6}
                        minPrecision={DEFAULT_PRECISION}
                        value={Decimal(
                            tx.assetTransferTransaction.amount,
                        ).dividedBy(new Decimal(10 ** (asset?.decimals ?? 6)))}
                        showSymbol
                        variant='caption'
                        style={styles.secondaryText}
                    />
                )
            }
            break
        }
        case 'app-call': {
            const innerCount = getInnerTransactionCount(tx)
            if (innerCount > 0) {
                secondary = (
                    <PWText
                        variant='caption'
                        style={styles.secondaryText}
                    >
                        {t('transactions.app_call.inner_transactions', {
                            count: innerCount,
                        })}
                    </PWText>
                )
            } else if (tx.applicationTransaction?.applicationId) {
                secondary = (
                    <PWText
                        variant='caption'
                        style={styles.secondaryText}
                    >
                        {tx.applicationTransaction?.applicationId?.toString()}
                    </PWText>
                )
            } else {
                secondary = (
                    <PWText
                        variant='caption'
                        style={styles.secondaryText}
                    >
                        {truncateAlgorandAddress(
                            tx.sender,
                            LONG_ADDRESS_FORMAT,
                        )}
                    </PWText>
                )
            }
            break
        }
        default:
            secondary = (
                <PWText
                    variant='caption'
                    style={styles.secondaryText}
                >
                    {truncateAlgorandAddress(tx.sender, LONG_ADDRESS_FORMAT)}
                </PWText>
            )
    }

    return (
        <PWView style={styles.content}>
            <PWText style={styles.primaryText}>
                {t(`transactions.type.${tx.txType}`)}
            </PWText>
            {secondary}
        </PWView>
    )
}
