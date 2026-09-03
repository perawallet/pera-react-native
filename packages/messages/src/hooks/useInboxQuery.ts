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
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import {
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { IN_FLIGHT_SIGN_REQUEST_STATUSES } from '@perawallet/wallet-core-multisig'
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchInbox, type InboxResponse } from '../api/inbox'
import type { InboxItem } from '../models'
import { getInboxQueryKey } from './querykeys'
import { mapInboxResponse } from './mappers'
import { sortInboxItems } from '../utils'

const INBOX_IN_FLIGHT_POLL_INTERVAL_MS = 10_000

/**
 * Single owner of the shared inbox query. Query-level options (queryFn,
 * retry) are last-observer-wins in TanStack, so every observer of
 * `getInboxQueryKey` must spread `queryOptions` rather than redeclare them —
 * per-observer `select` is the only thing a consumer should add.
 */
export const useInboxQueryOptions = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network) ?? ''
    const signingAccounts = useSigningAccounts()
    const isUnavailableOnNetwork = !isPeraBackedNetwork(network)

    const addresses = useMemo(
        () => signingAccounts.map(a => a.address),
        [signingAccounts],
    )

    const queryOptionsResult = useMemo(
        () =>
            queryOptions({
                queryKey: getInboxQueryKey(network, deviceID, addresses),
                queryFn: () => fetchInbox(network, deviceID, addresses),
                enabled:
                    !!deviceID.length &&
                    !!addresses.length &&
                    !isUnavailableOnNetwork,
                // Self-heal stale rows after a multisig sign action: poll only
                // while the cached response still contains a non-terminal sign
                // request, and stop automatically once everything settles.
                // Operates on raw `InboxResponse` — `select` does not run for
                // this callback.
                refetchInterval: query => {
                    const data = query.state.data
                    if (!data) return false
                    const hasInFlight = data.joint_account_sign_requests.some(
                        r => IN_FLIGHT_SIGN_REQUEST_STATUSES.has(r.status),
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
        [network, deviceID, addresses, isUnavailableOnNetwork],
    )

    return { queryOptions: queryOptionsResult, isUnavailableOnNetwork }
}

export type UseInboxQueryResult = {
    data: InboxItem[]
    isPending: boolean
    isRefetching: boolean
    isError: boolean
    error: Nullable<Error>
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
    /** Resolves to the refreshed items so callers can act on them (see `useHandleMultisigNotification`). */
    refetch: () => Promise<InboxItem[]>
}

export const useInboxQuery = (): UseInboxQueryResult => {
    const { queryOptions: inboxQueryOptions, isUnavailableOnNetwork } =
        useInboxQueryOptions()
    const signingAccounts = useSigningAccounts()
    const allAccounts = useAllAccounts()

    const localAddresses = useMemo(
        () => new Set(allAccounts.map(a => a.address)),
        [allAccounts],
    )

    const query = useQuery({
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

    return {
        data: query.data ?? [],
        isPending: isUnavailableOnNetwork ? false : query.isPending,
        isRefetching: isUnavailableOnNetwork ? false : query.isRefetching,
        isError: query.isError,
        error: query.error,
        isUnavailableOnNetwork,
        // The observer's refetch() ignores `enabled` and would still fire the
        // doomed Pera request on a non-backed network.
        refetch: async () => {
            if (isUnavailableOnNetwork) return []
            const { data } = await query.refetch()
            return data ?? []
        },
    }
}
