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

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWFlatList, PWView } from '@components/core'
import type { Passkey } from '@perawallet/wallet-core-passkeys'
import { PasskeyListItem } from '../PasskeyListItem'
import { useStyles } from './styles'

export type PasskeysListProps = {
    passkeys: Passkey[]
    /** Rows this returns false for are rendered without a remove action. */
    canRemove: (passkey: Passkey) => boolean
    onRequestDelete: (passkey: Passkey) => void
}

const ItemSeparator = () => {
    const styles = useStyles()
    return <PWView style={styles.separator} />
}

export const PasskeysList = ({
    passkeys,
    canRemove,
    onRequestDelete,
}: PasskeysListProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })

    return (
        <PWFlatList
            data={passkeys}
            keyExtractor={passkey => passkey.id}
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            ItemSeparatorComponent={ItemSeparator}
            renderItem={({ item }) => (
                <PasskeyListItem
                    passkey={item}
                    onRemovePress={
                        canRemove(item) ? onRequestDelete : undefined
                    }
                    testID={`settings_passkeys_item_${item.id}`}
                />
            )}
        />
    )
}
