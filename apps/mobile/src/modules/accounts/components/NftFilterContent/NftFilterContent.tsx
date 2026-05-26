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

import React from 'react'
import {
    PWButton,
    PWSheetLayout,
    PWSwitch,
    PWText,
    PWView,
} from '@components/core'
import { useCollectiblePreferencesStore } from '@perawallet/wallet-core-assets'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export const NftFilterContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()

    // Read the preference store directly so the sheet stays reactive — passing
    // these in as props would snapshot them at open time and the switches would
    // never update (the sheet content isn't re-rendered by its opener).
    const showOptedIn = useCollectiblePreferencesStore(
        state => state.showOptedIn,
    )
    const showWatchAccounts = useCollectiblePreferencesStore(
        state => state.showWatchAccounts,
    )
    const onToggleOptedIn = useCollectiblePreferencesStore(
        state => state.setShowOptedIn,
    )
    const onToggleWatchAccounts = useCollectiblePreferencesStore(
        state => state.setShowWatchAccounts,
    )

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('account_details.nfts.filter_title')}
                    rightAction={
                        <PWButton
                            variant='linkPositive'
                            title={t('account_details.nfts.filter_done')}
                            onPress={dismiss}
                            paddingStyle='none'
                        />
                    }
                />
            }
        >
            <PWView style={styles.filterRow}>
                <PWView style={styles.filterTextContainer}>
                    <PWText style={styles.filterLabel}>
                        {t('account_details.nfts.filter_opted_in')}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.filterDescription}
                    >
                        {t('account_details.nfts.filter_opted_in_description')}
                    </PWText>
                </PWView>
                <PWSwitch
                    value={showOptedIn}
                    onValueChange={onToggleOptedIn}
                />
            </PWView>

            <PWView style={styles.filterRow}>
                <PWView style={styles.filterTextContainer}>
                    <PWText style={styles.filterLabel}>
                        {t('account_details.nfts.filter_watch_accounts')}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.filterDescription}
                    >
                        {t(
                            'account_details.nfts.filter_watch_accounts_description',
                        )}
                    </PWText>
                </PWView>
                <PWSwitch
                    value={showWatchAccounts}
                    onValueChange={onToggleWatchAccounts}
                />
            </PWView>
        </PWSheetLayout>
    )
}
