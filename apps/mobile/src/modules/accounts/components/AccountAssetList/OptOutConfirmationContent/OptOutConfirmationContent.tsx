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

import { PWButton, PWSheetLayout, PWText, PWView } from '@components/core'
import { ConfirmAction } from '@components/ConfirmAction'
import { AssetAmount } from '@components/AssetAmount'
import { AddressDisplay } from '@components/AddressDisplay'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'
import { useOptOutConfirmationContent } from './useOptOutConfirmationContent'
import { useStyles } from './styles'

export type OptOutConfirmationContentProps = {
    assetId: string
    accountAddress: string
}

export const OptOutConfirmationContent = ({
    assetId,
    accountAddress,
}: OptOutConfirmationContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
    const { fee } = useOptOutConfirmationContent()

    const accountName = useAccountsStore(s => {
        const account = s.accounts.find(a => a.address === accountAddress)
        return account?.name ?? accountAddress
    })

    const { data: assets } = useAssetsQuery([assetId])
    const asset = assets?.get(assetId)

    const assetDisplayName = asset?.name ?? assetId
    const unitName = asset?.unitName

    const handleCopyId = () => {
        void copyToClipboard(assetId)
    }

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('asset_opt_out.title')} />}
        >
            <PWView style={styles.body}>
                <PWView style={styles.assetNameRow}>
                    <PWText
                        variant='h3'
                        style={styles.assetName}
                    >
                        {assetDisplayName}
                    </PWText>
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
                    >
                        {assetId}
                    </PWText>
                    <PWButton
                        title={t('asset_opt_out.copy_id')}
                        variant='secondary'
                        paddingStyle='dense'
                        onPress={handleCopyId}
                        testID='opt_out_copy_id'
                        rounded
                    />
                </PWView>

                <PWView style={styles.divider} />

                <PWView style={styles.row}>
                    <PWText
                        variant='body'
                        style={styles.rowLabel}
                    >
                        {t('asset_opt_out.account_label')}
                    </PWText>
                    <AddressDisplay
                        address={accountAddress}
                        showCopy={false}
                        hugContent
                    />
                </PWView>

                <PWView style={styles.divider} />

                <PWView style={styles.row}>
                    <PWText
                        variant='body'
                        style={styles.rowLabel}
                    >
                        {t('asset_opt_out.fee_label')}
                    </PWText>
                    <AssetAmount
                        asset={ALGO_ASSET}
                        value={fee}
                        showSymbol
                        style={styles.rowValue}
                    />
                </PWView>

                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('asset_opt_out.description', {
                        assetName: unitName ?? assetDisplayName,
                        accountName,
                    })}
                </PWText>

                <PWView style={styles.buttonContainer}>
                    <ConfirmAction
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={() => resolve('confirm')}
                        testID='opt_out_confirm'
                    />
                    <PWButton
                        title={t('asset_opt_out.keep')}
                        variant='linkNeutral'
                        onPress={dismiss}
                        testID='opt_out_cancel'
                    />
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
