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

import { useCallback } from 'react'
import { PWFlatList, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { RekeyTargetRow } from '../../components/RekeyTargetRow'
import { useRekeySelectTargetScreen } from './useRekeySelectTargetScreen'
import { useStyles } from './styles'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const keyExtractor = (account: WalletAccount) => account.address

export const RekeySelectTargetScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { targets, handleSelect } = useRekeySelectTargetScreen()

    const renderItem = useCallback(
        ({ item }: { item: WalletAccount }) => (
            <RekeyTargetRow
                account={item}
                onSelect={handleSelect}
            />
        ),
        [handleSelect],
    )

    const renderEmpty = useCallback(
        () => (
            <PWView style={styles.empty}>
                <PWText
                    variant='bodyLarge'
                    style={styles.emptyText}
                >
                    {t('rekey.to_standard.select.empty')}
                </PWText>
            </PWView>
        ),
        [styles.empty, styles.emptyText, t],
    )

    return (
        <PWView
            style={styles.container}
            testID='rekey-to-standard-select-target-screen'
        >
            <PWView style={styles.header}>
                <PWText variant='h1'>
                    {t('rekey.to_standard.select.title')}
                </PWText>
                <PWText
                    variant='bodyLarge'
                    style={styles.subtitle}
                >
                    {t('rekey.to_standard.select.subtitle')}
                </PWText>
            </PWView>

            <PWFlatList
                contentContainerStyle={styles.list}
                data={targets}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListEmptyComponent={renderEmpty}
            />
        </PWView>
    )
}
