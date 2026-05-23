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

import { PWButton, PWSlideToConfirm, PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import {
    ALGO_ASSET,
    toWholeUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { MIN_TXN_FEE } from '@perawallet/wallet-core-blockchain'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { AssetNameBadge } from '@modules/assets/components/AssetNameBadge'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'
import { useStyles } from './styles'

const MIN_FEE_WHOLE_UNITS = toWholeUnits(Number(MIN_TXN_FEE), ALGO_ASSET)

export type OptInConfirmationContentProps = {
    assetId: string
    accountAddress: string
}

export const OptInConfirmationContent = ({
    assetId,
    accountAddress,
}: OptInConfirmationContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()

    const { data: assets } = useAssetsQuery([assetId])
    const asset = assets?.get(assetId)

    const assetDisplayName = asset?.name ?? assetId
    const unitName = asset?.unitName
    const verificationTier = asset?.peraMetadata?.verificationTier
    const isFavorited = asset?.peraMetadata?.isFavorited ?? false

    const handleCopyId = () => {
        copyToClipboard(assetId)
    }

    return (
        <PWView style={styles.container}>
            <SheetHeader title={t('add_asset.confirmation.title')} />

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
                        style={styles.rowLabel}
                        truncate
                    >
                        {t('add_asset.confirmation.account_label')}
                    </PWText>
                    <PWView style={styles.rowTrailing}>
                        <AddressDisplay
                            address={accountAddress}
                            showCopy={false}
                        />
                    </PWView>
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
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={ALGO_ASSET.decimals}
                        minPrecision={DEFAULT_PRECISION}
                        value={MIN_FEE_WHOLE_UNITS}
                        showSymbol
                        style={styles.rowValue}
                    />
                </PWView>

                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('add_asset.confirmation.description')}
                </PWText>

                <PWView style={styles.buttonContainer}>
                    <PWSlideToConfirm
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={() => resolve('confirm')}
                        testID='opt_in_confirm'
                    />
                    <PWButton
                        title={t('add_asset.confirmation.close')}
                        variant='linkNeutral'
                        onPress={dismiss}
                        testID='opt_in_cancel'
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}
