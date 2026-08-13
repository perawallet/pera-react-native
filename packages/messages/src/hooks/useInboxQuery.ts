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

import { useCallback, useMemo } from 'react'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { IN_FLIGHT_SIGN_REQUEST_STATUSES } from '@perawallet/wallet-core-multisig'
import {
    queryOptions,
    useQuery,
    type UseQueryResult,
} from '@tanstack/react-query'
import { fetchInbox, type InboxResponse } from '../api/inbox'
import type { InboxItem } from '../models'
import { getInboxQueryKey } from './querykeys'
import { mapInboxResponse } from './mappers'
import { sortInboxItems } from '../utils'

const INBOX_IN_FLIGHT_POLL_INTERVAL_MS = 10_000

/**
 * Single owner of the shared inbox query. Query-level options (queryFn,
 * retry) are last-observer-wins in TanStack, so every observer of
 * `getInboxQueryKey` must spread these options rather than redeclare them —
 * per-observer `select` is the only thing a consumer should add.
 */
export const useInboxQueryOptions = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network) ?? ''
    const signingAccounts = useSigningAccounts()

    const addresses = useMemo(
        () => signingAccounts.map(a => a.address),
        [signingAccounts],
    )

    return useMemo(
        () =>
            queryOptions({
                queryKey: getInboxQueryKey(network, deviceID, addresses),
                queryFn: () => fetchInbox(network, deviceID, addresses),
                enabled: !!deviceID.length && !!addresses.length,
                // Self-heal stale rows after a multisig sign action: poll only
                // while the cached response still contains a non-terminal sign
                // request, and stop automatically once everything settles.
                // Operates on raw `InboxResponse` — `select` does not run for
                // this callback.
                refetchInterval: query => {
                    const data = query.state.data
                    if (!data) return false
                    const hasInFlight =
                        data.joint_account_sign_requests.some(r =>
                            IN_FLIGHT_SIGN_REQUEST_STATUSES.has(r.status),
                        )
                    return hasInFlight
                        ? INBOX_IN_FLIGHT_POLL_INTERVAL_MS
                        : false
                },
                // Belt-and-suspenders against the global default (`retry: 0` in
                // QueryProvider). Inbox is best-effort: the sibling notification-
                // status poll (useInboxStatus) is what keeps it fresh, so a single
                // failure can simply propagate. This avoids retry-storming
                // TimeoutErrors, which on some Hermes builds have been observed to
                // trip ky's Error subclass via Babel's `_construct` helper.
                retry: false,
            }),
        [network, deviceID, addresses],
    )
}

export const useInboxQuery = (): UseQueryResult<InboxItem[], Error> => {
    const inboxQueryOptions = useInboxQueryOptions()
    const signingAccounts = useSigningAccounts()
    const allAccounts = useAllAccounts()

    const localAddresses = useMemo(
        () => new Set(allAccounts.map(a => a.address)),
        [allAccounts],
    )

    return useQuery({
        ...inboxQueryOptions,
        select: useCallback(
            (data: InboxResponse) =>
                mapInboxResponse(data)
                    .filter(item => {
                        if (item.type === 'asa_inbox') {
                            return item.data.requestCount > 0
                        }
                        if (item.type === 'multisig_import') {
                            return !localAddresses.has(item.data.address)
                        }
                        return true
                    })
                    .sort((a, b) => sortInboxItems(a, b, signingAccounts)),
            [signingAccounts, localAddresses],
        ),
    })
}
