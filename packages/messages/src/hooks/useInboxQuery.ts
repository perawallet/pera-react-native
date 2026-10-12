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
import {
    legacyNetworkOf,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    addressOn,
    useAllAccounts,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { IN_FLIGHT_SIGN_REQUEST_STATUSES } from '@perawallet/wallet-core-multisig'
import { queryOptions, useQuery } from '@tanstack/react-query'
import {
    getQueryRenderState,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { fetchInbox, type InboxResponse } from '../api/inbox'
import type { InboxItem } from '../models'
import { getInboxQueryKey } from './querykeys'
import { mapInboxResponse } from './mappers'
import { sortInboxItems } from '../utils'

const INBOX_IN_FLIGHT_POLL_INTERVAL_MS = 10_000

const addressesOn = (
    accounts: readonly WalletAccount[],
    scope: ChainScope,
): string[] =>
    accounts.flatMap(account => {
        const address = addressOn(account, scope)
        return address ? [address] : []
    })

/**
 * Single owner of the shared inbox query. Query-level options (queryFn,
 * retry) are last-observer-wins in TanStack, so every observer of
 * `getInboxQueryKey` must spread `queryOptions` rather than redeclare them —
 * per-observer `select` is the only thing a consumer should add.
 */
export const useInboxQueryOptions = (scope: ChainScope) => {
    const network = legacyNetworkOf(scope)
    const deviceID = useDeviceID(network) ?? ''
    const signingAccounts = useSigningAccounts(scope.chainId)
    const isUnavailableOnNetwork = !useChainCapability(
        scope.chainId,
        'notifications',
    )

    const addresses = useMemo(
        () => addressesOn(signingAccounts, scope),
        [signingAccounts, scope],
    )

    const queryOptionsResult = useMemo(
        () =>
            queryOptions({
                queryKey: getInboxQueryKey(scope, deviceID, addresses),
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
        [scope, network, deviceID, addresses, isUnavailableOnNetwork],
    )

    return { queryOptions: queryOptionsResult, isUnavailableOnNetwork }
}

export type UseInboxQueryResult = {
    data: InboxItem[]
    isPending: boolean
    /** Paused by offline `networkMode: 'online'` gating with nothing cached — render the offline surface, not a spinner (docs/OFFLINE_PAUSED_STATE.md). */
    isPaused: boolean
    isRefetching: boolean
    isError: boolean
    error: Nullable<Error>
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
    /** Resolves to the refreshed items so callers can act on them (see `useHandleMultisigNotification`). */
    refetch: () => Promise<InboxItem[]>
}

export const useInboxQuery = (scope: ChainScope): UseInboxQueryResult => {
    const { queryOptions: inboxQueryOptions, isUnavailableOnNetwork } =
        useInboxQueryOptions(scope)
    const signingAccounts = useSigningAccounts(scope.chainId)
    const allAccounts = useAllAccounts()

    const signingAddresses = useMemo(
        () => addressesOn(signingAccounts, scope),
        [signingAccounts, scope],
    )
    const localAddresses = useMemo(
        () => new Set(addressesOn(allAccounts, scope)),
        [allAccounts, scope],
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
                    .sort((a, b) => sortInboxItems(a, b, signingAddresses)),
            [signingAddresses, localAddresses],
        ),
    })

    const { isPaused } = getQueryRenderState(query)

    // The observer's refetch() ignores `enabled` and would still fire the
    // doomed Pera request on a non-backed network. Referentially stable so a
    // consumer effect with `refetch` in its deps can't turn into a refetch
    // loop (the notifications focus-refetch did exactly that).
    const refetch = useCallback(async () => {
        if (isUnavailableOnNetwork) return []
        const { data } = await query.refetch()
        return data ?? []
    }, [isUnavailableOnNetwork, query.refetch])

    return {
        data: query.data ?? [],
        // A paused query (offline, nothing cached) never leaves `status:
        // 'pending'`, so raw `isPending` would spin the empty view for as long
        // as the device reports no internet.
        isPending: isUnavailableOnNetwork || isPaused ? false : query.isPending,
        isPaused,
        isRefetching: isUnavailableOnNetwork ? false : query.isRefetching,
        isError: query.isError,
        error: query.error,
        isUnavailableOnNetwork,
        refetch,
    }
}
