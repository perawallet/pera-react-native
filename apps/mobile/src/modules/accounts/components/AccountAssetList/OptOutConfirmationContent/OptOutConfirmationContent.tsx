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
    PWButton,
    PWSheetLayout,
    PWSlideToConfirm,
    PWText,
    PWView,
} from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import {
    type AssetWithAccountBalance,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET,
    toWholeUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { MIN_TXN_FEE } from '@perawallet/wallet-core-blockchain'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'
import { useStyles } from './styles'

const MIN_FEE_WHOLE_UNITS = toWholeUnits(Number(MIN_TXN_FEE), ALGO_ASSET)

export type OptOutConfirmationContentProps = {
    accountBalance: AssetWithAccountBalance
    accountAddress: string
}

export const OptOutConfirmationContent = ({
    accountBalance,
    accountAddress,
}: OptOutConfirmationContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()

    const accountName = useAccountsStore(s => {
        const account = s.accounts.find(a => a.address === accountAddress)
        return account?.name ?? accountAddress
    })

    const { data: assets } = useAssetsQuery([accountBalance.assetId])
    const asset = assets?.get(accountBalance.assetId)

    const assetDisplayName = asset?.name ?? accountBalance.assetId
    const unitName = asset?.unitName

    const handleCopyId = () => {
        copyToClipboard(accountBalance.assetId)
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
                        {accountBalance.assetId}
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
                        textProps={{ style: styles.rowAddress }}
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
                    {t('asset_opt_out.description', {
                        assetName: unitName ?? assetDisplayName,
                        accountName,
                    })}
                </PWText>

                <PWView style={styles.buttonContainer}>
                    <PWSlideToConfirm
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
