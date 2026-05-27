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
import { PWFlatList, PWScreen } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { SelectableAccountRow } from '@modules/accounts/components/SelectableAccountRow'
import { useRekeyToStandardSelectTargetScreen } from './useRekeyToStandardSelectTargetScreen'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const keyExtractor = (account: WalletAccount) => account.address

export const RekeyToStandardSelectTargetScreen = () => {
    const { t } = useLanguage()
    const { targets, handleSelect } = useRekeyToStandardSelectTargetScreen()

    const renderItem = useCallback(
        ({ item }: { item: WalletAccount }) => (
            <SelectableAccountRow
                account={item}
                onSelect={handleSelect}
                testID={`rekey-target-row-${item.address}`}
            />
        ),
        [handleSelect],
    )

    const renderEmpty = useCallback(
        () => <EmptyView body={t('rekey.to_standard.select.empty')} />,
        [t],
    )

    return (
        <PWScreen
            scroll={false}
            testID='rekey-to-standard-select-target-screen'
        >
            <ScreenHeader
                title={t('rekey.to_standard.select.title')}
                description={t('rekey.to_standard.select.subtitle')}
            />

            <PWFlatList
                data={targets}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                cardLayout
                ListEmptyComponent={renderEmpty}
            />
        </PWScreen>
    )
}
