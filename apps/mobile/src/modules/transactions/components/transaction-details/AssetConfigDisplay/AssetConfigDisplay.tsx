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

import { PWButton, PWDivider, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { AddressDisplay } from '@components/AddressDisplay'
import { CopyableText } from '@components/CopyableText'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionFeeRow } from '../TransactionFeeRow/TransactionFeeRow'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { useAssetConfigDisplay } from './useAssetConfigDisplay'
import { ViewTextDetailsContent } from '../../ViewTextDetailsContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCallback } from 'react'

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

    const {
        assetConfig,
        configType,
        assetId,
        showWarnings,
        supply,
        metadataHash,
    } = useAssetConfigDisplay(transaction)

    const { request: requestBottomSheet } = useBottomSheet()
    const openMetadataHashDetails = useCallback(() => {
        if (!metadataHash) return
        void requestBottomSheet({
            contents: (
                <ViewTextDetailsContent
                    text={metadataHash}
                    title={t('transactions.common.view_metadata')}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [metadataHash, requestBottomSheet, t])

    if (!assetConfig) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                {configType !== 'create' && assetId !== undefined && (
                    <KeyValueRow title={t('transactions.common.asset_id')}>
                        <CopyableText copyValue={assetId.toString()}>
                            <PWText>{assetId.toString()}</PWText>
                        </CopyableText>
                    </KeyValueRow>
                )}

                {configType === 'create' && (
                    <>
                        {assetConfig.params?.name && (
                            <KeyValueRow
                                title={t('transactions.asset_config.name')}
                            >
                                <PWText numberOfLines={1}>
                                    {assetConfig.params.name}
                                </PWText>
                            </KeyValueRow>
                        )}

                        {assetConfig.params?.unitName && (
                            <KeyValueRow
                                title={t('transactions.asset_config.unit')}
                            >
                                <PWText numberOfLines={1}>
                                    {assetConfig.params.unitName}
                                </PWText>
                            </KeyValueRow>
                        )}

                        {assetConfig.params?.url && (
                            <KeyValueRow
                                title={t('transactions.asset_config.url')}
                            >
                                <PWText numberOfLines={1}>
                                    {assetConfig.params.url}
                                </PWText>
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

                {metadataHash && (
                    <KeyValueRow
                        title={t('transactions.asset_config.metadata_hash')}
                    >
                        <PWButton
                            variant='linkPositive'
                            paddingStyle='none'
                            title={t('transactions.common.view_metadata')}
                            onPress={openMetadataHashDetails}
                        />
                    </KeyValueRow>
                )}

                <TransactionFeeRow transaction={transaction} />

                <TransactionNoteRow transaction={transaction} />
            </PWView>

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}
