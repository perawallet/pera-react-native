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
    PWBottomSheet,
    PWButton,
    PWHeader,
    PWText,
    PWView,
} from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET,
    toWholeUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { MIN_TXN_FEE } from '@perawallet/wallet-core-blockchain'
import {
    DEFAULT_PRECISION,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'
import { useStyles } from './styles'

const MIN_FEE_WHOLE_UNITS = toWholeUnits(Number(MIN_TXN_FEE), ALGO_ASSET)

export type OptOutConfirmationBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    accountBalance: Nullable<AssetWithAccountBalance>
    accountAddress: string
    accountName: string
    onConfirmOptOut: () => void
    isLoading?: boolean
}

export const OptOutConfirmationBottomSheet = ({
    isVisible,
    onClose,
    accountBalance,
    accountAddress,
    accountName,
    onConfirmOptOut,
    isLoading,
}: OptOutConfirmationBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const { data: assets } = useAssetsQuery(
        accountBalance ? [accountBalance.assetId] : [],
    )
    const asset = accountBalance
        ? assets?.get(accountBalance.assetId)
        : undefined

    if (!accountBalance) {
        return null
    }

    const assetDisplayName = asset?.name ?? accountBalance.assetId
    const unitName = asset?.unitName

    const handleCopyId = () => {
        copyToClipboard(accountBalance.assetId)
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            size='auto'
        >
            <PWHeader
                leftIcon='cross'
                onLeftPress={onClose}
                title={t('asset_opt_out.title')}
            />

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
                    <PWButton
                        title={t('asset_opt_out.remove')}
                        variant='primary'
                        onPress={onConfirmOptOut}
                        isLoading={isLoading}
                        isDisabled={isLoading}
                        testID='opt_out_confirm'
                    />
                    <PWButton
                        title={t('asset_opt_out.keep')}
                        variant='secondary'
                        onPress={onClose}
                        isDisabled={isLoading}
                        testID='opt_out_cancel'
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
