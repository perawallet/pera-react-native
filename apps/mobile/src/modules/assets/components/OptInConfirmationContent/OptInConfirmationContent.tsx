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

import type { Decimal } from 'decimal.js'
import { PWButton, PWSheetLayout, PWText, PWView } from '@components/core'
import { ConfirmAction } from '@components/ConfirmAction'
import { AssetAmount } from '@components/AssetAmount'
import { AddressDisplay } from '@components/AddressDisplay'
import { ALGO_ASSET, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { AssetNameBadge } from '@modules/assets/components/AssetNameBadge'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'
import { useOptInConfirmationContent } from './useOptInConfirmationContent'
import { useStyles } from './styles'

export type OptInConfirmationContentProps = {
    assetId: string
    accountAddress: string
    /**
     * Fee shown to the user, in ALGO. Defaults to the minimum transaction
     * fee; pass 0 for sponsored (fee-delegated) opt-ins.
     */
    fee?: Decimal
}

export const OptInConfirmationContent = ({
    assetId,
    accountAddress,
    fee,
}: OptInConfirmationContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()
    const { resolve } = useBottomSheetResult<'confirm'>()
    const { resolvedFee } = useOptInConfirmationContent(accountAddress, fee)

    const { data: assets } = useAssetsQuery([assetId])
    const asset = assets?.get(assetId)

    const assetDisplayName = asset?.name ?? assetId
    const unitName = asset?.unitName
    const verificationTier = asset?.peraMetadata?.verificationTier
    const isFavorited = asset?.peraMetadata?.isFavorited ?? false

    const handleCopyId = () => {
        void copyToClipboard(assetId)
    }

    const handleConfirm = () => resolve('confirm')

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('add_asset.confirmation.title')} />}
        >
            <PWView style={styles.body}>
                <PWView style={styles.assetNameRow}>
                    <AssetNameBadge
                        name={assetDisplayName}
                        verificationTier={verificationTier}
                        isFavorited={isFavorited}
                        textVariant='h3'
                    />
                </PWView>
                {!!unitName && (
                    <PWView style={styles.unitNameRow}>
                        <PWText
                            variant='body'
                            style={styles.unitName}
                        >
                            {unitName}
                        </PWText>
                    </PWView>
                )}

                <PWView style={styles.divider} />

                <PWView style={styles.row}>
                    <PWText
                        variant='body'
                        style={styles.rowLabel}
                        truncate
                    >
                        {assetId}
                    </PWText>
                    <PWButton
                        title={t('add_asset.confirmation.copy_id')}
                        variant='secondary'
                        paddingStyle='dense'
                        onPress={handleCopyId}
                        testID='opt_in_copy_id'
                        rounded
                    />
                </PWView>

                <PWView style={styles.divider} />

                <PWView style={styles.row}>
                    <PWText
                        variant='body'
                        style={styles.accountLabel}
                    >
                        {t('add_asset.confirmation.account_label')}
                    </PWText>
                    <AddressDisplay
                        address={accountAddress}
                        showCopy={false}
                        hugContent
                        textProps={{ variant: 'body' }}
                    />
                </PWView>

                <PWView style={styles.divider} />

                <PWView style={styles.row}>
                    <PWText
                        variant='body'
                        style={styles.rowLabel}
                        truncate
                    >
                        {t('add_asset.confirmation.fee_label')}
                    </PWText>
                    <AssetAmount
                        asset={ALGO_ASSET}
                        value={resolvedFee}
                        showSymbol
                        style={styles.rowValue}
                        testID='opt_in_fee'
                    />
                </PWView>

                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('add_asset.confirmation.description')}
                </PWText>

                <ConfirmAction
                    title={t('common.slide_to_confirm.label')}
                    onConfirm={handleConfirm}
                    style={styles.confirmButton}
                    testID='opt_in_confirm'
                />
            </PWView>
        </PWSheetLayout>
    )
}
