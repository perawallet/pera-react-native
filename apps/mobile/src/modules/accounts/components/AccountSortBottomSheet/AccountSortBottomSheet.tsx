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
    PWIcon,
    PWRadioButton,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { AccountSortModes } from '@perawallet/wallet-core-accounts'
import { useAccountSortBottomSheet } from './useAccountSortBottomSheet'
import { DraggableAccountList } from './DraggableAccountList'
import { useStyles } from './styles'

export type AccountSortContentProps = {
    onClose: () => void
}

export const AccountSortContent = ({ onClose }: AccountSortContentProps) => {
    const styles = useStyles()
    const {
        sortOptions,
        sortMode,
        sortedAccounts,
        handleSortModeChange,
        handleReorder,
        handleDone,
        t,
    } = useAccountSortBottomSheet({ onClose })

    return (
        <>
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        onPress={onClose}
                    />
                }
                center={<PWText variant='h4'>{t('account_sort.title')}</PWText>}
                right={
                    <PWButton
                        variant='link'
                        title={t('account_sort.done')}
                        onPress={handleDone}
                        paddingStyle='none'
                    />
                }
                paddingStyle='dense'
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
