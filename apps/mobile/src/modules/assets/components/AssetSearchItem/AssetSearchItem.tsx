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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWLoadingIndicator, PWView } from '@components/core'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
// Import the leaf directly (not the AssetItem barrel) so the search row doesn't
// drag in AccountAssetItemView -> CollectibleListItem -> CollectibleThumbnail.
import { AssetItemView } from '@modules/assets/components/AssetItem/AssetItemView'
import { ChainLabel } from '../AssetGroupRow'
import { useStyles } from './styles'

type AssetSearchItemProps = {
    item: DisplayableAsset
    isOptedIn: boolean
    isOptingIn: boolean
    /** Omitted where the asset can't be added: the row shows no add action. */
    onAdd?: (assetId: string) => void
    /** Names the asset's network, for results that span chains. */
    chainId?: ChainId
}

export const AssetSearchItem = ({
    item,
    isOptedIn,
    isOptingIn,
    onAdd,
    chainId,
}: AssetSearchItemProps) => {
    const styles = useStyles()

    const icon = isOptingIn ? (
        <PWLoadingIndicator size='sm' />
    ) : isOptedIn ? (
        <PWIcon
            name='check'
            size='sm'
            variant='positive'
        />
    ) : onAdd ? (
        <PWIcon
            name='plus'
            size='sm'
            variant='primary'
            testID={`asset_search_item_add_${item.assetId}`}
        />
    ) : null
    const action = icon ? (
        <PWView style={styles.actionButton}>{icon}</PWView>
    ) : undefined

    return (
        <>
            <AssetItemView
                asset={item}
                right={action}
                footer={chainId ? <ChainLabel chainId={chainId} /> : undefined}
                onPress={onAdd ? () => onAdd(item.assetId) : undefined}
                disabled={!onAdd || isOptedIn || isOptingIn}
                style={styles.container}
            />
            <PWView style={styles.separator} />
        </>
    )
}
