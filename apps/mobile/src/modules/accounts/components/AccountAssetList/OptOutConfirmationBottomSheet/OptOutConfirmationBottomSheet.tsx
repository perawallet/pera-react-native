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

import { PWBottomSheet, PWButton, PWText, PWView } from '@components/core'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type OptOutConfirmationBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    accountBalance: AssetWithAccountBalance | null
    accountName: string
    onConfirmOptOut: () => void
}

export const OptOutConfirmationBottomSheet = ({
    isVisible,
    onClose,
    accountBalance,
    accountName,
    onConfirmOptOut,
}: OptOutConfirmationBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const { data: assets } = useAssetsQuery(
        accountBalance ? [accountBalance.assetId] : [],
    )
    const asset = accountBalance
        ? assets?.get(accountBalance.assetId)
        : undefined

    if (!accountBalance) {
        return null
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            size='auto'
        >
            <PWView style={styles.container}>
                <PWView style={styles.assetInfo}>
                    {asset && (
                        <AssetIcon
                            asset={asset}
                            size='xl'
                        />
                    )}
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {t('asset_opt_out.title')}
                    </PWText>
                    <PWText style={styles.description}>
                        {t('asset_opt_out.description', {
                            assetName: asset?.name ?? accountBalance.assetId,
                            accountName,
                        })}
                    </PWText>
                </PWView>

                <PWView style={styles.feeRow}>
                    <PWText style={styles.feeLabel}>
                        {t('asset_opt_out.fee_label')}
                    </PWText>
                    <PWText style={styles.feeValue}>0.001 ALGO</PWText>
                </PWView>

                <PWView style={styles.buttonContainer}>
                    <PWButton
                        title={t('asset_opt_out.remove')}
                        variant='destructive'
                        onPress={onConfirmOptOut}
                        testID='opt_out_confirm'
                    />
                    <PWButton
                        title={t('asset_opt_out.keep')}
                        variant='secondary'
                        onPress={onClose}
                        testID='opt_out_cancel'
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
