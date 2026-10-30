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

import DraggableFlatList from 'react-native-draggable-flatlist'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { useDraggableAccountList } from './useDraggableAccountList'

type DraggableAccountListProps = {
    accounts: WalletAccount[]
    onReorder: (orderedIds: string[]) => void
}

export const DraggableAccountList = ({
    accounts,
    onReorder,
}: DraggableAccountListProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })

    const { renderItem, keyExtractor, handleDragEnd } = useDraggableAccountList({
        onReorder,
    })

    return (
        <DraggableFlatList
            data={accounts}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            onDragEnd={handleDragEnd}
            activationDistance={10}
            showsVerticalScrollIndicator={false}
            containerStyle={styles.listFill}
            contentContainerStyle={styles.listContent}
        />
    )
}
