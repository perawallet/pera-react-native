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

import {
    type PeraDisplayableTransaction,
    getTransactionType,
    microAlgosToAlgos,
    baseUnitsToDisplayUnits,
} from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import {
    ALGO_ASSET,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { AssetAmount } from '@components/AssetAmount'
import { PWText, PWView } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useResolvedAddress } from '@hooks/useResolvedAddress'

const getInnerTransactionCount = (tx: PeraDisplayableTransaction): number => {
    return tx.innerTxns?.length ?? 0
}

export const TxTypeDetails = ({
    tx,
    isExternal,
}: {
    tx: PeraDisplayableTransaction
    isExternal?: boolean
}) => {
    const txType = getTransactionType(tx)
    const { t } = useLanguage()
    const styles = useStyles()
    const { displayName: senderDisplayName } = useResolvedAddress(tx.sender, {
        format: 'long',
    })
    const { data: asset } = useSingleAssetDetailsQuery(
        tx.assetTransferTransaction?.assetId?.toString() ?? '',
    )

    let secondary: Nullable<React.ReactNode> = null

    switch (txType) {
        case 'payment': {
            if (tx.paymentTransaction) {
                const amount = microAlgosToAlgos(tx.paymentTransaction.amount)
                secondary = (
                    <AssetAmount
                        asset={ALGO_ASSET}
                        density='compact'
                        value={amount}
                        showSymbol
                        variant='caption'
                        style={styles.secondaryText}
                        ignorePrivacyMode
                    />
                )
            }
            break
        }
        case 'asset-transfer': {
            if (tx.assetTransferTransaction) {
                // Just show the raw amount for now - asset decimals would need asset lookup
                secondary = (
                    <AssetAmount
                        asset={asset}
                        density='compact'
                        value={baseUnitsToDisplayUnits(
                            tx.assetTransferTransaction.amount,
                            asset?.decimals ?? 6,
                        )}
                        showSymbol
                        variant='caption'
                        style={styles.secondaryText}
                        ignorePrivacyMode
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
                        truncate
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
                        truncate
                        style={styles.secondaryText}
                    >
                        {tx.applicationTransaction?.applicationId?.toString()}
                    </PWText>
                )
            } else {
                secondary = (
                    <PWText
                        variant='caption'
                        truncate
                        style={styles.secondaryText}
                    >
                        {senderDisplayName}
                    </PWText>
                )
            }
            break
        }
        default: {
            secondary = (
                <PWText
                    variant='caption'
                    truncate
                    style={styles.secondaryText}
                >
                    {senderDisplayName}
                </PWText>
            )
        }
    }

    return (
        <PWView style={styles.content}>
            <PWText
                truncate
                style={isExternal ? styles.secondaryText : styles.primaryText}
            >
                {t(`transactions.type.${tx.txType}`)}
            </PWText>
            {secondary}
        </PWView>
    )
}
