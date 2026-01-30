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

import { PWDivider, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { AddressDisplay } from '@components/AddressDisplay'
import {
    getAssetConfigType,
    microAlgosToAlgos,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import {
    formatNumber,
    formatWithUnits,
} from '@perawallet/wallet-core-shared'
import { useMemo } from 'react'

export type AssetConfigDisplayProps = {
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
}

export const AssetConfigDisplay = ({
    transaction,
    isInnerTransaction = false,
}: AssetConfigDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const assetConfig = transaction.assetConfigTransaction

    const configType = getAssetConfigType(transaction)
    const assetId = assetConfig?.assetId
    const showWarnings = !transaction?.id

    const supply = useMemo(() => {
        const { amount, unit } = assetConfig?.params?.total
            ? formatWithUnits(Decimal(assetConfig?.params?.total.toString()))
            : { amount: undefined, unit: undefined }

        if (!amount) {
            return undefined
        }

        const { integer, fraction } = formatNumber(amount, 2)
        return `${integer}${fraction}${unit}`
    }, [assetConfig?.params?.total])

    if (!assetConfig) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                {configType !== 'create' && assetId !== undefined && (
                    <KeyValueRow title={t('transactions.common.asset_id')}>
                        <PWText>{assetId.toString()}</PWText>
                    </KeyValueRow>
                )}

                {configType === 'create' && (
                    <>
                        {assetConfig.params?.name && (
                            <KeyValueRow
                                title={t('transactions.asset_config.name')}
                            >
                                <PWText>{assetConfig.params.name}</PWText>
                            </KeyValueRow>
                        )}

                        {assetConfig.params?.unitName && (
                            <KeyValueRow
                                title={t('transactions.asset_config.unit')}
                            >
                                <PWText>{assetConfig.params.unitName}</PWText>
                            </KeyValueRow>
                        )}

                        {assetConfig.params?.url && (
                            <KeyValueRow
                                title={t('transactions.asset_config.url')}
                            >
                                <PWText>{assetConfig.params.url}</PWText>
                            </KeyValueRow>
                        )}

                        {!!supply && (
                            <KeyValueRow
                                title={t('transactions.asset_config.total')}
                            >
                                <PWText>{supply}</PWText>
                            </KeyValueRow>
                        )}

                        {assetConfig.params?.decimals !== undefined && (
                            <KeyValueRow
                                title={t('transactions.asset_config.decimals')}
                            >
                                <PWText>{assetConfig.params.decimals}</PWText>
                            </KeyValueRow>
                        )}

                        {assetConfig.params?.defaultFrozen !== undefined && (
                            <KeyValueRow
                                title={t(
                                    'transactions.asset_config.default_frozen',
                                )}
                            >
                                <PWText>
                                    {assetConfig.params.defaultFrozen
                                        ? t('common.yes')
                                        : t('common.no')}
                                </PWText>
                            </KeyValueRow>
                        )}
                    </>
                )}

                {assetConfig.params?.manager && (
                    <KeyValueRow title={t('transactions.asset_config.manager')}>
                        <PWView style={styles.detailRow}>
                            <AddressDisplay
                                address={assetConfig.params.manager}
                            />
                        </PWView>
                    </KeyValueRow>
                )}

                {assetConfig.params?.reserve && (
                    <KeyValueRow title={t('transactions.asset_config.reserve')}>
                        <PWView style={styles.detailRow}>
                            <AddressDisplay
                                address={assetConfig.params.reserve}
                            />
                        </PWView>
                    </KeyValueRow>
                )}

                {assetConfig.params?.freeze && (
                    <KeyValueRow
                        title={t('transactions.asset_config.freeze_addr')}
                    >
                        <PWView style={styles.detailRow}>
                            <AddressDisplay
                                address={assetConfig.params.freeze}
                            />
                        </PWView>
                    </KeyValueRow>
                )}

                {assetConfig.params?.clawback && (
                    <KeyValueRow
                        title={t('transactions.asset_config.clawback')}
                    >
                        <PWView style={styles.detailRow}>
                            <AddressDisplay
                                address={assetConfig.params.clawback}
                            />
                        </PWView>
                    </KeyValueRow>
                )}

                <KeyValueRow title={t('transactions.common.fee')}>
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={6}
                        minPrecision={2}
                        value={Decimal(
                            microAlgosToAlgos(transaction.fee ?? 0n),
                        )}
                        showSymbol
                    />
                </KeyValueRow>

                <TransactionNoteRow transaction={transaction} />
            </PWView>

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}
