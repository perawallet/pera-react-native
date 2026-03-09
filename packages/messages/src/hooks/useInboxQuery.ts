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
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useSigningAccounts } from '@perawallet/wallet-core-accounts'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { fetchInbox, type InboxResponse } from '../api/inbox'
import type { InboxItem } from '../models'
import { getInboxQueryKey } from './querykeys'
import { mapInboxResponse } from './mappers'
import { sortInboxItems } from '../utils'

export const useInboxQuery = (): UseQueryResult<InboxItem[], Error> => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useSigningAccounts()

    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])

    return useQuery({
        queryKey: getInboxQueryKey(network, deviceID ?? '', addresses),
        queryFn: () => fetchInbox(network, deviceID ?? '', addresses),
        enabled: !!deviceID?.length && !!addresses.length,
        select: useCallback(
            (data: InboxResponse) =>
                mapInboxResponse(data)
                    .filter(item => {
                        if (item.type === 'asa_inbox') {
                            return item.data.requestCount > 0
                        }
                        return true
                    })
                    .sort((a, b) => sortInboxItems(a, b, accounts)),
            [accounts],
        ),
    })
}
