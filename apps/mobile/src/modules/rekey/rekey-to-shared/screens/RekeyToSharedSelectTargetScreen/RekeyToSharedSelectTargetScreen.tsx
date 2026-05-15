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
import { PWFlatList, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { ScreenHeader } from '@components/ScreenHeader'
import { useBottomSafeAreaPadding } from '@hooks/useBottomSafeAreaPadding'
import { useLanguage } from '@hooks/useLanguage'
import { RekeyTargetRow } from '../../../shared'
import { useRekeyToSharedSelectTargetScreen } from './useRekeyToSharedSelectTargetScreen'
import { useStyles } from './styles'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const keyExtractor = (account: WalletAccount) => account.address

export const RekeyToSharedSelectTargetScreen = () => {
    const bottomPadding = useBottomSafeAreaPadding()
    const styles = useStyles(bottomPadding)
    const { t } = useLanguage()
    const { targets, handleSelect } = useRekeyToSharedSelectTargetScreen()

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
        () => <EmptyView body={t('rekey.to_shared.select.empty')} />,
        [t],
    )

    return (
        <PWView
            style={styles.container}
            testID='rekey-to-shared-select-target-screen'
        >
            <ScreenHeader
                title={t('rekey.to_shared.select.title')}
                description={t('rekey.to_shared.select.subtitle')}
            />

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
