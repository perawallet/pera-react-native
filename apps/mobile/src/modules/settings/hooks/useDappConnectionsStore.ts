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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSigningAccounts } from '@perawallet/wallet-core-accounts'
// From the platform-agnostic ARC-0027 core, NOT platform-chrome: importing
// through that barrel drags chrome-only code into the native bundle via the
// shared settings routes.
import {
    DappPermissionStore,
    type DappPermission,
    type LocalStorageArea,
} from '@perawallet/wallet-core-arc0027'

export const DAPP_CONNECTIONS_QUERY_KEY = ['dapp-connections'] as const

// apps/mobile's tsconfig has no ambient `chrome` global, so read it off
// globalThis with a narrow local shape instead of pulling in @types/chrome.
type ChromeGlobal = { storage?: { local?: LocalStorageArea } }

const getChromeLocalStorage = (): LocalStorageArea | null => {
    const chromeGlobal = (globalThis as unknown as { chrome?: ChromeGlobal })
        .chrome
    return chromeGlobal?.storage?.local ?? null
}

export type UseDappConnectionsStoreResult = {
    sites: DappPermission[]
    isLoading: boolean
    refetch: () => void
    revoke: (origin: string) => Promise<void>
}

export const useDappConnectionsStore = (): UseDappConnectionsStoreResult => {
    const queryClient = useQueryClient()

    // Native never mounts this screen (dappConnections capability is off
    // there), but stay safe if it's ever evaluated outside that gate.
    const store = useMemo(() => {
        const area = getChromeLocalStorage()
        return area ? new DappPermissionStore(area) : null
    }, [])

    const accounts = useSigningAccounts()

    const query = useQuery({
        queryKey: DAPP_CONNECTIONS_QUERY_KEY,
        queryFn: async () => {
            if (!store) return []
            // Deleting a wallet account leaves its address granted to every origin
            // that had it, surfacing later as a confusing "unauthorized signer".
            // Nothing observes account removal here, so prune BEFORE listing.
            await store.pruneAddresses(
                new Set(accounts.map(account => account.address)),
            )
            return store.list()
        },
    })

    const revokeMutation = useMutation({
        mutationFn: (origin: string) =>
            store ? store.revoke(origin) : Promise.resolve(),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: DAPP_CONNECTIONS_QUERY_KEY,
            })
        },
    })

    const revoke = useCallback(
        (origin: string) => revokeMutation.mutateAsync(origin),
        [revokeMutation],
    )

    return {
        sites: query.data ?? [],
        isLoading: query.isLoading,
        refetch: () => void query.refetch(),
        revoke,
    }
}
