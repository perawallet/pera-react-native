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

import { ActivityIndicator } from 'react-native'
import { PWIcon, PWView } from '@components/core'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
// Import the leaf directly (not the AssetItem barrel) so the search row doesn't
// drag in AccountAssetItemView -> CollectibleListItem -> CollectibleThumbnail.
import { AssetItemView } from '@modules/assets/components/AssetItem/AssetItemView'
import { useStyles } from './styles'

type AssetSearchItemProps = {
    item: DisplayableAsset
    isOptedIn: boolean
    isOptingIn: boolean
    onAdd: (assetId: string) => void
}

export const AssetSearchItem = ({
    item,
    isOptedIn,
    isOptingIn,
    onAdd,
}: AssetSearchItemProps) => {
    const styles = useStyles()

    const action = (
        <PWView style={styles.actionButton}>
            {isOptingIn ? (
                <ActivityIndicator size='small' />
            ) : isOptedIn ? (
                <PWIcon
                    name='check'
                    size='sm'
                    variant='positive'
                />
            ) : (
                <PWIcon
                    name='plus'
                    size='sm'
                    variant='primary'
                />
            )}
        </PWView>
    )

    return (
        <>
            <AssetItemView
                asset={item}
                right={action}
                onPress={() => onAdd(item.assetId)}
                disabled={isOptedIn || isOptingIn}
                style={styles.container}
            />
            <PWView style={styles.separator} />
        </>
    )
}
