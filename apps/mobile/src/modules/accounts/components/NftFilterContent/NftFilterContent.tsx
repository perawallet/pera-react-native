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
import { PWButton, PWSwitch, PWText, PWView } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type NftFilterContentProps = {
    showOptedIn: boolean
    showWatchAccounts: boolean
    onToggleOptedIn: (value: boolean) => void
    onToggleWatchAccounts: (value: boolean) => void
}

export const NftFilterContent = ({
    showOptedIn,
    showWatchAccounts,
    onToggleOptedIn,
    onToggleWatchAccounts,
}: NftFilterContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()

    return (
        <>
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
                style={styles.toolbar}
            />

            <PWView style={styles.contentContainer}>
                <PWView style={styles.filterRow}>
                    <PWView style={styles.filterTextContainer}>
                        <PWText style={styles.filterLabel}>
                            {t('account_details.nfts.filter_opted_in')}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.filterDescription}
                        >
                            {t(
                                'account_details.nfts.filter_opted_in_description',
                            )}
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
            </PWView>
        </>
    )
}
