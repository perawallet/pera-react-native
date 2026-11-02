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

import { useCallback, useEffect, type ReactElement } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useAssetInboxRequestsQuery,
    type AssetInboxRequest,
} from '@perawallet/wallet-core-transactions'
import { isIntegrityRequiredError } from '@perawallet/wallet-core-shared'
import { PWDivider } from '@components/core'
import { AssetTransferRequestItem } from '@modules/transactions/components/claim-assets/AssetTransferRequestItem'
import { useStyles } from './styles'
import { useClaimAssets } from '@modules/transactions/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { MessagesStackParamList } from '@modules/messages'

type UseAssetTransferRequestsScreenResult = {
    scope: ChainScope
    assetRequests: AssetInboxRequest[]
    isPending: boolean
    isUnavailableOnNetwork: boolean
    isIntegrityBlocked: boolean
    handleItemPress: (index: number) => void
    renderItem: (params: {
        item: AssetInboxRequest
        index: number
    }) => ReactElement
    renderSeparator: () => ReactElement
    keyExtractor: (item: AssetInboxRequest, index: number) => string
}

export const useAssetTransferRequestsScreen =
    (): UseAssetTransferRequestsScreenResult => {
        const { push } = useAppNavigation()
        const styles = useStyles()
        const route =
            useRoute<
                RouteProp<MessagesStackParamList, 'AssetTransferRequests'>
            >()
        const { scope } = route.params
        const { setAccountAddress, setAssetRequests } = useClaimAssets()

        useEffect(() => {
            setAccountAddress(route.params.item.address)
        }, [route.params.item.address, setAccountAddress])
        const {
            data: assetRequests,
            isPending,
            isError,
            error,
            isUnavailableOnNetwork,
        } = useAssetInboxRequestsQuery(scope, route.params.item.address)
        const isIntegrityBlocked = isError && isIntegrityRequiredError(error)

        const handleItemPress = useCallback(
            (index: number) => {
                if (!assetRequests) return
                setAssetRequests(assetRequests)
                push('Messages', {
                    screen: 'AssetClaimDetail',
                    params: {
                        assetIndex: index,
                        scope,
                    },
                })
            },
            [push, assetRequests, setAssetRequests, scope],
        )

        const renderItem = useCallback(
            ({ item, index }: { item: AssetInboxRequest; index: number }) => (
                <AssetTransferRequestItem
                    item={item}
                    scope={scope}
                    onPress={() => handleItemPress(index)}
                />
            ),
            [handleItemPress, scope],
        )

        const renderSeparator = useCallback(
            () => <PWDivider style={styles.separator} />,
            [styles.separator],
        )

        const keyExtractor = useCallback(
            (item: AssetInboxRequest, index: number) =>
                String(item.id ?? '' + index),
            [],
        )

        return {
            scope,
            assetRequests: assetRequests ?? [],
            isPending,
            isUnavailableOnNetwork,
            isIntegrityBlocked,
            handleItemPress,
            renderItem,
            renderSeparator,
            keyExtractor,
        }
    }
