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

import { PWText, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    encodeAlgorandAddress,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type AssetConfigDisplayProps = {
    transaction: PeraTransaction
}

type AssetConfigType = 'create' | 'update' | 'destroy'

const getAssetConfigType = (tx: PeraTransaction): AssetConfigType => {
    const assetConfig = tx.assetConfig
    if (!assetConfig) {
        return 'update'
    }

    if (assetConfig.assetId === BigInt(0)) {
        return 'create'
    }

    const hasNoAddresses =
        assetConfig.manager === undefined &&
        assetConfig.reserve === undefined &&
        assetConfig.freeze === undefined &&
        assetConfig.clawback === undefined

    if (hasNoAddresses) {
        return 'destroy'
    }

    return 'update'
}

export const AssetConfigDisplay = ({
    transaction,
}: AssetConfigDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const assetConfig = transaction.assetConfig
    if (!assetConfig) {
        return null
    }

    const configType = getAssetConfigType(transaction)
    const assetId = assetConfig.assetId.toString()

    const getTitleKey = () => {
        switch (configType) {
            case 'create':
                return 'signing.tx_display.asset_config.create_title'
            case 'destroy':
                return 'signing.tx_display.asset_config.destroy_title'
            default:
                return 'signing.tx_display.asset_config.update_title'
        }
    }

    return (
        <PWView style={styles.container}>
            <TransactionIcon
                type='asset-config'
                size='large'
            />
            <PWText variant='h4'>{t(getTitleKey())}</PWText>

            <PWView style={styles.detailsContainer}>
                {configType !== 'create' && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.common.asset_id')}
                        </PWText>
                        <PWText style={styles.value}>{assetId}</PWText>
                    </PWView>
                )}

                {configType === 'create' && (
                    <>
                        {assetConfig.assetName && (
                            <PWView style={styles.detailRow}>
                                <PWText style={styles.label}>
                                    {t('signing.tx_display.asset_config.name')}
                                </PWText>
                                <PWText style={styles.value}>
                                    {assetConfig.assetName}
                                </PWText>
                            </PWView>
                        )}

                        {assetConfig.unitName && (
                            <PWView style={styles.detailRow}>
                                <PWText style={styles.label}>
                                    {t('signing.tx_display.asset_config.unit')}
                                </PWText>
                                <PWText style={styles.value}>
                                    {assetConfig.unitName}
                                </PWText>
                            </PWView>
                        )}

                        {assetConfig.total !== undefined && (
                            <PWView style={styles.detailRow}>
                                <PWText style={styles.label}>
                                    {t('signing.tx_display.asset_config.total')}
                                </PWText>
                                <PWText style={styles.value}>
                                    {assetConfig.total.toString()}
                                </PWText>
                            </PWView>
                        )}

                        {assetConfig.decimals !== undefined && (
                            <PWView style={styles.detailRow}>
                                <PWText style={styles.label}>
                                    {t(
                                        'signing.tx_display.asset_config.decimals',
                                    )}
                                </PWText>
                                <PWText style={styles.value}>
                                    {assetConfig.decimals}
                                </PWText>
                            </PWView>
                        )}

                        {assetConfig.defaultFrozen !== undefined && (
                            <PWView style={styles.detailRow}>
                                <PWText style={styles.label}>
                                    {t(
                                        'signing.tx_display.asset_config.default_frozen',
                                    )}
                                </PWText>
                                <PWText style={styles.value}>
                                    {assetConfig.defaultFrozen
                                        ? t('common.yes')
                                        : t('common.no')}
                                </PWText>
                            </PWView>
                        )}
                    </>
                )}

                {assetConfig.manager && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.asset_config.manager')}
                        </PWText>
                        <PWText style={styles.value}>
                            {truncateAlgorandAddress(
                                encodeAlgorandAddress(
                                    assetConfig.manager.publicKey,
                                ),
                            )}
                        </PWText>
                    </PWView>
                )}

                {assetConfig.reserve && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.asset_config.reserve')}
                        </PWText>
                        <PWText style={styles.value}>
                            {truncateAlgorandAddress(
                                encodeAlgorandAddress(
                                    assetConfig.reserve.publicKey,
                                ),
                            )}
                        </PWText>
                    </PWView>
                )}

                {assetConfig.freeze && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.asset_config.freeze_addr')}
                        </PWText>
                        <PWText style={styles.value}>
                            {truncateAlgorandAddress(
                                encodeAlgorandAddress(
                                    assetConfig.freeze.publicKey,
                                ),
                            )}
                        </PWText>
                    </PWView>
                )}

                {assetConfig.clawback && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.asset_config.clawback')}
                        </PWText>
                        <PWText style={styles.value}>
                            {truncateAlgorandAddress(
                                encodeAlgorandAddress(
                                    assetConfig.clawback.publicKey,
                                ),
                            )}
                        </PWText>
                    </PWView>
                )}

                {configType === 'destroy' && (
                    <PWView style={styles.warningContainer}>
                        <PWText style={styles.warningText}>
                            {t(
                                'signing.tx_display.asset_config.destroy_warning',
                            )}
                        </PWText>
                    </PWView>
                )}
            </PWView>
        </PWView>
    )
}
