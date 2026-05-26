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

import { PWButton, PWRadioButton, PWText, PWView } from '@components/core'
import { AccountSortModes } from '@perawallet/wallet-core-accounts'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAccountSortContent } from './useAccountSortContent'
import { DraggableAccountList } from './DraggableAccountList'
import { useStyles } from './styles'

export type AccountSortContentProps = Record<string, never>

export const AccountSortContent = (_: AccountSortContentProps = {}) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { dismiss } = useBottomSheetResult<void>()
    const {
        sortOptions,
        sortMode,
        sortedAccounts,
        handleSortModeChange,
        handleReorder,
        t,
    } = useAccountSortContent()

    return (
        <>
            <SheetHeader
                title={t('account_sort.title')}
                rightAction={
                    <PWButton
                        variant='linkPositive'
                        title={t('account_sort.done')}
                        onPress={dismiss}
                        paddingStyle='none'
                    />
                }
                style={styles.toolbar}
            />

            <PWView style={styles.contentContainer}>
                {sortOptions.map(option => (
                    <PWRadioButton
                        key={option.mode}
                        title={t(option.labelKey)}
                        isSelected={sortMode === option.mode}
                        onPress={() => handleSortModeChange(option.mode)}
                        testID={`sort_option_${option.mode}`}
                    />
                ))}

                {sortMode === AccountSortModes.manual && (
                    <>
                        <PWText
                            variant='caption'
                            style={styles.subtitle}
                        >
                            {t('account_sort.reorganize_manually')}
                        </PWText>
                        <DraggableAccountList
                            accounts={sortedAccounts}
                            onReorder={handleReorder}
                        />
                    </>
                )}
            </PWView>
        </>
    )
}
