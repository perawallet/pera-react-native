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

import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { PWButton, PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useLanguage } from '@hooks/useLanguage'
import {
    TransactionDetailAddress,
    TransactionDetailCard,
} from '@modules/signing'
import { AssetAmount } from '@components/AssetAmount'
import { LoadingView } from '@components/LoadingView'
import { AssetTitle } from '@modules/assets'
import { ViewTextDetailsContent } from '@components/ViewTextDetailsContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCallback } from 'react'
import { useAssetTransferDisplay } from './useAssetTransferDisplay'

export type AssetTransferDisplayProps = {
    transaction: AlgorandTransactionView
}

export const AssetTransferDisplay = ({
    transaction,
}: AssetTransferDisplayProps) => {
    const { t } = useLanguage()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)

    const {
        asset,
        isAssetPending,
        closeToAddress,
        closeAmountValue,
        metadataHash,
        assetTransfer,
    } = useAssetTransferDisplay(transaction)

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

    if (!assetTransfer) {
        return null
    }

    const renderAsset = () => {
        if (asset) {
            return (
                <AssetTitle
                    chainId={LEGACY_CHAIN_ID}
                    asset={asset}
                    nameVariant='body'
                    showId
                />
            )
        }
        if (isAssetPending) {
            return (
                <LoadingView
                    size='sm'
                    variant='circle'
                />
            )
        }
        return (
            <PWText variant='body'>
                {t('transactions.common.asset_unavailable')}
            </PWText>
        )
    }

    return (
        <TransactionDetailCard>
            <KeyValueRow title={t('transactions.common.asset')}>
                {renderAsset()}
            </KeyValueRow>

            {closeToAddress && (
                <KeyValueRow
                    testID='transaction_detail_close_to'
                    title={t('transactions.common.close_to')}
                >
                    <TransactionDetailAddress
                        address={closeToAddress}
                        scope={scope}
                    />
                </KeyValueRow>
            )}

            {closeToAddress && closeAmountValue && (
                <KeyValueRow
                    testID='transaction_detail_close_amount'
                    title={t('transactions.common.close_amount')}
                >
                    <AssetAmount
                        chainId={LEGACY_CHAIN_ID}
                        isLoading={isAssetPending}
                        asset={asset}
                        value={closeAmountValue}
                        showSymbol
                        ignorePrivacyMode
                    />
                </KeyValueRow>
            )}

            {assetTransfer.sender && (
                <KeyValueRow
                    title={t('transactions.asset_transfer.clawback_from')}
                >
                    <TransactionDetailAddress
                        address={assetTransfer.sender}
                        scope={scope}
                    />
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
