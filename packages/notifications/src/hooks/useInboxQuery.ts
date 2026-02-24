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

import { useCallback, useMemo } from 'react'
import {
    useDeviceID,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useQuery } from '@tanstack/react-query'
import { fetchInbox, type InboxResponse } from '../api/inbox'
import type { InboxItem } from '../models'
import { getInboxQueryKey } from './querykeys'
import { mapInboxResponse } from './mappers'
import { sortInboxItems } from '../utils'

export type UseInboxQueryResult = {
    inboxItems: InboxItem[]
    isPending: boolean
    isRefetching: boolean
    refetch: () => void
}

export const useInboxQuery = (): UseInboxQueryResult => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useAllAccounts()

    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])

    const query = useQuery({
        queryKey: getInboxQueryKey(network, deviceID ?? '', addresses.length),
        queryFn: () => fetchInbox(network, deviceID ?? '', addresses),
        enabled: !!deviceID?.length && !!addresses.length,
        select: useCallback(
            (data: InboxResponse) =>
                mapInboxResponse(data)
                    .filter(item => {
                        if (item.type === 'asa_inbox') {
                            return item.data.requestCount >= 0
                        }
                        return true
                    })
                    .sort((a, b) => sortInboxItems(a, b, accounts)),
            [accounts],
        ),
    })

    return {
        inboxItems: query.data ?? [],
        isPending: query.isPending,
        isRefetching: query.isRefetching,
        refetch: query.refetch,
    }
}
