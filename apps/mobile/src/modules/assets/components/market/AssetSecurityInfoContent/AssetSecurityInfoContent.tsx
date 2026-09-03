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
import { AddressDisplay } from '@components/AddressDisplay'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type AssetSecurityAuthority = 'freeze' | 'clawback'

export type AssetSecurityInfoContentProps = {
    authority: AssetSecurityAuthority
    address?: Nullable<string>
}

export const AssetSecurityInfoContent = ({
    authority,
    address,
}: AssetSecurityInfoContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult<void>()

    const isFreeze = authority === 'freeze'
    const title = t(
        isFreeze
            ? 'asset_details.markets.freeze'
            : 'asset_details.markets.clawback',
    )
    const body = t(
        isFreeze
            ? 'asset_details.markets.freeze_info_body'
            : 'asset_details.markets.clawback_info_body',
    )
    const addressLabel = t(
        isFreeze
            ? 'asset_details.markets.freeze_address'
            : 'asset_details.markets.clawback_address',
    )

    return (
        <PWSheetLayout>
            <PWView style={styles.content}>
                <PWText variant='h2'>{title}</PWText>
                <PWText
                    variant='bodyLarge'
                    style={styles.body}
                >
                    {body}
                </PWText>
                {!!address && (
                    <PWView style={styles.addressRow}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.addressLabel}
                        >
                            {addressLabel}
                        </PWText>
                        <AddressDisplay
                            address={address}
                            displayType='address-only'
                            hugContent
                        />
                    </PWView>
                )}
                <PWButton
                    variant='secondary'
                    title={t('common.close.label')}
                    onPress={dismiss}
                    style={styles.button}
                />
            </PWView>
        </PWSheetLayout>
    )
}
