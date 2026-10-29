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

import { useCallback } from 'react'
import { PWIcon, PWLoadingIndicator, PWView } from '@components/core'
import type { ScopedAssetSearchResult } from '@perawallet/wallet-core-assets'
// Import the leaf directly (not the AssetItem barrel) so the search row doesn't
// drag in AccountAssetItemView -> CollectibleListItem -> CollectibleThumbnail.
import { AssetItemView } from '@modules/assets/components/AssetItem/AssetItemView'
import { ChainLabel } from '../ChainLabel'
import { useStyles } from './styles'

type AssetSearchItemProps = {
    result: ScopedAssetSearchResult
    isOptedIn: boolean
    isOptingIn: boolean
    /** Omitted where the asset can't be added: the row shows no add action. */
    onAdd?: (result: ScopedAssetSearchResult) => void
    /** Names the asset's network, for results that span chains. */
    showsNetwork?: boolean
}

export const AssetSearchItem = ({
    result,
    isOptedIn,
    isOptingIn,
    onAdd,
    showsNetwork = false,
}: AssetSearchItemProps) => {
    const styles = useStyles()
    const { asset, scope } = result
    const handlePress = useCallback(() => onAdd?.(result), [onAdd, result])

    const renderIcon = () => {
        if (isOptingIn) return <PWLoadingIndicator size='sm' />
        if (isOptedIn) {
            return (
                <PWIcon
                    name='check'
                    size='sm'
                    variant='positive'
                />
            )
        }
        if (onAdd) {
            return (
                <PWIcon
                    name='plus'
                    size='sm'
                    variant='primary'
                    testID={`asset_search_item_add_${asset.assetId}`}
                />
            )
        }
        return null
    }
    const icon = renderIcon()
    const action = icon ? (
        <PWView style={styles.actionButton}>{icon}</PWView>
    ) : undefined

    return (
        <>
            <AssetItemView
                asset={asset}
                chainId={scope.chainId}
                right={action}
                footer={
                    showsNetwork ? (
                        <ChainLabel chainId={scope.chainId} />
                    ) : undefined
                }
                onPress={onAdd ? handlePress : undefined}
                disabled={!onAdd || isOptedIn || isOptingIn}
                style={styles.container}
            />
            <PWView style={styles.separator} />
        </>
    )
}
