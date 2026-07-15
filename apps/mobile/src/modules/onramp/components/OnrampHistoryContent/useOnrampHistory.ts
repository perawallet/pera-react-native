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

import { useEffect, useRef, useState } from 'react'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'
import {
    useRampHistoryInfiniteQuery,
    type OnrampStatus,
    type RampHistoryItem,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'

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
}

export const useOnrampHistory = (isActive = true): UseOnrampHistoryResult => {
    const [statusFilter, setStatusFilter] =
        useState<Nullable<OnrampStatus>>(null)

    const { network } = useNetwork()
    const deviceId = useDeviceID(network) ?? ''
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const accountAddress = selectedAccountAddress ?? ''

    const {
        items,
        isLoading,
        isFetchingNextPage,
        isError,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useRampHistoryInfiniteQuery({
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
    }
}
