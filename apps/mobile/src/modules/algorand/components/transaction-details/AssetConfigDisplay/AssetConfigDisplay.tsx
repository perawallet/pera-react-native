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

import { PWButton, PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { AddressDisplay } from '@components/AddressDisplay'
import { CopyableText } from '@components/CopyableText'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailCard } from '@modules/signing'
import { useAssetConfigDisplay } from './useAssetConfigDisplay'
import { ViewTextDetailsContent } from '@components/ViewTextDetailsContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCallback } from 'react'

export type AssetConfigDisplayProps = {
    transaction: AlgorandTransactionView
}

export const AssetConfigDisplay = ({
    transaction,
}: AssetConfigDisplayProps) => {
    const { t } = useLanguage()

    const { assetConfig, configType, assetId, supply, metadataHash } =
        useAssetConfigDisplay(transaction)

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
        <TransactionDetailCard>
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
                        <KeyValueRow title={t('transactions.asset_config.url')}>
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
                    <AddressDisplay address={assetConfig.params.manager} />
                </KeyValueRow>
            )}

            {assetConfig.params?.reserve && (
                <KeyValueRow title={t('transactions.asset_config.reserve')}>
                    <AddressDisplay address={assetConfig.params.reserve} />
                </KeyValueRow>
            )}

            {assetConfig.params?.freeze && (
                <KeyValueRow title={t('transactions.asset_config.freeze_addr')}>
                    <AddressDisplay address={assetConfig.params.freeze} />
                </KeyValueRow>
            )}

            {assetConfig.params?.clawback && (
                <KeyValueRow title={t('transactions.asset_config.clawback')}>
                    <AddressDisplay address={assetConfig.params.clawback} />
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
        </TransactionDetailCard>
    )
}
