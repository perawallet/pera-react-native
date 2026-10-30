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

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
} from 'react'
import { PWView } from '@components/core'
import { useBottomSheet } from '@modules/bottom-sheet'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import {
    useRampHistoryInfiniteQuery,
    type OnrampStatus,
    type RampHistoryItem,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { OnrampHistoryListItem } from './OnrampHistoryListItem'
import { OnrampOrderDetailsContent } from '../OnrampOrderDetailsContent'
import { useStyles } from './styles'

export type UseOnrampHistoryResult = {
    items: RampHistoryItem[]
    statusFilter: Nullable<OnrampStatus>
    setStatusFilter: (status: Nullable<OnrampStatus>) => void
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
    handleEndReached: () => void
    handleItemPress: (item: RampHistoryItem) => void
    renderItem: (params: { item: RampHistoryItem }) => ReactElement
    ItemSeparator: () => ReactElement
}

export const useOnrampHistory = (isActive = true): UseOnrampHistoryResult => {
    const [statusFilter, setStatusFilter] =
        useState<Nullable<OnrampStatus>>(null)

    const styles = useStyles()
    const { request: requestBottomSheet } = useBottomSheet()
    const { scope, address } = useOnrampAccount()
    const deviceId = useDeploymentDeviceID(deploymentOf(scope)) ?? ''
    const accountAddress = address ?? ''

    const {
        items,
        isLoading,
        isFetchingNextPage,
        isError,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useRampHistoryInfiniteQuery({
        scope,
        deviceId,
        accountAddress,
        status: statusFilter ?? undefined,
        isActive,
    })

    // Pull fresh data the moment the tab becomes active (the poll then keeps it
    // current while it stays active).
    const wasActive = useRef(isActive)
    useEffect(() => {
        if (isActive && !wasActive.current) refetch()
        wasActive.current = isActive
    }, [isActive, refetch])

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const handleItemPress = useCallback(
        (item: RampHistoryItem) => {
            void requestBottomSheet({
                contents: <OnrampOrderDetailsContent item={item} />,
                options: {
                    size: 'modal',
                    enablePanDownToClose: true,
                    // OnrampOrderDetailsContent uses PWSheetLayout, which
                    // brings its own scroll container + safe-area padding.
                    autoCreateContainer: false,
                },
            })
        },
        [requestBottomSheet],
    )

    const renderItem = useCallback(
        ({ item }: { item: RampHistoryItem }) => (
            <OnrampHistoryListItem
                item={item}
                onPress={handleItemPress}
            />
        ),
        [handleItemPress],
    )

    const ItemSeparator = useCallback(
        () => <PWView style={styles.itemSeparator} />,
        [styles.itemSeparator],
    )

    return {
        items,
        statusFilter,
        setStatusFilter,
        isLoading,
        isFetchingNextPage,
        isError,
        hasNextPage,
        fetchNextPage,
        refetch,
        handleEndReached,
        handleItemPress,
        renderItem,
        ItemSeparator,
    }
}
