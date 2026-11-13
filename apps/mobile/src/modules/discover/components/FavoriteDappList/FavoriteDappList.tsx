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

import { PWFlatList } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import type { DiscoverFavorite } from '../../types'
import { dappHostOf } from '../../utils/normalizeDappUrl'
import { DappRow } from '../DappRow'
import { useStyles } from './styles'

export type FavoriteDappListProps = {
    dapps: DiscoverFavorite[]
    isVerified: (url: string) => boolean
    onPress: (dapp: DiscoverFavorite) => void
    onUnfavorite: (dapp: DiscoverFavorite) => void
    emptyText: string
    testIDPrefix: string
}

/** Favorite dApps as rows with a filled star; the star removes the favorite. */
export const FavoriteDappList = ({
    dapps,
    isVerified,
    onPress,
    onUnfavorite,
    emptyText,
    testIDPrefix,
}: FavoriteDappListProps) => {
    const styles = useStyles()

    return (
        <PWFlatList
            data={dapps}
            keyExtractor={dapp => dapp.url}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
                <EmptyView
                    body={emptyText}
                    style={styles.empty}
                    testID={`${testIDPrefix}_empty`}
                />
            }
            renderItem={({ item }) => (
                <DappRow
                    dapp={item}
                    subtitle={dappHostOf(item.url)}
                    isFavorite
                    isVerified={isVerified(item.url)}
                    showChains={false}
                    onPress={() => onPress(item)}
                    onToggleFavorite={() => onUnfavorite(item)}
                    testID={`${testIDPrefix}_${item.url}`}
                />
            )}
        />
    )
}
